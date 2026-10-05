import { ProtectedRoute } from '../../components/auth/protected-route';
import { DetectionsTable } from '../../components/features/detections/detections-table';

export const metadata = { title: 'Detections' };

export default function Page() {
  return (
    <ProtectedRoute
      title="Detections Management"
      description="Sign in with your authority credentials to review saved detections, export datasets, and delete false positives."
    >
      <DetectionsTable />
    </ProtectedRoute>
  );
}
