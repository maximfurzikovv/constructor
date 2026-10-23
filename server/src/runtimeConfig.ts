const INSECURE_PRODUCTION_SECRETS = new Set([
  'local-development-secret-change-me',
  'local-docker-secret-change-before-production',
  'test-secret',
  'replace-with-long-random-secret',
]);

// Останавливает production до открытия порта, если обязательные настройки небезопасны.
export function validateRuntimeConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const jwtSecret = process.env.JWT_SECRET?.trim();
  const errors: string[] = [];

  if (!databaseUrl) errors.push('DATABASE_URL is required');
  if (!jwtSecret || jwtSecret.length < 32 || INSECURE_PRODUCTION_SECRETS.has(jwtSecret)) {
    errors.push('JWT_SECRET must be a unique random value of at least 32 characters');
  }

  if (errors.length > 0) {
    throw new Error(`Unsafe production configuration: ${errors.join('; ')}`);
  }
}
