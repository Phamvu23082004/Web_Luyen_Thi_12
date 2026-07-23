import { ConfigService } from '@nestjs/config';

/**
 * Reads a positive-integer config value, falling back to `fallback` when the
 * var is absent, blank, or not a valid positive number. `ConfigService.get<number>`
 * is a compile-time-only cast — real env values are strings — so this parses
 * explicitly instead of trusting the generic.
 *
 * Blank matters as much as absent: `PASSWORD_RESET_TOKEN_TTL_MINUTES=` in a .env
 * yields `''`, and `Number('') === 0` would silently produce already-expired
 * tokens (or a zero-length rate-limit window) with no error anywhere.
 */
export function getPositiveIntConfig(
  config: ConfigService,
  key: string,
  fallback: number,
): number {
  const raw = config.get<string | number>(key);
  const parsed = Number(raw);
  return raw !== undefined &&
    raw !== '' &&
    Number.isFinite(parsed) &&
    parsed > 0
    ? parsed
    : fallback;
}
