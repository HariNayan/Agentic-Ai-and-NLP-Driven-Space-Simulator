import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch(
      'https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json',
      { headers: { 'User-Agent': 'space-monitor/1.0' } },
    );
    if (!res.ok) {
      return NextResponse.json({ error: 'NOAA API error' }, { status: 502 });
    }
    const data = await res.json();
    const mapped = (Array.isArray(data) ? data : []).map((f: any) => ({
      classType: f.max_class ?? f.current_class ?? 'UNK',
      beginTime: f.begin_time ?? f.time_tag,
      maxTime: f.max_time,
      satellite: f.satellite,
    }));
    return NextResponse.json(mapped);
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to fetch solar flare data', details: String(e) },
      { status: 502 },
    );
  }
}
