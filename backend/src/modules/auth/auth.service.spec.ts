import {
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

const PASSWORD = 'Password123!';
// Low cost (4) — this only needs to exercise the real bcrypt.compare code
// path quickly in tests; the seed script's cost-10 hash is unrelated.
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

const CONFIG: Record<string, string> = {
  JWT_SECRET: 'access-secret',
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'refresh-secret',
  JWT_REFRESH_EXPIRES_IN: '7d',
  PASSWORD_RESET_TOKEN_TTL_MINUTES: '30',
  FRONTEND_BASE_URL: 'http://localhost:5173',
};

const REFRESH_TTL_SECONDS = 604800; // 7d, matches the fixed decode() mock below

interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'student' | 'teacher';
}

interface ResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

function buildService(configOverrides: Record<string, string> = {}) {
  const user: UserRecord = {
    id: 'user-1',
    name: 'Test User',
    email: 'student1@onthi12.local',
    passwordHash: PASSWORD_HASH,
    role: 'student',
  };

  const prisma = {
    user: {
      findUnique: jest.fn<Promise<UserRecord | null>, [unknown]>(),
      update: jest.fn<
        Promise<UserRecord>,
        [{ where: { id: string }; data: { passwordHash: string } }]
      >(),
    },
    passwordResetToken: {
      create: jest.fn<
        Promise<ResetTokenRecord>,
        [{ data: { userId: string; tokenHash: string; expiresAt: Date } }]
      >(),
      findUnique: jest.fn<
        Promise<ResetTokenRecord | null>,
        [{ where: { tokenHash: string } }]
      >(),
      updateMany: jest.fn<
        Promise<{ count: number }>,
        [{ where: Record<string, unknown>; data: { usedAt: Date } }]
      >(),
    },
    // Interactive form — the implementation is attached below, once `prisma`
    // exists to hand to the callback as the transactional client.
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  );
  // Default: the conditional claim succeeds (one row moved from unused to used).
  prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
  const redisClient = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const redis = { client: redisClient };

  let tokenCounter = 0;
  const jwt = {
    signAsync: jest.fn(() => Promise.resolve(`token-${++tokenCounter}`)),
    verifyAsync: jest.fn(),
    decode: jest.fn(() => ({ iat: 1000, exp: 1000 + REFRESH_TTL_SECONDS })),
  };

  const resolvedConfig = { ...CONFIG, ...configOverrides };
  const config = { get: jest.fn((key: string) => resolvedConfig[key]) };
  const emailSender = {
    sendPasswordResetEmail: jest.fn<Promise<void>, [string, string]>(),
  };

  const service = new AuthService(
    prisma as unknown as PrismaService,
    redis as unknown as RedisService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
    emailSender,
  );

  return { service, prisma, redis, jwt, config, emailSender, user };
}

