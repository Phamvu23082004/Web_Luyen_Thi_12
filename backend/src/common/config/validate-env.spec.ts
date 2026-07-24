import { validateEnv } from './validate-env';

// A minimal valid environment: every REQUIRED var present and non-blank, no
// numeric vars set (they are optional). Each test overrides one field.
function baseEnv(): Record<string, unknown> {
  return {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    RABBITMQ_URL: 'amqp://guest:guest@localhost:5672',
    NODE_ENV: 'development',
  };
}

describe('validateEnv', () => {
  it('returns the config unchanged when every required var is present', () => {
    const env = baseEnv();
    expect(validateEnv(env)).toBe(env);
  });

  describe('required vars', () => {
    it.each(['DATABASE_URL', 'REDIS_URL', 'RABBITMQ_URL', 'NODE_ENV'])(
      'throws when %s is absent',
      (key) => {
        const env = baseEnv();
        delete env[key];
        expect(() => validateEnv(env)).toThrow(key);
      },
    );

    it('throws when a required var is blank (the retro scenario)', () => {
      const env = { ...baseEnv(), DATABASE_URL: '   ' };
      expect(() => validateEnv(env)).toThrow('DATABASE_URL');
    });

    it('aggregates every failure into one message', () => {
      const env = baseEnv();
      delete env.REDIS_URL;
      delete env.RABBITMQ_URL;
      expect(() => validateEnv(env)).toThrow(/REDIS_URL[\s\S]*RABBITMQ_URL/);
    });
  });

  describe('numeric vars', () => {
    it('accepts an absent numeric var (fallback applies at runtime)', () => {
      const env = baseEnv();
      expect('PASSWORD_RESET_TOKEN_TTL_MINUTES' in env).toBe(false);
      expect(() => validateEnv(env)).not.toThrow();
    });

    it('throws on a present-but-blank numeric var', () => {
      const env = { ...baseEnv(), PASSWORD_RESET_TOKEN_TTL_MINUTES: '' };
      expect(() => validateEnv(env)).toThrow(
        'PASSWORD_RESET_TOKEN_TTL_MINUTES',
      );
    });

    it('throws on a non-numeric value', () => {
      const env = { ...baseEnv(), LOGIN_RATE_LIMIT_IP_MAX: 'thirty' };
      expect(() => validateEnv(env)).toThrow('LOGIN_RATE_LIMIT_IP_MAX');
    });

    it('throws on zero and on a negative value', () => {
      expect(() =>
        validateEnv({ ...baseEnv(), LOGIN_RATE_LIMIT_ACCOUNT_MAX: '0' }),
      ).toThrow('LOGIN_RATE_LIMIT_ACCOUNT_MAX');
      expect(() =>
        validateEnv({ ...baseEnv(), LOGIN_RATE_LIMIT_WINDOW_SECONDS: '-5' }),
      ).toThrow('LOGIN_RATE_LIMIT_WINDOW_SECONDS');
    });

    it('accepts a valid positive integer', () => {
      const env = { ...baseEnv(), PASSWORD_RESET_TOKEN_TTL_MINUTES: '30' };
      expect(() => validateEnv(env)).not.toThrow();
    });

    it('rejects a non-integer numeric', () => {
      const env = { ...baseEnv(), LOGIN_RATE_LIMIT_IP_MAX: '3.5' };
      expect(() => validateEnv(env)).toThrow('LOGIN_RATE_LIMIT_IP_MAX');
    });

    it('format-checks EXAM_PDF_MAX_BYTES when present (Story 2.1a)', () => {
      expect(() =>
        validateEnv({ ...baseEnv(), EXAM_PDF_MAX_BYTES: '' }),
      ).toThrow('EXAM_PDF_MAX_BYTES');
      expect(() =>
        validateEnv({ ...baseEnv(), EXAM_PDF_MAX_BYTES: '20971520' }),
      ).not.toThrow();
    });
  });

  describe('non-blank-if-present vars', () => {
    it('accepts an absent STORAGE_ROOT (fallback applies at runtime)', () => {
      const env = baseEnv();
      expect('STORAGE_ROOT' in env).toBe(false);
      expect(() => validateEnv(env)).not.toThrow();
    });

    it('throws on a present-but-blank STORAGE_ROOT (Story 2.1a)', () => {
      const env = { ...baseEnv(), STORAGE_ROOT: '   ' };
      expect(() => validateEnv(env)).toThrow('STORAGE_ROOT');
    });

    it('accepts a non-blank STORAGE_ROOT', () => {
      const env = { ...baseEnv(), STORAGE_ROOT: './storage' };
      expect(() => validateEnv(env)).not.toThrow();
    });
  });
});
