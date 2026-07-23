import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { createHash, randomUUID } from 'node:crypto';
import { AuthController } from './../src/modules/auth/auth.controller';
import { AuthService } from './../src/modules/auth/auth.service';
import { EMAIL_SENDER } from './../src/common/email/email-sender';
import { PrismaService } from './../src/prisma/prisma.service';
import { RedisService } from './../src/common/redis/redis.service';
import { LoginRateLimitGuard } from './../src/common/guards/login-rate-limit.guard';
import { JwtAuthGuard } from './../src/common/guards/jwt-auth.guard';
import { RolesGuard } from './../src/common/guards/roles.guard';
import { SlidingWindowRateLimiterService } from './../src/common/rate-limit/sliding-window-rate-limiter.service';
import { configureApp } from './../src/common/configure-app';

interface FakeUser {
  id: string;
  email: string;
  passwordHash: string;
  role: 'student' | 'teacher';
}

interface FakeResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

// In-memory fakes — no running Postgres/Redis/Resend (mirrors
// login-rate-limit.e2e-spec.ts / roles-guard.e2e-spec.ts's no-real-infra precedent).
function buildPrismaFake(seededUser: FakeUser) {
  const users = new Map<string, FakeUser>([[seededUser.email, seededUser]]);
  const usersById = new Map<string, FakeUser>([[seededUser.id, seededUser]]);
  const resetTokens = new Map<string, FakeResetToken>();

  const fake = {
    user: {
      findUnique: ({ where }: { where: { email?: string; id?: string } }) =>
        Promise.resolve(
          (where.email ? users.get(where.email) : usersById.get(where.id!)) ??
            null,
        ),
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: { passwordHash: string };
      }) => {
        const user = usersById.get(where.id);
        if (!user) throw new Error('user not found');
        user.passwordHash = data.passwordHash;
        return Promise.resolve(user);
      },
    },
    passwordResetToken: {
      create: ({
        data,
      }: {
        data: { userId: string; tokenHash: string; expiresAt: Date };
      }) => {
        const record: FakeResetToken = {
          id: randomUUID(),
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          usedAt: null,
        };
        resetTokens.set(record.id, record);
        return Promise.resolve(record);
      },
      findUnique: ({
        where: { tokenHash },
      }: {
        where: { tokenHash: string };
      }) =>
        Promise.resolve(
          [...resetTokens.values()].find((r) => r.tokenHash === tokenHash) ??
            null,
        ),
      // Honours the same conditional fields the service filters on, so the
      // "already claimed" path (count === 0) is reachable in this fake.
      updateMany: ({
        where,
        data,
      }: {
        where: {
          id?: string;
          userId?: string;
          usedAt?: null;
          expiresAt?: { gt: Date };
        };
        data: { usedAt: Date };
      }) => {
        const matched = [...resetTokens.values()].filter(
          (r) =>
            (where.id === undefined || r.id === where.id) &&
            (where.userId === undefined || r.userId === where.userId) &&
            (where.usedAt !== null || r.usedAt === null) &&
            (where.expiresAt === undefined || r.expiresAt > where.expiresAt.gt),
        );
        for (const record of matched) record.usedAt = data.usedAt;
        return Promise.resolve({ count: matched.length });
      },
    },
    // Interactive form — the service passes a callback and the writes only
    // happen when it runs, so a rejection genuinely skips them.
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      Promise.resolve().then(() => fn(fake)),
    _debug: { users, resetTokens },
  };

  return fake;
}

function buildRedisFake() {
  return { client: { del: jest.fn().mockResolvedValue(1) } };
}

function buildEmailSenderFake() {
  const calls: { to: string; resetLink: string }[] = [];
  return {
    sendPasswordResetEmail: jest.fn((to: string, resetLink: string) => {
      calls.push({ to, resetLink });
      return Promise.resolve();
    }),
    _calls: calls,
  };
}

