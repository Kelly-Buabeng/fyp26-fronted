'use client';
import { ErrorState } from '../components/ui/primitives';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState message="This screen could not be displayed." retry={reset} />;
}
