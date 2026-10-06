import { ProtectedRoute } from '../../components/auth/protected-route';
import { GalleryView } from '../../components/features/gallery/gallery-view';

export const metadata = { title: 'Pothole Gallery' };

export default function GalleryPage() {
  return (
    <ProtectedRoute
      title="Pothole Photo Gallery"
      description="Authority gallery view to review, verify, decline, or mark uploaded pothole images as fixed."
    >
      <GalleryView />
    </ProtectedRoute>
  );
}
