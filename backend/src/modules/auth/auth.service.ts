import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '../../../generated/prisma/client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AccessTokenPayload {
  sub: string;
  role: User['role'];
}

interface RefreshTokenPayload {
  sub: string;
}

function refreshRedisKey(userId: string): string {
  return `refresh_token:${userId}`;
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Compared against when the email is unknown, so an unknown-email lookup takes
// the same bcrypt.compare cost as a wrong-password lookup (AC 2 — a response-time
// gap would otherwise leak which field was wrong even with an identical message).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('onthi12-timing-safe-dummy', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Verifies credentials against the stored hash. Unknown email and wrong
   * password throw the identical UnauthorizedException (AC 2) — never reveal
   * which field was wrong.
   */
  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const isValid = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!isValid || user === null) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return user;
  }

  /**
   * Issues a fresh access/refresh token pair for the given user and stores
   * the refresh token's hash in Redis (overwriting any prior session — MVP
   * is single-active-session per user).
   */
  async login(user: User): Promise<TokenPair> {
    const accessPayload: AccessTokenPayload = { sub: user.id, role: user.role };
    const refreshPayload: RefreshTokenPayload = { sub: user.id };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_EXPIRES_IN',
      ) as JwtSignOptions['expiresIn'],
    });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
      ) as JwtSignOptions['expiresIn'],
    });

    await this.storeRefreshToken(user.id, refreshToken);

    return { accessToken, refreshToken };
  }

  /**
   * Verifies the refresh token, checks it against the stored Redis hash, and
   * rotates both tokens on success — re-reading the user's current role from
   * the DB (not the old token) so a role change is picked up.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const stored = await this.redis.client.get(refreshRedisKey(payload.sub));
    if (stored === null || stored !== hashRefreshToken(refreshToken)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (user === null) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.login(user);
  }

  /** Revokes only the stored refresh session — the access token expires on its own short TTL. */
  async logout(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken);
    await this.redis.client.del(refreshRedisKey(payload.sub));
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    // Decode (not verify) — we just signed this token ourselves, so its
    // exp/iat claims are trusted without a second signature check.
    const decoded = this.jwt.decode<{ exp: number; iat: number }>(refreshToken);
    const ttlSeconds = decoded.exp - decoded.iat;

    await this.redis.client.set(
      refreshRedisKey(userId),
      hashRefreshToken(refreshToken),
      'EX',
      ttlSeconds,
    );
  }
}
