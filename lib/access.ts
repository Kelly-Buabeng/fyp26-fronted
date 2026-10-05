export const AUTHORITY_PATHS = ['/dashboard', '/report', '/detections', '/devices'] as const;
export function authorityDestination(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/dashboard';
  try {
    const url = new URL(value, 'https://roadwatch.local');
    if (
      url.origin !== 'https://roadwatch.local' ||
      !AUTHORITY_PATHS.some((p) => p === url.pathname)
    )
      return '/dashboard';
    return url.pathname + url.search;
  } catch {
    return '/dashboard';
  }
}
