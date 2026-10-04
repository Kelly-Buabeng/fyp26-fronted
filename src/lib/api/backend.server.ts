import 'server-only';
import { getConfig } from '@/lib/server/config';
import { HttpError } from '@/lib/server/auth';
import { parseApiError } from './errors';
export async function backendRequest(path: string, init: RequestInit = {}, authenticated = false) {
  const config = getConfig();
  const headers = new Headers(init.headers);
  if (authenticated && config.apiKey) headers.set('X-API-Key', config.apiKey);
  const signal = init.signal
    ? AbortSignal.any([init.signal, AbortSignal.timeout(config.timeout)])
    : AbortSignal.timeout(config.timeout);
  let response: Response;
  try {
    response = await fetch(config.apiUrl + path, {
      ...init,
      headers,
      signal,
      cache: 'no-store',
      redirect: 'error',
    });
  } catch {
    if (signal.aborted)
      throw new HttpError(
        504,
        'The backend request timed out or was cancelled. Check saved records before retrying an upload.',
      );
    throw new HttpError(502, 'Unable to reach the detection backend.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const error = parseApiError(data, response.status);
    throw new HttpError(error.status, error.message);
  }
  return response;
}
