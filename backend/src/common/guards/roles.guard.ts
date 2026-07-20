import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { Role } from '../../../generated/prisma/client';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Global authorization guard (registered second — after JwtAuthGuard, which has
 * already attached `request.user`). Reads the required roles from `@Roles()` and
 * compares against the role in the verified token only — never a body/query/header
 * (AD-10). Fails closed: any ambiguity throws 403, never falls through to the handler.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // No @Roles() → the route only needs authentication, allow any valid token.
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    // Absent user = guard-order misconfig; fail closed rather than trust nothing.
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Forbidden');
    }
    return true;
  }
}
