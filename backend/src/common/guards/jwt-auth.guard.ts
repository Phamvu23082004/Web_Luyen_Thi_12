import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type {
  AuthenticatedRequest,
  AuthUser,
} from '../types/authenticated-request';

/**
 * Global authentication guard (registered first — see app.module.ts). Verifies
 * the Bearer **access** token statelessly (no store hit) and attaches the
 * `{ sub, role }` payload to `request.user` for downstream guards/handlers.
 *
 * Hand-rolled via `JwtService` (no `@nestjs/passport`) — continues Story 1.5's
 * pattern. Only checks access tokens: it verifies with `JWT_SECRET`, so a refresh
 * token (signed with `JWT_REFRESH_SECRET`) naturally fails here — no special-casing.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Unauthorized');
    }

    let payload: AuthUser;
    try {
      payload = await this.jwt.verifyAsync<AuthUser>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
    } catch {
      // Any failure (bad signature, expired, malformed) rejects identically —
      // never reveal *why* verification failed. Single-cause 401, no errorCode.
      throw new UnauthorizedException('Unauthorized');
    }

    request.user = { sub: payload.sub, role: payload.role };
    return true;
  }

  private extractBearerToken(header: string | undefined): string | null {
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    return scheme === 'Bearer' && token ? token : null;
  }
}
