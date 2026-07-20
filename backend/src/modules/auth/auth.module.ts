import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from '../../common/redis/redis.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  // Registered with no module-level default secret/expiry — access and refresh
  // tokens use different secrets, so AuthService passes them explicitly per call.
  imports: [JwtModule.register({}), RedisModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
