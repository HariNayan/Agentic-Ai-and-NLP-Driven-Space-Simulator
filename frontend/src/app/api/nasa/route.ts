import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_NASA_PATHS = new Set([
  'DONKI/FLR',
  'mars-photos/api/v1/rovers/perseverance/latest_photos',
  'neo/rest/v1/feed',
  'insight_weather/',
  'planetary/apod',
]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  if (!path) {
    return NextResponse.json({ error: 'Missing path param' }, { status: 400 });
  }

  if (!ALLOWED_NASA_PATHS.has(path)) {
    return NextResponse.json({ error: 'NASA path is not allowed' }, { status: 400 });
  }

  const apiKey = process.env.NASA_API_KEY || 'DEMO_KEY';
  const params = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== 'path') params.set(key, value);
  });
  params.set('api_key', apiKey);

  try {
    const res = await fetch(`https://api.nasa.gov/${path}?${params}`, {
      headers: { 'User-Agent': 'space-monitor/1.0' },
      next: { revalidate: 60 },
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        {
          error: 'NASA returned a non-JSON response',
          details: text.slice(0, 240),
        },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch NASA data', details: String(error) },
      { status: 502 }
    );
  }
}
