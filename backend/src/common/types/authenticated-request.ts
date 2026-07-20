import type { Request } from 'express';
import type { Role } from '../../../generated/prisma/client';

/**
 * The verified access-token claim, kept verbatim — `sub` is the user id, `role`
 * the DB enum value. This is the single typed contract for `request.user`:
 * `JwtAuthGuard` writes it, `RolesGuard` / `@CurrentUser()` / every future
 * protected handler read it. No remap to `{ userId }` — handlers read `req.user.sub`.
 */
export interface AuthUser {
  sub: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
