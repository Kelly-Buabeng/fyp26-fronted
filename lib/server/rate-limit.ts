import 'server-only';
import { HttpError } from './auth';
// Per-process limiter. Production multi-instance deployments must also enforce limits at ingress.
const windows = new Map<string, { count: number; expires: number }>();
export function rateLimit(request: Request, category: string, maximum: number, duration: number) {
  const now = Date.now();
  for (const [key, value] of windows) if (value.expires <= now) windows.delete(key);
  const ip = 'shared';
  const key = category + ':' + ip;
  const bucket = windows.get(key) || { count: 0, expires: now + duration };
  bucket.count++;
  windows.set(key, bucket);
  if (bucket.count > maximum)
    throw new HttpError(429, 'Too many requests. Please try again later.');
}
