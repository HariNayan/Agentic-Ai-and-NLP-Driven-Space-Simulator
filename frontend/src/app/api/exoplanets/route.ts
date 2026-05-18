export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const query =
      'select+pl_name,pl_rade,pl_eqt,sy_dist,discoverymethod+from+pscomppars+where+rownum+%3C=+30';
    const url = `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=${query}&format=json`;

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return Response.json({ error: `Exoplanet API error: ${res.status}` }, { status: 502 });
    }

    const text = await res.text();

    try {
      const data = JSON.parse(text);
      return Response.json(data);
    } catch {
      return Response.json({ error: 'Non-JSON response from Exoplanet Archive' }, { status: 502 });
    }
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
}
