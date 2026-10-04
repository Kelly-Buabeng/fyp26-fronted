import { DevicesHealth } from '@/components/features/devices/devices-health';
import { requireAuthority } from '@/lib/server/auth';
export const metadata = { title: 'Devices & model health' };
export default async function Page() {
  await requireAuthority('/devices');
  return <DevicesHealth />;
}
