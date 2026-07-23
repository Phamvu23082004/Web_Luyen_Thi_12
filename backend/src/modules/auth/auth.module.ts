import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '../../common/redis/redis.module';
import { LoginRateLimitGuard } from '../../common/guards/login-rate-limit.guard';
import { SlidingWindowRateLimiterService } from '../../common/rate-limit/sliding-window-rate-limiter.service';
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
  providers: [
    AuthService,
    SlidingWindowRateLimiterService,
    LoginRateLimitGuard,
  ],
})
export class AuthModule {}
