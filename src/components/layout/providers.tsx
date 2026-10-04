'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useSWR, { SWRConfig, useSWRConfig } from 'swr';
import { getHealth, getStats, getStorageMode } from '@/lib/api/client';
import { parseApiError, errorMessage } from '@/lib/api/errors';
import { AUTHORITY_PATHS, authorityDestination } from '@/lib/access';
import { c } from '@/lib/styles';
import { Loading } from '@/components/ui/primitives';

type ContextValue = {
  role: 'gha' | 'public';
  density: 'comfortable' | 'dense';
  setDensity: (value: 'comfortable' | 'dense') => void;
  admin: boolean;
  openLogin: (destination?: string) => void;
  logout: () => Promise<void>;
  toast: (message: string, kind?: 'success' | 'error') => void;
};
const Context = createContext<ContextValue | null>(null);
export function useConsole() {
  const value = useContext(Context);
  if (!value) throw new Error('Console provider missing.');
  return value;
}
export const useHealth = () => useSWR('health', getHealth, { refreshInterval: 30000 });
export const useStorageMode = () => useSWR('mode', getStorageMode, { refreshInterval: 30000 });
export function useStats() {
  const { admin } = useConsole();
  return useSWR(admin ? 'stats' : null, getStats, { refreshInterval: 30000 });
}
async function fetchSession() {
  const response = await fetch('/api/auth', { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw parseApiError(data, response.status);
  return data as { admin: boolean; enabled: boolean };
}
export const useAuthoritySession = () =>
  useSWR('session', fetchSession, { refreshInterval: 30000 });
function ConsoleProvider({
  children,
  initialAdmin,
}: {
  children: ReactNode;
  initialAdmin: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useSWRConfig();
  const [density, setDensity] = useState<'comfortable' | 'dense'>('comfortable');
  const session = useSWR('session', fetchSession, {
    fallbackData: { admin: initialAdmin, enabled: true },
    refreshInterval: 30000,
  });
  const admin = session.data?.admin ?? false;
  const protectedPage = AUTHORITY_PATHS.some((path) => path === pathname);
  const [toasts, setToasts] = useState<{ id: number; message: string; kind: string }[]>([]);
  useEffect(() => {
    if (protectedPage && !admin)
      router.replace('/login?next=' + encodeURIComponent(authorityDestination(pathname)));
  }, [admin, protectedPage, pathname, router]);
  function toast(message: string, kind = 'success') {
    const id = Date.now() + Math.random();
    setToasts((old) => [...old.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts((old) => old.filter((item) => item.id !== id)), 6500);
  }
  async function logout() {
    try {
      const response = await fetch('/api/auth', { method: 'DELETE' });
      if (!response.ok) throw parseApiError(await response.json(), response.status);
      await session.mutate(
        { admin: false, enabled: session.data?.enabled ?? true },
        { revalidate: false },
      );
      await mutate((key) => key !== 'session' && key !== 'health' && key !== 'mode', undefined, {
        revalidate: false,
      });
      router.replace('/');
      router.refresh();
      toast('Signed out.');
    } catch (error) {
      toast(errorMessage(error), 'error');
    }
  }
  return (
    <Context.Provider
      value={{
        role: admin ? 'gha' : 'public',
        density,
        setDensity,
        admin,
        openLogin: (destination) =>
          router.push(
            '/login?next=' + encodeURIComponent(authorityDestination(destination ?? pathname)),
          ),
        logout,
        toast,
      }}
    >
      <div className={c('shell')} data-density={density}>
        {protectedPage && !admin ? <Loading label="Redirecting to authority sign in…" /> : children}
        <div className={c('toasts')} aria-live="polite" aria-atomic="false">
          {toasts.map((item) => (
            <div key={item.id} className={c('toast', item.kind === 'error' && 'toast-error')}>
              <span>{item.message}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setToasts((old) => old.filter((value) => value.id !== item.id))}
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
export function Providers({
  children,
  initialAdmin = false,
}: {
  children: ReactNode;
  initialAdmin?: boolean;
}) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        errorRetryCount: 2,
        shouldRetryOnError: (error) => ![400, 401, 403, 413, 422, 429, 503].includes(error?.status),
      }}
    >
      <ConsoleProvider initialAdmin={initialAdmin}>{children}</ConsoleProvider>
    </SWRConfig>
  );
}
