import { UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { AuthService } from '../../src/modules/auth/auth.service';
import type { RedisService } from '../../src/common/redis/redis.service';
import type { PrismaService } from '../../src/prisma/prisma.service';
import type { PrismaClient } from '../../generated/prisma/client';
import { createTestPrismaClient, resetDatabase } from './prisma-test-client';

/**
 * Integration coverage for AC 3 of Story 1.8 — "the token is marked used
 * atomically so it cannot be replayed" — against a real PostgreSQL.
 *
 * Why this cannot live in the unit suite. `auth.service.spec.ts` does cover
 * both halves of the guarantee well — it asserts the conditional `where` clause
 * reaches `updateMany`, and that a mocked `count: 0` produces a rejection. Both
 * of those catch a regression, and neither is redundant with this file.
 *
 * What they cannot do is prove the assumption underneath: that PostgreSQL
 * actually *reports* zero affected rows to the second of two genuinely
 * concurrent callers. That depends on isolation level and row locking inside
 * the interactive transaction — the place the real single-use guarantee lives,
 * and the one thing no mocked return value can validate. Change the isolation
 * level and every unit test here still passes while the system is broken.
 *
 * The in-memory fake is weaker still: its `$transaction` is
 * `(ops) => Promise.all(ops)`, so the operations have already executed by the
 * time it receives them. Story 1.8 shipped an "atomicity proof" against that
 * fake which would have passed with the transaction deleted entirely.
 *
 * The last test in this file is a deliberate control. It re-implements the
 * naive version (read, check, then write unconditionally) and asserts that the
 * harness *does* observe the double-write — proving these tests can fail, which
 * is what makes the passing ones mean something (PROJECT-STANDARDS §7, rule P3
 * from the Epic 1 retrospective).
 */

const PASSWORD_A = 'winner-password-a';
const PASSWORD_B = 'loser-password-b';

function sha256Hex(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('password reset — real-database transaction semantics', () => {
  let prisma: PrismaClient;
  let service: AuthService;
  let redisDel: jest.Mock;

  beforeAll(() => {
    prisma = createTestPrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);

    redisDel = jest.fn().mockResolvedValue(1);

    // Only the database is real. Redis, JWT and the email provider are not the
    // property under test here, and faking them keeps the suite free of
    // external services beyond the one container.
    service = new AuthService(
      prisma as unknown as PrismaService,
      { client: { del: redisDel } } as unknown as RedisService,
      {} as JwtService,
      {
        get: jest.fn(
          (key: string) =>
            ({
              PASSWORD_RESET_TOKEN_TTL_MINUTES: '30',
              FRONTEND_BASE_URL: 'http://localhost:5173',
            })[key],
        ),
      } as unknown as ConfigService,
      { sendPasswordResetEmail: jest.fn() },
    );
  });

  /** Creates a user plus one live reset token; returns the raw token. */
  async function seedUserWithToken(
    email = 'concurrent@onthi12.local',
  ): Promise<{ userId: string; token: string }> {
    const user = await prisma.user.create({
      data: {
        name: 'Concurrency Probe',
        email,
        passwordHash: await bcrypt.hash('original-password', 10),
        role: 'student',
      },
    });

    const token = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256Hex(token),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });

    return { userId: user.id, token };
  }

  it('lets exactly one of two concurrent resets with the same token win', async () => {
    const { userId, token } = await seedUserWithToken();

    const results = await Promise.allSettled([
      service.resetPassword(token, PASSWORD_A),
      service.resetPassword(token, PASSWORD_B),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(UnprocessableEntityException);

    // The surviving password must be one of the two, not a torn write, and the
    // loser's password must not be usable.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const matchesA = await bcrypt.compare(PASSWORD_A, user.passwordHash);
    const matchesB = await bcrypt.compare(PASSWORD_B, user.passwordHash);
    expect(matchesA !== matchesB).toBe(true);

    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId },
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].usedAt).not.toBeNull();
  });

  it('rejects a replay of the same token after a successful reset', async () => {
    const { token } = await seedUserWithToken();

    await service.resetPassword(token, PASSWORD_A);

    await expect(
      service.resetPassword(token, PASSWORD_B),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('kills every other outstanding link for the user when one is spent', async () => {
    const { userId, token } = await seedUserWithToken();

    // A second, independently requested link that is still live.
    const staleToken = randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: sha256Hex(staleToken),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });

    await service.resetPassword(token, PASSWORD_A);

    const remaining = await prisma.passwordResetToken.findMany({
      where: { userId, usedAt: null },
    });
    expect(remaining).toHaveLength(0);

    await expect(
      service.resetPassword(staleToken, PASSWORD_B),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('commits the password even when revoking the refresh session fails', async () => {
    const { userId, token } = await seedUserWithToken();
    redisDel.mockRejectedValueOnce(new Error('redis is down'));

    await expect(
      service.resetPassword(token, PASSWORD_A),
    ).resolves.toBeUndefined();

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await bcrypt.compare(PASSWORD_A, user.passwordHash)).toBe(true);
  });

  /**
   * CONTROL — proves the harness has teeth.
   *
   * This is the shape the code would have if someone moved the used/expired
   * check back outside the transaction: read, check in application code, then
   * write unconditionally. Under the in-memory Prisma fake used everywhere else
   * this is indistinguishable from the real implementation. Against a real
   * database it is not: both callers succeed and both write a password.
   *
   * If this test ever starts failing, the harness has stopped being able to
   * detect the regression the tests above exist to catch.
   */
  it('CONTROL: a non-atomic implementation lets both concurrent resets through', async () => {
    const { userId, token } = await seedUserWithToken('control@onthi12.local');

    async function naiveResetPassword(
      rawToken: string,
      newPassword: string,
    ): Promise<void> {
      const record = await prisma.passwordResetToken.findUnique({
        where: { tokenHash: sha256Hex(rawToken) },
      });
      if (record === null || record.usedAt !== null) {
        throw new UnprocessableEntityException(
          'Invalid or expired reset token',
        );
      }
      // The bug: the check above was made against a value read outside the
      // transaction, and these writes are unconditional.
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        });
        await tx.user.update({
          where: { id: record.userId },
          data: { passwordHash },
        });
      });
    }

    const results = await Promise.allSettled([
      naiveResetPassword(token, PASSWORD_A),
      naiveResetPassword(token, PASSWORD_B),
    ]);

    // Both callers believe they succeeded — the defect the real implementation
    // prevents, and which the in-memory fake could never surface.
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await bcrypt.compare('original-password', user.passwordHash)).toBe(
      false,
    );
  });
});
