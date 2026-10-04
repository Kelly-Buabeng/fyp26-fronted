'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import useSWR, { SWRConfig } from 'swr';
import { getHealth, getStats } from '@/lib/api/client';
import { parseApiError, errorMessage } from '@/lib/api/errors';
import { c } from '@/lib/styles';
import { Dialog, ErrorState } from '@/components/ui/primitives';

type ContextValue = {
  role: 'gha' | 'public';
  setRole: (v: 'gha' | 'public') => void;
  density: 'comfortable' | 'dense';
  setDensity: (v: 'comfortable' | 'dense') => void;
  admin: boolean;
  openLogin: () => void;
  logout: () => Promise<void>;
  toast: (message: string, kind?: 'success' | 'error') => void;
};
const Context = createContext<ContextValue | null>(null);
export const useConsole = () => {
  const value = useContext(Context);
  if (!value) throw new Error('Console provider missing.');
  return value;
};
export const useHealth = () => useSWR('health', getHealth, { refreshInterval: 30000 });
export const useStats = () => useSWR('stats', getStats, { refreshInterval: 30000 });
async function fetchSession() {
  const response = await fetch('/api/auth', { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw parseApiError(data, response.status);
  return data as { admin: boolean; enabled: boolean };
}
function ConsoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<'gha' | 'public'>('gha');
  const [density, setDensity] = useState<'comfortable' | 'dense'>('comfortable');
  const session = useSWR('session', fetchSession);
  const [loginOpen, setLoginOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; message: string; kind: string }[]>([]);
  function toast(message: string, kind = 'success') {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6500);
  }
  async function logout() {
    try {
      const response = await fetch('/api/auth', { method: 'DELETE' });
      if (!response.ok) throw parseApiError(await response.json(), response.status);
      await session.mutate({ admin: false, enabled: session.data?.enabled ?? true });
      setRole('public');
      toast('Signed out.');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }
  return (
    <Context.Provider
      value={{
        role,
        setRole,
        density,
        setDensity,
        admin: session.data?.admin ?? false,
        openLogin: () => {
          setLoginError('');
          setPassword('');
          setLoginOpen(true);
        },
        logout,
        toast,
      }}
    >
      <div className={c('shell')} data-density={density}>
        {children}
        <Dialog
          open={loginOpen}
          onClose={() => {
            if (!busy) setLoginOpen(false);
          }}
          label="GHA access"
        >
          <div className={c('panel-head')}>
            <h2>GHA access</h2>
            <button
              className={c('x')}
              aria-label="Close sign in"
              onClick={() => setLoginOpen(false)}
            >
              ×
            </button>
          </div>
          <form
            className={c('panel-body form-stack')}
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setLoginError('');
              try {
                const response = await fetch('/api/auth', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password }),
                });
                const data = await response.json();
                if (!response.ok) throw parseApiError(data, response.status);
                await session.mutate({ admin: true, enabled: true });
                setPassword('');
                setLoginOpen(false);
                setRole('gha');
                toast('GHA access enabled.');
              } catch (error) {
                setLoginError(errorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>Sign in to inspect saved records, export data, and remove false positives.</p>
            <div className={c('field')}>
              <label htmlFor="admin-password">Access password</label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            {session.data?.enabled === false && (
              <p className={c('muted')}>GHA access has not been configured by the operator.</p>
            )}
            {loginError && <ErrorState message={loginError} />}
            <button className={c('btn solid')} disabled={busy || !password}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </Dialog>
        <div className={c('toasts')} aria-live="polite" aria-atomic="false">
          {toasts.map((t) => (
            <div key={t.id} className={c('toast', t.kind === 'error' && 'toast-error')}>
              <span>{t.message}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setToasts((old) => old.filter((x) => x.id !== t.id))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </Context.Provider>
  );
}
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        errorRetryCount: 2,
        shouldRetryOnError: (error) => ![400, 401, 403, 413, 422, 429, 503].includes(error?.status),
      }}
    >
      <ConsoleProvider>{children}</ConsoleProvider>
    </SWRConfig>
  );
}
