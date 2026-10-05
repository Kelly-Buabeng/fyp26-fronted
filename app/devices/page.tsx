import { ProtectedRoute } from '../../components/auth/protected-route';
import { DevicesHealth } from '../../components/features/devices/devices-health';

export const metadata = { title: 'Devices & model health' };

export default function Page() {
  return (
    <ProtectedRoute
      title="Devices & Model Health"
      description="Sign in with your authority credentials to monitor active edge devices and YOLO model status."
    >
      <DevicesHealth />
    </ProtectedRoute>
  );
}
