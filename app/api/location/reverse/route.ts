import { NextResponse } from 'next/server';
import { reverseGeocodePhoton } from '../../../../lib/api/location';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = Number(searchParams.get('lat'));
    const lng = Number(searchParams.get('lng'));

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(null, { status: 400 });
    }

    const suggestion = await reverseGeocodePhoton(lat, lng, request.signal);
    return NextResponse.json(suggestion, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    });
  } catch (error: any) {
    if (
      request.signal.aborted ||
      error?.name === 'AbortError' ||
      error?.name === 'ResponseAborted' ||
      (typeof error?.message === 'string' &&
        (error.message.includes('abort') || error.message.includes('ResponseAborted')))
    ) {
      return NextResponse.json(null);
    }
    console.error('Location reverse API route error:', error);
    return NextResponse.json(null, { status: 500 });
  }
}
