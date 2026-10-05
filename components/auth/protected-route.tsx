'use client';

import { useState, type ReactNode } from 'react';
import { useConsole } from '../layout/providers';
import { c } from '../../lib/styles';
import { Lede, Panel, ErrorState } from '../ui/primitives';
import { parseApiError, errorMessage } from '../../lib/api/errors';
import useSWR from 'swr';

export function ProtectedRoute({
  title = 'Authentication required',
  description = 'Sign in to access this page.',
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  const consoleState = useConsole();
  const { mutate } = useSWR('session');
  const [email, setEmail] = useState('authority@rha.com');
  const [password, setPassword] = useState('Password123##');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (consoleState.admin) {
    return <>{children}</>;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw parseApiError(data, response.status);

      await mutate({ admin: true, enabled: true });
      consoleState.setRole('gha');
      consoleState.toast('Sign in successful.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className={c('band')}>
        <Lede
          eyebrow="Protected Area"
          title={title}
          description={description}
        />
      </section>
      <section className={c('band')}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <Panel title="Sign in to continue">
            <form className={c('form-stack')} onSubmit={handleLogin}>
              <p className={c('muted')}>
                Enter your GHA authority credentials to gain access.
              </p>
              <div className={c('field')}>
                <label htmlFor="protected-email">Email Address</label>
                <input
                  id="protected-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="authority@rha.com"
                  required
                  disabled={busy}
                />
              </div>
              <div className={c('field')}>
                <label htmlFor="protected-password">Password</label>
                <input
                  id="protected-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password123##"
                  required
                  disabled={busy}
                />
              </div>
              {error && <ErrorState message={error} />}
              <button
                type="submit"
                className={c('btn solid')}
                disabled={busy || !email || !password}
                style={{ marginTop: '8px' }}
              >
                {busy ? 'Authenticating...' : 'Sign in to access page'}
              </button>
            </form>
          </Panel>
        </div>
      </section>
    </>
  );
}
