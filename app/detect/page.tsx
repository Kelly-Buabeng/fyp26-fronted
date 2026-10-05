import { ProtectedRoute } from '../../components/auth/protected-route';
import { UploadForm } from '../../components/features/detection/upload-form';

export const metadata = { title: 'Report a pothole' };

export default function DetectionPage() {
  return (
    <ProtectedRoute
      title="Report a pothole"
      description="Sign in with your authority credentials to submit road images and run detections."
    >
      <UploadForm />
    </ProtectedRoute>
  );
}
