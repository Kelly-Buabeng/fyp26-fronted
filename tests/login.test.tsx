// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/components/features/auth/login-form';
const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  mutate: vi.fn(),
  toast: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock('@/components/layout/providers', () => ({
  useConsole: () => ({ toast: mocks.toast }),
  useAuthoritySession: () => ({ data: { enabled: true }, mutate: mocks.mutate }),
}));
describe('authority login form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutate.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', mocks.fetch);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it('validates email and password before sending a request', async () => {
    render(<LoginForm destination="/dashboard" />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign in to Roadwatch' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeTruthy();
    expect(screen.getByText('Enter your password.')).toBeTruthy();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('shows rejected credentials and leaves the session unchanged', async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Email or password is incorrect.' }), { status: 401 }),
    );
    render(<LoginForm destination="/report" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), 'wrong@rha.com');
    await user.type(screen.getByLabelText('Password', { exact: true }), 'incorrect');
    await user.click(screen.getByRole('button', { name: 'Sign in to Roadwatch' }));
    expect(await screen.findByText('Email or password is incorrect.')).toBeTruthy();
    expect(mocks.mutate).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Sign in to Roadwatch' }).hasAttribute('disabled'),
    ).toBe(false);
  });
  it('submits email and password, updates the session, and returns to the requested page', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ admin: true })));
    render(<LoginForm destination="/report?min_confidence=0.8" />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), 'authority@rha.com');
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'fixture-authority-password',
    );
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password', { exact: true }).getAttribute('type')).toBe('text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    await user.click(screen.getByRole('button', { name: 'Sign in to Roadwatch' }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/report?min_confidence=0.8'));
    expect(mocks.fetch).toHaveBeenCalledWith(
      '/api/auth',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'authority@rha.com',
          password: 'fixture-authority-password',
        }),
      }),
    );
    expect(mocks.mutate).toHaveBeenCalledWith(
      { admin: true, enabled: true },
      { revalidate: false },
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect((screen.getByLabelText('Password', { exact: true }) as HTMLInputElement).value).toBe('');
  });
});
