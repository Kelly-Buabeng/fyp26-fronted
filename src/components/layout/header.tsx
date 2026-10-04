'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useConsole, useHealth } from './providers';
import { c } from '@/lib/styles';
const pages = [
  ['/', 'Live map'],
  ['/dashboard', 'Dashboard'],
  ['/report', 'Regional report'],
  ['/detections', 'Detections'],
  ['/detect', 'Run detection'],
  ['/devices', 'Devices'],
] as const;
export function Header() {
  const path = usePathname();
  const state = useConsole();
  const health = useHealth();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={c('topbar')}>
        <Link href="/" className={c('wordmark')}>
          <b>Roadwatch</b>
          <span>Ghana</span>
        </Link>
        <nav className={c('tabs')} aria-label="Main navigation">
          {pages
            .filter(([url]) => state.role === 'gha' || !['/detections', '/devices'].includes(url))
            .map(([url, label]) => (
              <Link
                key={url}
                href={url}
                className={c('tab')}
                aria-current={path === url ? 'page' : undefined}
              >
                {url === '/detect' && state.role === 'public' ? 'Report a pothole' : label}
              </Link>
            ))}
        </nav>
        <div className={c('bar-right')}>
          <div className={c('status')}>
            <span className={c('dot', !health.data?.pothole_model_ready && 'dot-warning')} />
            <span>
              {health.error
                ? 'Backend offline'
                : !health.data
                  ? 'Checking model'
                  : health.data.pothole_model_ready
                    ? 'Model ready'
                    : 'Model unavailable'}
            </span>
          </div>
          <div className={c('seg')} aria-label="Console view">
            {(['gha', 'public'] as const).map((role) => (
              <button
                key={role}
                aria-pressed={state.role === role}
                onClick={() => state.setRole(role)}
              >
                {role === 'gha' ? 'GHA' : 'Public'}
              </button>
            ))}
          </div>
          <div className={c('seg')} aria-label="Display density">
            {(['comfortable', 'dense'] as const).map((d) => (
              <button
                key={d}
                aria-pressed={state.density === d}
                onClick={() => state.setDensity(d)}
              >
                {d === 'dense' ? 'Dense' : 'Calm'}
              </button>
            ))}
          </div>
          {state.role === 'gha' && (
            <button
              className={c('btn quiet login-button')}
              onClick={() => (state.admin ? void state.logout() : state.openLogin())}
            >
              {state.admin ? 'Sign out' : 'Sign in'}
            </button>
          )}
        </div>
      </header>
    </>
  );
}
export function Footer() {
  return (
    <footer className={c('footer')}>
      <span>Roadwatch · Ghana road intelligence</span>
      <a
        href="https://github.com/Kelly-Buabeng/FYP-26-POTHOLE-DETECTION"
        target="_blank"
        rel="noreferrer"
      >
        FYP-26 backend
      </a>
    </footer>
  );
}
