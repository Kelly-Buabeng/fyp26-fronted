import { DetectionsTable } from '@/components/features/detections/detections-table';
import { requireAuthority } from '@/lib/server/auth';
export const metadata = { title: 'Detections' };
export default async function Page() {
  await requireAuthority('/detections');
  return <DetectionsTable />;
}
