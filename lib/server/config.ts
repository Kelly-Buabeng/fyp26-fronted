import 'server-only';

export function getConfig() {
  const production = process.env.NODE_ENV === 'production';
  const apiUrl = new URL(process.env.BACKEND_API_URL || 'https://backend.metaaideconsult.com');
  if (
    !['http:', 'https:'].includes(apiUrl.protocol) ||
    apiUrl.username ||
    apiUrl.password ||
    apiUrl.search ||
    apiUrl.hash
  )
    throw new Error('Invalid BACKEND_API_URL.');

  const apiKey = (process.env.BACKEND_API_KEY || 'sEWtrLo7fxaNhuiHlHfYNriufd5wWPFyPpCx_-1vCK4').trim();
  const password = process.env.ADMIN_PASSWORD || 'Password123##';
  const email = (process.env.ADMIN_EMAIL || 'authority@rha.com').trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const secret = process.env.SESSION_SECRET || 'e7b4a29c1d8f3e5a0b6c4d2e8f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a';
  const origin = process.env.APP_ORIGIN || 'https://fyp26-fronted.vercel.app';
  const timeout = Number(process.env.BACKEND_TIMEOUT_MS || 120000);

  if (!Number.isFinite(timeout) || timeout < 1000 || timeout > 170000)
    throw new Error('BACKEND_TIMEOUT_MS must be between 1000 and 170000.');

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
