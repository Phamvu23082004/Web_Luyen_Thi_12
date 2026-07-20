import { UnauthorizedException } from '@nestjs/common';
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
};

const REFRESH_TTL_SECONDS = 604800; // 7d, matches the fixed decode() mock below

function buildService() {
  const user = {
    id: 'user-1',
    name: 'Test User',
    email: 'student1@onthi12.local',
    passwordHash: PASSWORD_HASH,
    role: 'student' as const,
  };

  const prisma = { user: { findUnique: jest.fn() } };
  const redisClient = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const redis = { client: redisClient };

  let tokenCounter = 0;
  const jwt = {
    signAsync: jest.fn(() => Promise.resolve(`token-${++tokenCounter}`)),
    verifyAsync: jest.fn(),
    decode: jest.fn(() => ({ iat: 1000, exp: 1000 + REFRESH_TTL_SECONDS })),
  };

  const config = { get: jest.fn((key: string) => CONFIG[key]) };

  const service = new AuthService(
    prisma as unknown as PrismaService,
    redis as unknown as RedisService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
  );

  return { service, prisma, redis, jwt, config, user };
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
});
