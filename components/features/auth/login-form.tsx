'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthoritySession, useConsole } from '@/components/layout/providers';
import { ErrorState, Notice } from '@/components/ui/primitives';
import { errorMessage, parseApiError } from '@/lib/api/errors';
import { authorityDestination } from '@/lib/access';
import { c } from '@/lib/styles';
const schema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.').max(200, 'Password is too long.'),
});
type Values = z.infer<typeof schema>;
export function LoginForm({ destination }: { destination: string }) {
  const router = useRouter();
  const session = useAuthoritySession();
  const { toast } = useConsole();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });
  async function login(values: Values) {
    setError('');
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) throw parseApiError(data, response.status);
      await session.mutate({ admin: true, enabled: true }, { revalidate: false });
      form.resetField('password');
      toast('Welcome to the authority workspace.');
      router.replace(authorityDestination(destination));
      router.refresh();
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  const busy = form.formState.isSubmitting;
  return (
    <section className={c('band login-band')}>
      <div className={c('login-grid')}>
        <div className={c('login-story')}>
          <div className={c('eyebrow')}>Roads & Highway Authority</div>
          <h1>A clearer view of Ghana’s roads.</h1>
          <p>
            Sign in to your Roadwatch workspace to review detections, understand regional
            conditions, and manage road intelligence.
          </p>
          <div className={c('login-benefits')}>
            <span>
              <i /> Detection review
            </span>
            <span>
              <i /> Regional intelligence
            </span>
            <span>
              <i /> Data & exports
            </span>
          </div>
          <Link href="/" className={c('login-back')}>
            ← Back to the live map
          </Link>
        </div>
        <div className={c('panel login-panel')}>
          <div className={c('panel-head')}>
            <h2>Personnel sign in</h2>
            <span className={c('tag neutral push-right')}>RHA access</span>
          </div>
          <div className={c('panel-body')}>
            <h2 className={c('login-title')}>Welcome back.</h2>
            <p className={c('muted')}>Use your authority email and password to continue.</p>
            <form
              className={c('form-stack login-fields')}
              onSubmit={form.handleSubmit(login)}
              noValidate
            >
              <div className={c('field')}>
                <label htmlFor="authority-email">Email address</label>
                <input
                  id="authority-email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@rha.com"
                  disabled={busy}
                  aria-invalid={!!form.formState.errors.email}
                  aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
                  {...form.register('email')}
                />
                {form.formState.errors.email && (
                  <span id="email-error" className={c('field-error')} role="alert">
                    {form.formState.errors.email.message}
                  </span>
                )}
              </div>
              <div className={c('field')}>
                <label htmlFor="authority-password">Password</label>
                <div className={c('password-field')}>
                  <input
                    id="authority-password"
                    type={visible ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    disabled={busy}
                    aria-invalid={!!form.formState.errors.password}
                    aria-describedby={form.formState.errors.password ? 'password-error' : undefined}
                    {...form.register('password')}
                  />
                  <button
                    type="button"
                    className={c('password-toggle')}
                    onClick={() => setVisible((value) => !value)}
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    aria-pressed={visible}
                  >
                    {visible ? 'Hide' : 'Show'}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <span id="password-error" className={c('field-error')} role="alert">
                    {form.formState.errors.password.message}
                  </span>
                )}
              </div>
              {error && <ErrorState message={error} />}
              {session.data?.enabled === false && (
                <Notice label="Access unavailable">
                  Authority access has not been configured. Contact your Roadwatch operator.
                </Notice>
              )}
              <button className={c('btn solid login-submit')} disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in to Roadwatch'}
              </button>
              <p className={c('login-caption')}>
                Authority personnel only. Public pothole reporting is available without signing in.
              </p>
              <Link href="/detect" className={c('login-public-link')}>
                Report a pothole instead →
              </Link>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
