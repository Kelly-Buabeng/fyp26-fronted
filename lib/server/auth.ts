import 'server-only';
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { getConfig } from './config';
export const COOKIE_NAME = 'roadwatch_session';
const TTL = 8 * 60 * 60;
function sign(payload: string) {
  const c = getConfig();
  return createHmac('sha256', c.secret)
    .update(c.password)
    .update('\0')
    .update(payload)
    .digest('base64url');
}
export function createSessionToken(now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ role: 'gha', exp: Math.floor(now / 1000) + TTL }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function verifySessionToken(token: string, now = Date.now()): boolean {
  if (!getConfig().adminEnabled || token.length > 1024) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return (
      data.role === 'gha' &&
      Number.isSafeInteger(data.exp) &&
      data.exp > Math.floor(now / 1000) &&
      data.exp <= Math.floor(now / 1000) + TTL
    );
  } catch {
    return false;
  }
}
export async function isAdmin() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return !!token && verifySessionToken(token);
}
export function passwordMatches(candidate: string) {
  const configured = getConfig();
  if (!configured.adminEnabled) return false;
  const hash = (v: string) => createHash('sha256').update(v).digest();
  return timingSafeEqual(hash(candidate), hash(configured.password));
}
export async function setSession() {
  (await cookies()).set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: getConfig().production,
    sameSite: 'strict',
    path: '/',
    maxAge: TTL,
  });
}
export async function clearSession() {
  (await cookies()).set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: getConfig().production,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}
export function assertSameOrigin(request: Request) {
  const expected = getConfig().origin || new URL(request.url).origin;
  if (request.headers.get('origin') !== expected)
    throw new HttpError(403, 'Request origin is not allowed.');
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
