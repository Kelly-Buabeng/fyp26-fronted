import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAME, verifySessionToken } from '@/lib/server/auth';
export function proxy(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  let authenticated = false;
  try {
    authenticated = !!token && verifySessionToken(token);
  } catch {
    /* Fail closed. */
  }
  if (!authenticated) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
    const response = NextResponse.redirect(login);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {
  matcher: ['/dashboard/:path*', '/report/:path*', '/detections/:path*', '/devices/:path*'],
};
