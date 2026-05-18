export const dynamic = 'force-dynamic';

/**
 * Proxy for NASA JPL Horizons API.
 * The browser cannot call this API directly due to CORS restrictions,
 * so we fetch it server-side and return only the parsed x/y coordinates.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nasaId = searchParams.get('nasaId');
  const dateStr = searchParams.get('dateStr');
  const timeStr = searchParams.get('timeStr');

  if (!nasaId || !dateStr || !timeStr) {
    return Response.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const startDate = new Date(`${dateStr}T${timeStr}:00`);
    const stopDate = new Date(startDate.getTime() + 60000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const stopDateStr = `${stopDate.getFullYear()}-${pad(stopDate.getMonth() + 1)}-${pad(stopDate.getDate())}`;
    const stopTimeStr = `${pad(stopDate.getHours())}:${pad(stopDate.getMinutes())}`;
    const url =
      `https://ssd.jpl.nasa.gov/api/horizons.api?` +
      `format=json&COMMAND='${nasaId}'&OBJ_DATA='NO'` +
      `&MAKE_EPHEM='YES'&EPHEM_TYPE='VECTORS'&CENTER='500@0'` +
      `&START_TIME='${dateStr} ${timeStr}'` +
      `&STOP_TIME='${stopDateStr} ${stopTimeStr}'&STEP_SIZE='1m'` +
      `&VEC_TABLE='2'`;

    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) {
      return Response.json({ error: `NASA API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const result: string = data.result ?? '';
    const match = result.match(/X =\s*([-\d.E+]+)\s*Y =\s*([-\d.E+]+)/);

    if (!match) {
      return Response.json({ error: 'Could not parse position data' }, { status: 502 });
    }

    return Response.json({
      x: parseFloat(match[1]),
      y: parseFloat(match[2]),
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
