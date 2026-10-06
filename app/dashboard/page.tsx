import { ProtectedRoute } from '../../components/auth/protected-route';
import { Dashboard } from '../../components/features/dashboard/dashboard';

export const metadata = { title: 'Dashboard' };

export default function Page() {
  return (
    <ProtectedRoute
      title="Road Intelligence Dashboard"
      description="Sign in with your authority credentials to review network totals, confidence metrics, and regional distributions."
    >
      <Dashboard />
    </ProtectedRoute>
  );
}
