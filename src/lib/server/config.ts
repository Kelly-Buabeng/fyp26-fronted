import 'server-only';
export function getConfig() {
  const production = process.env.NODE_ENV === 'production';
  const apiUrl = new URL(process.env.BACKEND_API_URL || 'http://127.0.0.1:8000');
  if (
    !['http:', 'https:'].includes(apiUrl.protocol) ||
    apiUrl.username ||
    apiUrl.password ||
    apiUrl.search ||
    apiUrl.hash
  )
    throw new Error('Invalid BACKEND_API_URL.');
  const apiKey = process.env.BACKEND_API_KEY?.trim() || '';
  const password = process.env.ADMIN_PASSWORD || '';
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const secret = process.env.SESSION_SECRET || '';
  const origin = process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).origin : '';
  const timeout = Number(process.env.BACKEND_TIMEOUT_MS || 120000);
  if (!Number.isFinite(timeout) || timeout < 1000 || timeout > 170000)
    throw new Error('BACKEND_TIMEOUT_MS must be between 1000 and 170000.');
  if (
    production &&
    (!apiKey ||
      apiKey === 'change-this-in-production' ||
      !validEmail ||
      password.length < 12 ||
      secret.length < 32 ||
      !origin.startsWith('https://'))
  )
    throw new Error(
      'Production configuration requires a backend key, ADMIN_EMAIL, ADMIN_PASSWORD (12+ characters), SESSION_SECRET (32+ characters), and HTTPS APP_ORIGIN.',
    );
  return {
    production,
    apiUrl: apiUrl.toString().replace(/\/$/, ''),
    apiKey,
    password,
    email,
    secret,
    origin,
    timeout,
    adminEnabled: validEmail && password.length >= 12 && secret.length >= 32,
  };
}
