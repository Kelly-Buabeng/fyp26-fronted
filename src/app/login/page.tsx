import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/server/auth';
import { authorityDestination } from '@/lib/access';
import { LoginForm } from '@/components/features/auth/login-form';
export const metadata = { title: 'Authority login' };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const query = await searchParams;
  const destination = authorityDestination(query.next);
  if (await isAdmin()) redirect(destination);
  return <LoginForm destination={destination} />;
}