describe('AuthService', () => {
  describe('validateUser (AC 2)', () => {
    it('returns the user when credentials are valid', async () => {
      const { service, prisma, user } = buildService();
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.validateUser(user.email, PASSWORD)).resolves.toEqual(
        user,
      );
    });

    it('throws the identical UnauthorizedException for an unknown email and a wrong password', async () => {
      const { service, prisma, user } = buildService();

      prisma.user.findUnique.mockResolvedValueOnce(null);
      const unknownEmailError: unknown = await service
        .validateUser('nobody@onthi12.local', PASSWORD)
        .catch((e: unknown) => e);

      prisma.user.findUnique.mockResolvedValueOnce(user);
      const wrongPasswordError: unknown = await service
        .validateUser(user.email, 'wrong-password')
        .catch((e: unknown) => e);

      expect(unknownEmailError).toBeInstanceOf(UnauthorizedException);
      expect(wrongPasswordError).toBeInstanceOf(UnauthorizedException);
      expect((unknownEmailError as UnauthorizedException).message).toBe(
        (wrongPasswordError as UnauthorizedException).message,
      );
      expect((unknownEmailError as UnauthorizedException).message).toBe(
        'Invalid email or password',
      );
    });
  });

  describe('login (AC 1, 3, 4)', () => {
    it('issues an access token with {sub, role} and a refresh token with {sub}, and stores the refresh hash in Redis', async () => {
      const { service, jwt, redis, user } = buildService();

      const tokens = await service.login(user);

      expect(tokens).toEqual({
        accessToken: 'token-1',
        refreshToken: 'token-2',
      });
      expect(jwt.signAsync).toHaveBeenNthCalledWith(
        1,
        { sub: user.id, role: user.role },
        expect.objectContaining({ secret: 'access-secret', expiresIn: '15m' }),
      );
      expect(jwt.signAsync).toHaveBeenNthCalledWith(
        2,
        { sub: user.id },
        expect.objectContaining({ secret: 'refresh-secret', expiresIn: '7d' }),
      );
      expect(redis.client.set).toHaveBeenCalledWith(
        `refresh_token:${user.id}`,
        createHash('sha256').update('token-2').digest('hex'),
        'EX',
        REFRESH_TTL_SECONDS,
      );
    });
  });

  describe('refresh (AC 3)', () => {
    it('rejects a tampered/expired/unknown refresh token', async () => {
      const { service, jwt } = buildService();
      jwt.verifyAsync.mockRejectedValue(new Error('invalid signature'));

      await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a refresh token whose hash no longer matches Redis', async () => {
      const { service, jwt, redis } = buildService();
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      redis.client.get.mockResolvedValue('some-other-hash');

      await expect(service.refresh('stale-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rotates both tokens on success — the old Redis hash is overwritten and no longer matches', async () => {
      const { service, jwt, redis, prisma, user } = buildService();
      const currentHash = createHash('sha256')
        .update('current-refresh-token')
        .digest('hex');

      jwt.verifyAsync.mockResolvedValue({ sub: user.id });
      redis.client.get.mockResolvedValue(currentHash);
      prisma.user.findUnique.mockResolvedValue(user);

      const tokens = await service.refresh('current-refresh-token');

      expect(tokens).toEqual({
        accessToken: 'token-1',
        refreshToken: 'token-2',
      });
      // The new hash differs from currentHash by construction (different
      // token content), and toHaveBeenCalledWith below pins it exactly.
      const newHash = createHash('sha256').update('token-2').digest('hex');
      expect(redis.client.set).toHaveBeenCalledWith(
        `refresh_token:${user.id}`,
        newHash,
        'EX',
        REFRESH_TTL_SECONDS,
      );
    });

    it("re-reads the user's current role from the DB rather than trusting the old token", async () => {
      const { service, jwt, redis, prisma, user } = buildService();
      const promotedUser = { ...user, role: 'teacher' as const };

      jwt.verifyAsync.mockResolvedValue({ sub: user.id });
      redis.client.get.mockResolvedValue(
        createHash('sha256').update('current-refresh-token').digest('hex'),
      );
      prisma.user.findUnique.mockResolvedValue(promotedUser);

      await service.refresh('current-refresh-token');

      expect(jwt.signAsync).toHaveBeenNthCalledWith(
        1,
        { sub: user.id, role: 'teacher' },
        expect.anything(),
      );
    });
  });

  describe('logout (AC 3)', () => {
    it('deletes the stored refresh session', async () => {
      const { service, jwt, redis, user } = buildService();
      jwt.verifyAsync.mockResolvedValue({ sub: user.id });

      await service.logout('some-refresh-token');

      expect(redis.client.del).toHaveBeenCalledWith(`refresh_token:${user.id}`);
    });

    it('rejects an invalid refresh token without deleting anything', async () => {
      const { service, jwt, redis } = buildService();
      jwt.verifyAsync.mockRejectedValue(new Error('invalid signature'));

      await expect(service.logout('bad-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(redis.client.del).not.toHaveBeenCalled();
    });
  });

  describe('requestPasswordReset (AC 1, 2)', () => {
    it('known email: creates a hashed token row and emails a link with the raw token', async () => {
      const { service, prisma, emailSender, user } = buildService();
      prisma.user.findUnique.mockResolvedValue(user);

      await service.requestPasswordReset(user.email);

      expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
      const [createArgs] = prisma.passwordResetToken.create.mock.calls[0];
      expect(createArgs.data.userId).toBe(user.id);
      expect(createArgs.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);

      expect(emailSender.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      const [to, resetLink] = emailSender.sendPasswordResetEmail.mock.calls[0];
      expect(to).toBe(user.email);
      expect(resetLink).toMatch(
        /^http:\/\/localhost:5173\/reset-password\?token=[0-9a-f]{64}$/,
      );

      // The raw token in the link must hash to the stored tokenHash.
      const rawToken = resetLink.split('token=')[1];
      expect(createHash('sha256').update(rawToken).digest('hex')).toBe(
        createArgs.data.tokenHash,
      );
    });

    it('unknown email: creates no token row and sends no email', async () => {
      const { service, prisma, emailSender } = buildService();
      prisma.user.findUnique.mockResolvedValue(null);

      await service.requestPasswordReset('nobody@onthi12.local');

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(emailSender.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('does not propagate when the email sender throws', async () => {
      const { service, prisma, emailSender, user } = buildService();
      prisma.user.findUnique.mockResolvedValue(user);
      emailSender.sendPasswordResetEmail.mockRejectedValue(
        new Error('Resend outage'),
      );

      await expect(
        service.requestPasswordReset(user.email),
      ).resolves.toBeUndefined();
    });

    it('does not wait for the email provider before returning (AC 2 — no latency oracle)', async () => {
      const { service, prisma, emailSender, user } = buildService();
      prisma.user.findUnique.mockResolvedValue(user);
      // A send that never settles: awaiting it would hang this test.
      emailSender.sendPasswordResetEmail.mockReturnValue(
        new Promise<void>(() => {}),
      );

      await expect(
        service.requestPasswordReset(user.email),
      ).resolves.toBeUndefined();
      expect(emailSender.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('falls back to a sane TTL when the configured value is blank or non-numeric', async () => {
      for (const bad of ['', 'thirty']) {
        const { service, prisma, user } = buildService({
          PASSWORD_RESET_TOKEN_TTL_MINUTES: bad,
        });
        prisma.user.findUnique.mockResolvedValue(user);

        await service.requestPasswordReset(user.email);

        const [createArgs] = prisma.passwordResetToken.create.mock.calls[0];
        // Number('') === 0 and Number('thirty') === NaN would otherwise give a
        // token that is already expired, or an Invalid Date the DB rejects.
        expect(createArgs.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
      }
    });

    it('never emits an "undefined/..." link when FRONTEND_BASE_URL is missing, and strips a trailing slash', async () => {
      for (const [configured, expectedOrigin] of [
        ['', 'http://localhost:5173'],
        ['https://onthi12.example.com/', 'https://onthi12.example.com'],
      ]) {
        const { service, prisma, emailSender, user } = buildService({
          FRONTEND_BASE_URL: configured,
        });
        prisma.user.findUnique.mockResolvedValue(user);

        await service.requestPasswordReset(user.email);

        const [, resetLink] = emailSender.sendPasswordResetEmail.mock.calls[0];
        expect(
          resetLink.startsWith(`${expectedOrigin}/reset-password?token=`),
        ).toBe(true);
        expect(resetLink).not.toContain('undefined');
      }
    });
  });

  describe('resetPassword (AC 3)', () => {
    function validRecord(
      overrides: Partial<Pick<ResetTokenRecord, 'usedAt' | 'expiresAt'>> = {},
    ): ResetTokenRecord {
      return {
        id: 'reset-token-1',
        userId: 'user-1',
        tokenHash: 'irrelevant-in-mock',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        ...overrides,
      };
    }

    it('valid unused/unexpired token: updates the password hash, marks the token used, and revokes the session — all in one transaction', async () => {
      const { service, prisma, redis } = buildService();
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord());

      await service.resetPassword('raw-token', 'NewPassword123!');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: expect.any(String) as string },
      });
      const [updateArgs] = prisma.user.update.mock.calls[0];
      const newHash = updateArgs.data.passwordHash;
      await expect(bcrypt.compare('NewPassword123!', newHash)).resolves.toBe(
        true,
      );
      // The token is claimed conditionally (usedAt still null) rather than
      // blind-updated — that condition is what makes the single-use guarantee
      // hold against a concurrent second request.
      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'reset-token-1',
            usedAt: null,
          }) as unknown,
        }),
      );
      expect(redis.client.del).toHaveBeenCalledWith('refresh_token:user-1');
    });

    it('a concurrent request that already claimed the token loses: no password is written', async () => {
      const { service, prisma, redis } = buildService();
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord());
      // The row read a moment ago was unused, but the conditional claim inside
      // the transaction matches nothing — another request got there first.
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.resetPassword('raw-token', 'NewPassword123!'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(redis.client.del).not.toHaveBeenCalled();
    });

    it("invalidates the user's other outstanding reset links in the same transaction", async () => {
      const { service, prisma } = buildService();
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord());

      await service.resetPassword('raw-token', 'NewPassword123!');

      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            usedAt: null,
          }) as unknown,
        }),
      );
    });

    it('writes nothing when the transaction itself fails', async () => {
      const { service, prisma, redis } = buildService();
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord());
      prisma.$transaction.mockRejectedValue(new Error('deadlock detected'));

      await expect(
        service.resetPassword('raw-token', 'NewPassword123!'),
      ).rejects.toThrow('deadlock detected');

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(redis.client.del).not.toHaveBeenCalled();
    });

    it('still succeeds when revoking the Redis session fails after the commit', async () => {
      const { service, prisma, redis } = buildService();
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord());
      redis.client.del.mockRejectedValue(new Error('redis down'));

      // The password is already committed — surfacing a 500 here would tell the
      // user their link was invalid while their new password in fact works.
      await expect(
        service.resetPassword('raw-token', 'NewPassword123!'),
      ).resolves.toBeUndefined();
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('throws the identical message for an unknown, an already-used, and an expired token', async () => {
      const { service, prisma } = buildService();

      prisma.passwordResetToken.findUnique.mockResolvedValueOnce(null);
      const unknownError: unknown = await service
        .resetPassword('unknown-token', 'NewPassword123!')
        .catch((e: unknown) => e);

      prisma.passwordResetToken.findUnique.mockResolvedValueOnce(
        validRecord({ usedAt: new Date() }),
      );
      const usedError: unknown = await service
        .resetPassword('used-token', 'NewPassword123!')
        .catch((e: unknown) => e);

      prisma.passwordResetToken.findUnique.mockResolvedValueOnce(
        validRecord({ expiresAt: new Date(Date.now() - 1000) }),
      );
      const expiredError: unknown = await service
        .resetPassword('expired-token', 'NewPassword123!')
        .catch((e: unknown) => e);

      for (const error of [unknownError, usedError, expiredError]) {
        expect(error).toBeInstanceOf(UnprocessableEntityException);
        expect((error as UnprocessableEntityException).message).toBe(
          'Invalid or expired reset token',
        );
      }
    });
  });
});
