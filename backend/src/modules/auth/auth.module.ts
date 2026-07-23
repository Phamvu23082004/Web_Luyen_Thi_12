import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '../../common/redis/redis.module';
import { LoginRateLimitGuard } from '../../common/guards/login-rate-limit.guard';
import { SlidingWindowRateLimiterService } from '../../common/rate-limit/sliding-window-rate-limiter.service';
import { EMAIL_SENDER } from '../../common/email/email-sender';
import { ResendEmailSenderService } from '../../common/email/resend-email-sender.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  // Registered with no module-level default secret/expiry — access and refresh
  // tokens use different secrets, so AuthService passes them explicitly per call.
  imports: [JwtModule.register({}), RedisModule],
  controllers: [AuthController],
  // The limiter service lives in common/ (Story 2.1 reuses it for the
  // AI-parse-enqueue window); only the login guard is wired here, and only as a
  // route-scoped provider — never an APP_GUARD.
  // EMAIL_SENDER wired here (not a shared EmailModule) — only `auth` uses it
  // in this story; promote to its own module only if a second consumer appears.
  providers: [
    AuthService,
    SlidingWindowRateLimiterService,
    LoginRateLimitGuard,
    { provide: EMAIL_SENDER, useClass: ResendEmailSenderService },
  ],
})
export class AuthModule {}
