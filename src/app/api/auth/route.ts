import { NextResponse } from 'next/server';
import {
  assertSameOrigin,
  clearSession,
  HttpError,
  isAdmin,
  credentialsMatch,
  setSession,
} from '@/lib/server/auth';
import { getConfig } from '@/lib/server/config';
import { failure } from '@/lib/server/responses';
import { rateLimit } from '@/lib/server/rate-limit';
export const runtime = 'nodejs';
export async function GET() {
  try {
    return NextResponse.json(
      { admin: await isAdmin(), enabled: getConfig().adminEnabled },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimit(request, 'login', 8, 15 * 60 * 1000);
    if (Number(request.headers.get('content-length') || 0) > 2048)
      throw new HttpError(413, 'Request too large.');
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, 'Request body is missing.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        throw new HttpError(413, 'Request too large.');
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new HttpError(400, 'Invalid request.');
    }
    if (!getConfig().adminEnabled)
      throw new HttpError(
        503,
        'Authority access is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD, and SESSION_SECRET on the frontend server.',
      );
    if (
      typeof data?.email !== 'string' ||
      typeof data?.password !== 'string' ||
      !credentialsMatch(data.email, data.password)
    )
      throw new HttpError(401, 'Email or password is incorrect.');
    await setSession();
    return NextResponse.json({ admin: true });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    await clearSession();
    return NextResponse.json({ admin: false });
  } catch (e) {
    return failure(e);
  }
}
