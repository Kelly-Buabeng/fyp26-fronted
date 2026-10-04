import { RegionalReport } from '@/components/features/reports/regional-report';
import { requireAuthority } from '@/lib/server/auth';
export const metadata = { title: 'Regional report' };
export default async function Page() {
  await requireAuthority('/report');
  return <RegionalReport />;
}
