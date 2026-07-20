import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type {
  AuthenticatedRequest,
  AuthUser,
} from '../types/authenticated-request';

/**
 * Injects the verified `request.user` (written by `JwtAuthGuard`) into a handler
 * param — the read-side of the auth contract, so handlers never re-decode the token.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
