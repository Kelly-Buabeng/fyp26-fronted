import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertSameOrigin,
  createSessionToken,
  passwordMatches,
  verifySessionToken,
} from '@/lib/server/auth';
import { getConfig } from '@/lib/server/config';
describe('GHA access controls', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('ADMIN_PASSWORD', 'fixture-admin-password');
    vi.stubEnv('SESSION_SECRET', 'fixture-session-secret-at-least-32-characters');
    vi.stubEnv('APP_ORIGIN', 'http://localhost:3000');
  });
  it('accepts valid sessions and rejects expired, tampered, and malformed tokens', () => {
    const now = Date.now();
    const token = createSessionToken(now);
    expect(verifySessionToken(token, now)).toBe(true);
    expect(verifySessionToken(token, now + 8 * 60 * 60 * 1000)).toBe(false);
    expect(verifySessionToken(token + 'x', now)).toBe(false);
    expect(verifySessionToken('not-a-session', now)).toBe(false);
  });
  it('revokes sessions when the admin password changes', () => {
    const token = createSessionToken();
    vi.stubEnv('ADMIN_PASSWORD', 'changed-password-for-admin');
    expect(verifySessionToken(token)).toBe(false);
  });
  it('compares passwords and disables unconfigured admin access', () => {
    expect(passwordMatches('fixture-admin-password')).toBe(true);
    expect(passwordMatches('wrong')).toBe(false);
    vi.stubEnv('SESSION_SECRET', '');
    expect(passwordMatches('fixture-admin-password')).toBe(false);
  });
  it('blocks missing or cross-origin mutation requests', () => {
    expect(() =>
      assertSameOrigin(
        new Request('http://localhost:3000/api/auth', {
          headers: { origin: 'https://attacker.example' },
        }),
      ),
    ).toThrow('origin');
    expect(() => assertSameOrigin(new Request('http://localhost:3000/api/auth'))).toThrow('origin');
    expect(() =>
      assertSameOrigin(
        new Request('http://localhost:3000/api/auth', {
          headers: { origin: 'http://localhost:3000' },
        }),
      ),
    ).not.toThrow();
  });
  it('refuses insecure production configuration', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BACKEND_API_KEY', '');
    expect(() => getConfig()).toThrow('Production configuration');
  });
});
