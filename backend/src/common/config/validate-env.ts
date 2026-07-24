/**
 * Boot-time environment validation (Epic 1 retrospective, action item P1).
 *
 * Fails fast at startup so a missing/blank required var or a present-but-malformed
 * numeric crashes when the process boots — not later, as a wrong result on a
 * request path (retro Pattern 2: `?? DEFAULT` only guards `undefined`, and
 * `ConfigService.get<number>` is a compile-time-only cast). Wired into
 * `ConfigModule.forRoot({ validate })` in `app.module.ts`, so it runs on the real
 * HTTP (`main.ts`) and worker (`worker.ts`) boots only — the e2e specs call their
 * own `ConfigModule.forRoot` without this validator, so they are unaffected.
 *
 * Policy — deliberately conservative to preserve `docker compose up` on a fresh
 * clone, where compose's `env_file: .env` is `required: false`:
 *
 *   - REQUIRED (must be present and non-blank): the infra values compose always
 *     sets in its `environment:` block — DATABASE_URL, REDIS_URL, RABBITMQ_URL,
 *     NODE_ENV. These cannot be defaulted and the process cannot work without them.
 *
 *   - FORMAT-CHECKED WHEN PRESENT: numeric vars must parse to a positive integer
 *     if set; a blank or non-numeric value fails at boot. An ABSENT numeric is
 *     allowed — the code's documented fallback (getPositiveIntConfig) applies.
 *     This is what makes `PASSWORD_RESET_TOKEN_TTL_MINUTES=` (blank) crash at
 *     startup instead of silently minting already-expired reset links.
 *
 *   - NOT validated here: secrets (JWT_SECRET, JWT_REFRESH_SECRET, GEMINI_API_KEY,
 *     EMAIL_PROVIDER_API_KEY) arrive from the optional `.env`. Requiring them would
 *     break the fresh-clone boot compose explicitly protects, so they fail loudly
 *     at first use instead. Tighten this behind a production profile at Epic 6.
 *
 * Add Epic 2's remaining numeric vars (AI_PARSE_RATE_LIMIT_*) to NUMERIC_VARS
 * as their stories land. EXAM_PDF_MAX_BYTES is already covered below.
 */

const REQUIRED_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'RABBITMQ_URL',
  'NODE_ENV',
] as const;

const NUMERIC_VARS = [
  'LOGIN_RATE_LIMIT_WINDOW_SECONDS',
  'LOGIN_RATE_LIMIT_IP_MAX',
  'LOGIN_RATE_LIMIT_ACCOUNT_MAX',
  'PASSWORD_RESET_TOKEN_TTL_MINUTES',
  'EXAM_PDF_MAX_BYTES',
  'AI_PARSE_RATE_LIMIT_WINDOW_SECONDS',
  'AI_PARSE_RATE_LIMIT_MAX',
] as const;

// Optional string vars where blank (not just absent) must still fail at boot —
// same "present-but-blank" guard as NUMERIC_VARS, for a var that isn't numeric.
const NON_BLANK_IF_PRESENT_VARS = ['STORAGE_ROOT'] as const;

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

function isPositiveInteger(value: string): boolean {
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (isBlank(config[key])) {
      errors.push(`${key} is required but missing or blank`);
    }
  }

  for (const key of NUMERIC_VARS) {
    const raw = config[key];
    // Absent is allowed — the runtime fallback covers it. Only a value that is
    // present (the key exists) but blank or non-numeric is a boot error.
    if (key in config && !isPositiveInteger(String(raw))) {
      errors.push(
        `${key} must be a positive integer, got ${JSON.stringify(raw)}`,
      );
    }
  }

  for (const key of NON_BLANK_IF_PRESENT_VARS) {
    // Same "absent is fine, blank is not" rule as NUMERIC_VARS above — a
    // present-but-blank STORAGE_ROOT would otherwise slip past `?? DEFAULT`
    // in LocalFileStorageService and silently resolve to process.cwd().
    if (key in config && isBlank(config[key])) {
      errors.push(`${key} is present but blank`);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${errors.join('\n  - ')}`,
    );
  }

  return config;
}
