import { Dashboard } from '@/components/features/dashboard/dashboard';
import { requireAuthority } from '@/lib/server/auth';
export const metadata = { title: 'Dashboard' };
export default async function Page() {
  await requireAuthority('/dashboard');
  return <Dashboard />;
}
