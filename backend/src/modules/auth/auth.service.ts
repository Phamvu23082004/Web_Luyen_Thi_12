import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { RedisService } from '../../common/redis/redis.service';
import { EMAIL_SENDER } from '../../common/email/email-sender';
import type { EmailSender } from '../../common/email/email-sender';
import { getPositiveIntConfig } from '../../common/config/positive-int-config';
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

// One hash for both token kinds (refresh + password reset). Only the hash is
// ever stored — the raw token exists solely in the client's hands (the email
// link, or the refresh-token body).
function sha256Hex(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Compared against when the email is unknown, so an unknown-email lookup takes
// the same bcrypt.compare cost as a wrong-password lookup (AC 2 — a response-time
// gap would otherwise leak which field was wrong even with an identical message).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('onthi12-timing-safe-dummy', 10);

const DEFAULT_RESET_TTL_MINUTES = 30;
const DEFAULT_FRONTEND_BASE_URL = 'http://localhost:5173';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Resolved once at boot so a bad value surfaces at startup, not per request. */
  private readonly resetTtlMinutes: number;
  private readonly frontendBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
  ) {
    this.resetTtlMinutes = getPositiveIntConfig(
      config,
      'PASSWORD_RESET_TOKEN_TTL_MINUTES',
      DEFAULT_RESET_TTL_MINUTES,
    );

    // Interpolating this unchecked would email a literal
    // "undefined/reset-password?token=..." link and still return 200, with
    // nothing logged anywhere. Fall back to the dev origin and say so loudly.
    const baseUrl = this.config.get<string>('FRONTEND_BASE_URL')?.trim();
    if (!baseUrl) {
      this.logger.error(
        `FRONTEND_BASE_URL is not set — password reset links will point at ${DEFAULT_FRONTEND_BASE_URL}`,
      );
    }
    this.frontendBaseUrl = (baseUrl || DEFAULT_FRONTEND_BASE_URL).replace(
      /\/+$/,
      '',
    );
  }

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
    if (stored === null || stored !== sha256Hex(refreshToken)) {
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

  /** Revokes only the stored refresh session — the access token stays valid until its own short TTL expires. */
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
      sha256Hex(refreshToken),
      'EX',
      ttlSeconds,
    );
  }

  /**
   * Issues a reset token and emails it when the address matches a real
   * account. Returns normally either way (AC 2) — the controller always
   * sends the same response, so an unknown email must produce zero
   * observable side effects here: no token row, no email call.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user === null) {
      return;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + this.resetTtlMinutes * 60_000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const resetLink = `${this.frontendBaseUrl}/reset-password?token=${token}`;

    // Deliberately not awaited: the provider round-trip takes hundreds of ms,
    // so awaiting it would make a known email measurably slower to respond than
    // an unknown one — a latency oracle that enumerates accounts just as well as
    // a different message would (AC 2 forbids *any* observable difference).
    void this.dispatchResetEmail(user.id, user.email, resetLink);
  }

  /**
   * Sends the reset email out-of-band. Never rejects: a provider outage must not
   * turn into a 500 that fingerprints "this email exists but sending failed"
   * against the generic 200 an unknown email gets.
   */
  private async dispatchResetEmail(
    userId: string,
    to: string,
    resetLink: string,
  ): Promise<void> {
    try {
      await this.emailSender.sendPasswordResetEmail(to, resetLink);
    } catch (error: unknown) {
      // The cause is the whole diagnostic value here — an invalid API key, an
      // unverified sender domain and a quota trip are otherwise indistinguishable
      // when resets "just stop arriving". Never the key or the link itself.
      this.logger.error(
        `password reset email dispatch failed for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Validates a reset token and, if valid, updates the password hash and marks
   * the token used in one transaction.
   *
   * The "already used" check is the conditional `updateMany` *inside* the
   * transaction, not the read above it: checking a value read beforehand would
   * let two concurrent requests carrying the same still-valid token both pass
   * and both write a password. Zero affected rows means another request won.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = sha256Hex(token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    // Cheap pre-check so an unknown/stale token never reaches bcrypt or a
    // transaction. Identical message for all causes (AC 3 — no distinction).
    if (
      record === null ||
      record.usedAt !== null ||
      record.expiresAt < new Date()
    ) {
      throw new UnprocessableEntityException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new UnprocessableEntityException(
          'Invalid or expired reset token',
        );
      }

      // Any other outstanding link for this user dies with the one just spent —
      // otherwise a previously-requested link keeps working after recovery.
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      });

      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
    });

    // A password reset is exactly the moment a stale/possibly-compromised
    // refresh session should not silently continue. The already-issued access
    // token still works until its own short TTL expires (same limitation as
    // logout) — revoking that needs a check the JwtAuthGuard does not do.
    try {
      await this.redis.client.del(refreshRedisKey(record.userId));
    } catch (error: unknown) {
      // The password is already committed; failing the request here would tell
      // the user their link was invalid while their new password in fact works.
      this.logger.error(
        `failed to revoke refresh session after password reset for user ${record.userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
