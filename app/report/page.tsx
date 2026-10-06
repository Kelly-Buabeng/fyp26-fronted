import { ProtectedRoute } from '../../components/auth/protected-route';
import { RegionalReport } from '../../components/features/reports/regional-report';

export const metadata = { title: 'Regional report' };

export default function Page() {
  return (
    <ProtectedRoute
      title="Regional Intelligence Report"
      description="Sign in with your authority credentials to review regional breakdown tables, confidence thresholds, and export reports."
    >
      <RegionalReport />
    </ProtectedRoute>
  );
}
