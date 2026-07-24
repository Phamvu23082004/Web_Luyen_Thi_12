import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { access, rm } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { PrismaService } from '../../src/prisma/prisma.service';
import { LocalFileStorageService } from '../../src/common/storage/local-file-storage.service';
import type { FileStorage } from '../../src/common/storage/file-storage';
import { ExamService } from '../../src/modules/exam/exam.service';
import { CreateExamDto } from '../../src/modules/exam/dto/create-exam.dto';
import type { PrismaClient } from '../../generated/prisma/client';
import { createTestPrismaClient, resetDatabase } from './prisma-test-client';

/**
 * Integration coverage for Story 2.1a's one property a fake structurally cannot
 * show: the exam row and its file commit together, against a real PostgreSQL.
 *
 * An in-memory `$transaction` fake reports success whether or not the rename
 * happened — the exact failure mode Story 1.8 shipped. Only a real database with
 * real transaction semantics can prove the rollback, and only the real migrated
 * schema can prove `source_file_url` is NOT NULL at the DB level.
 *
 * The last test is the mandatory control (PROJECT-STANDARDS §7): the naive
 * create-then-rename ordering, asserted to leave an orphan row when the rename
 * fails. If it ever stops failing, the harness has lost the ability to detect the
 * regression the tests above exist to catch.
 */

const DTO: CreateExamDto = {
  title: 'Đề kiểm tra Hóa 12',
  subject: 'Hóa học',
  durationMinutes: 60,
};

function pdf(): Express.Multer.File {
  return { buffer: Buffer.from('%PDF-1.7 real bytes') } as Express.Multer.File;
}

describe('exam create — real-database row+file atomicity', () => {
  let prisma: PrismaClient;
  let storage: LocalFileStorageService;
  let storageRoot: string;
  let teacherId: string;

  beforeAll(() => {
    prisma = createTestPrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    storageRoot = await mkdtemp(path.join(tmpdir(), 'onthi12-int-'));
    storage = new LocalFileStorageService({
      get: (key: string) => (key === 'STORAGE_ROOT' ? storageRoot : undefined),
    } as unknown as ConfigService);

    const teacher = await prisma.user.create({
      data: {
        name: 'Teacher Alpha',
        email: 'teacher.alpha@onthi12.local',
        passwordHash: await bcrypt.hash('Password123!', 10),
        role: 'teacher',
      },
    });
    teacherId = teacher.id;
  });

  afterEach(async () => {
    await rm(storageRoot, { recursive: true, force: true });
  });

  function service(fileStorage: FileStorage): ExamService {
    return new ExamService(prisma as unknown as PrismaService, fileStorage);
  }

  it('leaves exactly one row whose source_file_url resolves to a file on disk', async () => {
    const exam = await service(storage).createDraftFromPdf(
      teacherId,
      DTO,
      pdf(),
    );

    const rows = await prisma.exam.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(exam.id);
    expect(rows[0].status).toBe('draft');
    expect(rows[0].parseStatus).toBe('pending');
    expect(rows[0].sourceFileUrl).toBe(`exams/${exam.id}/source.pdf`);

    // The stored key resolves to a file that actually exists.
    await expect(
      access(path.join(storageRoot, rows[0].sourceFileUrl)),
    ).resolves.toBeUndefined();
  });

  it('rolls the row back and leaves no file when the rename inside the transaction throws', async () => {
    // Real temp write + cleanup, but publish (the rename) fails inside the txn.
    const failingStorage: FileStorage = {
      writeTemp: (b, e) => storage.writeTemp(b, e),
      publish: () => Promise.reject(new Error('simulated rename failure')),
      discardTemp: (h) => storage.discardTemp(h),
    };

    await expect(
      service(failingStorage).createDraftFromPdf(teacherId, DTO, pdf()),
    ).rejects.toThrow('simulated rename failure');

    // No row (the rename failure rolled it back) and no published file.
    expect(await prisma.exam.count()).toBe(0);
    await expect(access(path.join(storageRoot, 'exams'))).rejects.toMatchObject(
      { code: 'ENOENT' },
    );
  });

  it('enforces source_file_url NOT NULL at the database level, not just in TypeScript', async () => {
    // Bypass Prisma's client-side validation with raw SQL to hit the real column
    // constraint. Postgres raises a not-null violation (code 23502); Prisma's
    // driver adapter wraps it as P2010 and carries the native code/message inside,
    // so assert on the surfaced detail rather than the outer wrapper code.
    let caught: unknown;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO exams (id, title, subject, duration_minutes, teacher_id, updated_at)
         VALUES ('raw-1', 't', 's', 30, $1, now())`,
        teacherId,
      );
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeDefined();
    const detail = JSON.stringify({
      code: (caught as { code?: string }).code,
      meta: (caught as { meta?: unknown }).meta,
      message: (caught as Error).message,
    });
    expect(detail).toMatch(/23502|null value in column "source_file_url"/i);

    expect(await prisma.exam.count()).toBe(0);
  });

  /**
   * CONTROL — proves the harness has teeth.
   *
   * The shape the code would have if the row were committed BEFORE the file was
   * published: create + commit, then rename. Under the in-memory fake used in the
   * unit/e2e suites this is indistinguishable from the real implementation.
   * Against a real database it is not — the committed row survives the failed
   * rename, an orphan the transactional version (test above) never produces.
   */
  it('CONTROL: naive create-then-rename leaves an orphan row when the rename fails', async () => {
    const tempHandle = await storage.writeTemp(pdf().buffer, 'pdf');

    // Row committed first, on its own — the bug.
    const created = await prisma.exam.create({
      data: {
        title: DTO.title,
        subject: DTO.subject,
        durationMinutes: DTO.durationMinutes,
        teacherId,
        sourceFileUrl: `exams/naive/source.pdf`,
      },
    });

    // Then the rename fails (a traversal key makes the real publish throw).
    await expect(storage.publish(tempHandle, '../../etc/x')).rejects.toThrow(
      /escapes the storage root/,
    );

    // The defect the real implementation prevents: the row outlives the file.
    const rows = await prisma.exam.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(created.id);

    await storage.discardTemp(tempHandle);
  });
});
