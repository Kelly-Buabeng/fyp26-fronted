export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export function parseApiError(data: unknown, status: number): ApiError {
  const fallback =
    status === 401
      ? 'Sign in to continue.'
      : status === 503
        ? 'The pothole model is unavailable. Check the backend model configuration.'
        : `Request failed (${status}).`;
  if (!data || typeof data !== 'object' || !('detail' in data))
    return new ApiError(fallback, status);
  const detail = data.detail;
  if (typeof detail === 'string') return new ApiError(detail, status);
  if (Array.isArray(detail)) {
    const fields: Record<string, string> = {};
    for (const item of detail)
      if (
        item &&
        typeof item === 'object' &&
        typeof item.msg === 'string' &&
        Array.isArray(item.loc)
      )
        fields[String(item.loc.at(-1))] = item.msg;
    return new ApiError(Object.values(fields).join('; ') || fallback, status, fields);
  }
  return new ApiError(fallback, status);
}
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';
