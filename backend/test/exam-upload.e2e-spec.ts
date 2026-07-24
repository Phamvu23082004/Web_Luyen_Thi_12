import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ExamController } from './../src/modules/exam/exam.controller';
import { ExamService } from './../src/modules/exam/exam.service';
import { FILE_STORAGE } from './../src/common/storage/file-storage';
import { PrismaService } from './../src/prisma/prisma.service';
import { JwtAuthGuard } from './../src/common/guards/jwt-auth.guard';
import { RolesGuard } from './../src/common/guards/roles.guard';
import { configureApp } from './../src/common/configure-app';
import { getPositiveIntConfig } from './../src/common/config/positive-int-config';
import type { AuthUser } from './../src/common/types/authenticated-request';

const JWT_SECRET = 'e2e-access-secret';
// Small on purpose so a tiny buffer can exceed it (the 413 path) without shipping
// a multi-MB fixture through supertest.
const MAX_BYTES = 1024;

// In-memory fakes — no real Postgres/disk (password-reset.e2e-spec.ts precedent).
// Stateful so `update` returns the created row merged with its change, exactly as
// a real DB would — an update that spread a stale template would silently blank
// title/subject/duration and hide a real controller bug.
function buildPrismaFake() {
  const base = {
    status: 'draft',
    sourceFileUrl: '',
    parseStatus: 'pending',
    parseError: null,
    parseGeneration: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const rows = new Map<string, Record<string, unknown>>();
  const fake = {
    exam: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        const row = { id: 'exam-e2e-1', ...base, ...data };
        rows.set(row.id, row);
        return Promise.resolve(row);
      }),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = { ...rows.get(where.id), ...data };
          rows.set(where.id, row);
          return Promise.resolve(row);
        },
      ),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      Promise.resolve().then(() => fn(fake)),
  };
  return fake;
}

function buildStorageFake() {
  return {
    writeTemp: jest.fn().mockResolvedValue('/tmp/e2e-handle.pdf'),
    publish: jest.fn().mockResolvedValue(undefined),
    discardTemp: jest.fn().mockResolvedValue(undefined),
  };
}

describe('Exam upload (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let storage: ReturnType<typeof buildStorageFake>;

  const bearer = (payload: AuthUser) =>
    `Bearer ${jwt.sign(payload, { secret: JWT_SECRET })}`;
  const teacherToken = () => bearer({ sub: 'teacher-1', role: 'teacher' });
  const studentToken = () => bearer({ sub: 'student-1', role: 'student' });

  beforeEach(async () => {
    storage = buildStorageFake();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ JWT_SECRET, EXAM_PDF_MAX_BYTES: String(MAX_BYTES) })],
        }),
        JwtModule.register({}),
        // Mirrors exam.module.ts's registerAsync + getPositiveIntConfig exactly,
        // so this suite exercises the real runtime config-read path rather than
        // a parallel hand-rolled one — a module-load-time `undefined` bug in the
        // real factory would otherwise pass here undetected.
        MulterModule.registerAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            storage: memoryStorage(),
            limits: {
              fileSize: getPositiveIntConfig(
                config,
                'EXAM_PDF_MAX_BYTES',
                MAX_BYTES,
              ),
              files: 1,
            },
          }),
        }),
      ],
      controllers: [ExamController],
      providers: [
        ExamService,
        // Same global guards as production (app.module.ts), same order. Without
        // them a dropped @Roles('teacher') would leave this suite green while
        // production let students through — the exact regression Story 1.8's
        // review caught in an e2e that omitted the guards.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: PrismaService, useValue: buildPrismaFake() },
        { provide: FILE_STORAGE, useValue: storage },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    jwt = app.get(JwtService);
    configureApp(app);
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const post = () => request(app.getHttpServer()).post('/api/exams');
  const withFields = (r: request.Test) =>
    r
      .field('title', 'Giữa kỳ Toán')
      .field('subject', 'Toán')
      .field('durationMinutes', '45');

  it('rejects an anonymous request with 401', async () => {
    await withFields(post())
      .attach('file', Buffer.from('%PDF-1.7 ok'), {
        filename: 'e.pdf',
        contentType: 'application/pdf',
      })
      .expect(401);
  });

  it('rejects a student token with 403', async () => {
    await withFields(post().set('Authorization', studentToken()))
      .attach('file', Buffer.from('%PDF-1.7 ok'), {
        filename: 'e.pdf',
        contentType: 'application/pdf',
      })
      .expect(403);
  });

  it('rejects a teacher with no file (400) — AC 3', async () => {
    const res = await withFields(
      post().set('Authorization', teacherToken()),
    ).expect(400);
    expect(res.body).not.toHaveProperty('errorCode');
    expect(storage.writeTemp).not.toHaveBeenCalled();
  });

  it('rejects a teacher uploading a non-PDF buffer with 400', async () => {
    const res = await withFields(post().set('Authorization', teacherToken()))
      .attach('file', Buffer.from('GIF89a not a pdf'), {
        filename: 'e.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    expect(res.body).not.toHaveProperty('errorCode');
  });

  it('rejects an oversize upload with 413', async () => {
    await withFields(post().set('Authorization', teacherToken()))
      .attach('file', Buffer.alloc(MAX_BYTES + 1, 0x41), {
        filename: 'big.pdf',
        contentType: 'application/pdf',
      })
      .expect(413);
  });

  it('accepts a valid teacher upload with 201 and the { data } envelope', async () => {
    const res = await withFields(post().set('Authorization', teacherToken()))
      .attach('file', Buffer.from('%PDF-1.7 hello'), {
        filename: 'e.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(res.body).toEqual({
      data: {
        id: 'exam-e2e-1',
        title: 'Giữa kỳ Toán',
        subject: 'Toán',
        durationMinutes: 45,
        status: 'draft',
        parseStatus: 'pending',
      },
    });
    expect(res.body).not.toHaveProperty('errorCode');
    // source_file_url is not exposed in the response body.
    expect(
      (res.body as { data: Record<string, unknown> }).data,
    ).not.toHaveProperty('sourceFileUrl');
    expect(storage.publish).toHaveBeenCalledWith(
      '/tmp/e2e-handle.pdf',
      'exams/exam-e2e-1/source.pdf',
    );
  });
});
