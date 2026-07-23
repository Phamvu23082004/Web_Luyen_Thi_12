import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService, TokenPair } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { LoginRateLimitGuard } from '../../common/guards/login-rate-limit.guard';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

// Every route here authenticates via the request body (credentials, a refresh
// token, or a reset token) rather than a Bearer access token — @Public() opts
// them out of the global JwtAuthGuard (otherwise login
// would require a token only login can issue: a deadlock). @Public() is applied
// per-method (not class-level) to keep the controller secure-by-default: a future
// authenticated route added here must opt IN to public, never inherit it.
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // login only — never global, must not touch the submission path (AD-19).
  @UseGuards(LoginRateLimitGuard)
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<TokenPair> {
    const user = await this.authService.validateUser(dto.email, dto.password);
    return this.authService.login(user);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto): Promise<TokenPair> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  // No rate-limit guard here (AD-19 names exactly login + AI-parse-enqueue) —
  // the returned message is identical regardless of whether the email exists
  // (AC 2), since requestPasswordReset() never throws or returns a
  // discriminating value.
  //
  // The forgot/reset pages render their own copy rather than this string: they
  // must show the same reassurance even when the request never reached us at
  // all. Keep the wording in sync with frontend/src/features/auth/ so the two
  // layers cannot drift into contradicting each other.
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(dto.email);
    return {
      message:
        'Nếu email tồn tại trong hệ thống, một liên kết đặt lại mật khẩu đã được gửi.',
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Mật khẩu đã được đặt lại thành công.' };
  }
}
