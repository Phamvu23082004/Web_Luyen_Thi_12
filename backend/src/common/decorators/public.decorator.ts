import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key lives here (not a magic string) so `JwtAuthGuard` imports the
 * same constant — no drift between the decorator and the guard that reads it.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route out of the global `JwtAuthGuard` (login, refresh, logout, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
