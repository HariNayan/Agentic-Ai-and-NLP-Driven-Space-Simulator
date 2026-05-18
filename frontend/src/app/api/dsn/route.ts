export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch('https://eyes.nasa.gov/dsn/data/dsn.json', {
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      return Response.json({ error: `DSN API error: ${res.status}` }, { status: 502 });
    }
    const raw = await res.json();

    const dishes = Object.entries(raw.dishes ?? {}).map(([id, d]: [string, any]) => {
      const sig = d.sigs?.[0];
      const tgtKey = Object.keys(d.tgts ?? {})[0];
      const tgt = tgtKey ? d.tgts[tgtKey] : null;
      return {
        name: `DSS-${id}`,
        target: d.user || sig?.tgt || '--',
        band: sig?.band || d.act || '--',
        power: sig?.pwr != null ? `${sig.pwr} kW` : '--',
        range: tgt?.rng != null && tgt.rng !== 'NaN' ? `${(tgt.rng / 1e6).toFixed(1)}M km` : '--',
        direction: sig?.dir === 'up' ? '↑' : sig?.dir === 'down' ? '↓' : '--',
        active: sig?.active ?? false,
        desc: d.desc || '',
      };
    });

    return Response.json({ dishes });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
}