describe('Password reset (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: ReturnType<typeof buildPrismaFake>;
  let emailSender: ReturnType<typeof buildEmailSenderFake>;

  const seededUser: FakeUser = {
    id: 'user-1',
    email: 'student1@onthi12.local',
    passwordHash: 'old-hash',
    role: 'student',
  };

  beforeEach(async () => {
    prisma = buildPrismaFake({ ...seededUser });
    emailSender = buildEmailSenderFake();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              PASSWORD_RESET_TOKEN_TTL_MINUTES: '30',
              FRONTEND_BASE_URL: 'http://localhost:5173',
              JWT_SECRET: 'e2e-access-secret',
            }),
          ],
        }),
        JwtModule.register({}),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        // Same global guards as production (app.module.ts), in the same order.
        // Without them @Public() is never exercised: dropping the decorator
        // from either new route would keep this suite green while production
        // returned 401 to every anonymous caller.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        // The controller's (unused-in-this-spec) `login` route is decorated
        // with LoginRateLimitGuard, so Nest still needs it resolvable.
        SlidingWindowRateLimiterService,
        LoginRateLimitGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: buildRedisFake() },
        { provide: EMAIL_SENDER, useValue: emailSender },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const forgotPassword = (email: string) =>
    request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email });

  const resetPassword = (token: string, newPassword: string) =>
    request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, newPassword });

  it('returns the identical shape and status for a seeded and an unseeded email (AC 2)', async () => {
    const known = await forgotPassword(seededUser.email).expect(200);
    const unknown = await forgotPassword('nobody@onthi12.local').expect(200);

    expect(known.body).toEqual(unknown.body);
    expect((known.body as { data: { message: string } }).data.message).toEqual(
      expect.any(String),
    );
    expect(emailSender.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it('rejects a bogus reset token with 422 and no errorCode', async () => {
    const res = await resetPassword(
      'not-a-real-token',
      'NewPassword123!',
    ).expect(422);
    const body = res.body as Record<string, unknown>;
    expect(body.statusCode).toBe(422);
    expect(body).not.toHaveProperty('errorCode');
  });

  /** Drives a real forgot-password request and returns the token from the emailed link. */
  const issueResetToken = async (): Promise<string> => {
    await forgotPassword(seededUser.email).expect(200);
    // Assert first: without this a missing email surfaces as "Invalid URL" from
    // a helper line rather than naming the send that never happened.
    expect(emailSender._calls).toHaveLength(1);
    const { resetLink } = emailSender._calls[0];
    return new URL(resetLink).searchParams.get('token')!;
  };

  it('accepts a valid token and updates the password hash + usedAt', async () => {
    const rawToken = await issueResetToken();

    await resetPassword(rawToken, 'NewPassword123!').expect(200);

    const updatedUser = prisma._debug.users.get(seededUser.email)!;
    expect(updatedUser.passwordHash).not.toBe('old-hash');

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = [...prisma._debug.resetTokens.values()].find(
      (r) => r.tokenHash === tokenHash,
    )!;
    expect(record.usedAt).not.toBeNull();

    // Replaying the same token must now be rejected.
    await resetPassword(rawToken, 'AnotherPassword123!').expect(422);
  });

  it('rejects an expired token with the same generic 422', async () => {
    const rawToken = await issueResetToken();
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = [...prisma._debug.resetTokens.values()].find(
      (r) => r.tokenHash === tokenHash,
    )!;
    record.expiresAt = new Date(Date.now() - 1000);

    const res = await resetPassword(rawToken, 'NewPassword123!').expect(422);
    expect((res.body as { message: string }).message).toBe(
      'Invalid or expired reset token',
    );
    expect(prisma._debug.users.get(seededUser.email)!.passwordHash).toBe(
      'old-hash',
    );
  });

  it('invalidates a previously issued link once a newer one is used', async () => {
    const firstToken = await issueResetToken();
    emailSender._calls.length = 0;
    const secondToken = await issueResetToken();

    await resetPassword(secondToken, 'NewPassword123!').expect(200);

    // The older link must not still be able to change the password.
    await resetPassword(firstToken, 'AttackerPassword123!').expect(422);
  });

  it('rejects a too-short password with a 400 before touching the token', async () => {
    const rawToken = await issueResetToken();

    await resetPassword(rawToken, 'short').expect(400);

    expect(prisma._debug.users.get(seededUser.email)!.passwordHash).toBe(
      'old-hash',
    );
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = [...prisma._debug.resetTokens.values()].find(
      (r) => r.tokenHash === tokenHash,
    )!;
    expect(record.usedAt).toBeNull();
  });

  it('keeps both routes reachable without a Bearer token (@Public under the global JwtAuthGuard)', async () => {
    // The global guards are registered in this module, so a 401 here would mean
    // @Public() had been dropped — the regression the guard wiring exists to catch.
    await forgotPassword(seededUser.email).expect(200);
    await resetPassword('not-a-real-token', 'NewPassword123!').expect(422);
  });
});
