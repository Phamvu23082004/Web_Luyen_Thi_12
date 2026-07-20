import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../../generated/prisma/client';

/** Metadata key shared with `RolesGuard` — kept here so neither side hard-codes the string. */
export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given roles. Uses the Prisma-generated `Role` enum
 * (values `student`/`teacher`, matching the token claim) so it can never diverge
 * from the DB enum.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
