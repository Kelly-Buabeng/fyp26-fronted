import 'server-only';

export function getConfig() {
  const production = true;
  const apiUrl = new URL('https://fyp-26-pothole-detection-production.up.railway.app');

  const apiKey = 'sEWtrLo7fxaNhuiHlHfYNriufd5wWPFyPpCx_-1vCK4';
  const password = 'Password123##';
  const email = 'authority@rha.com';
  const secret = 'e7b4a29c1d8f3e5a0b6c4d2e8f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a';
  const origin = '';
  const timeout = 120000;

  return {
    production,
    apiUrl: apiUrl.toString().replace(/\/$/, ''),
    apiKey,
    password,
    email,
    secret,
    origin,
    timeout,
    adminEnabled: true,
  };
}
