import { NextResponse } from 'next/server';
import { searchLocationPhoton } from '../../../../lib/api/location';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || typeof q !== 'string') {
      return NextResponse.json([]);
    }

    const suggestions = await searchLocationPhoton(q, request.signal);
    return NextResponse.json(suggestions, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Location search API route error:', error);
    return NextResponse.json([], { status: 500 });
  }
}
