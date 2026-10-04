import { NextResponse } from 'next/server';
import { HttpError } from './auth';
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return NextResponse.json(
      { detail: error.message },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  // Configuration failures are intentionally not reflected into public responses.
  return NextResponse.json(
    { detail: 'The frontend service is not configured correctly. Contact the operator.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
