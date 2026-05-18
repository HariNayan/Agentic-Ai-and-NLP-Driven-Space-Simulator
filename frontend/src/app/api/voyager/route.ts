export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const voyagerIds = [
      { name: 'Voyager 1', id: '-31' },
      { name: 'Voyager 2', id: '-32' },
    ];

    const results = await Promise.all(
      voyagerIds.map(async (v) => {
        const stopDate = new Date(now.getTime() + 60000);
      const stopDateStr = `${stopDate.getFullYear()}-${pad(stopDate.getMonth() + 1)}-${pad(stopDate.getDate())}`;
      const stopTimeStr = `${pad(stopDate.getHours())}:${pad(stopDate.getMinutes())}`;
      const url =
          `https://ssd.jpl.nasa.gov/api/horizons.api?` +
          `format=json&COMMAND='${v.id}'&OBJ_DATA='NO'` +
          `&MAKE_EPHEM='YES'&EPHEM_TYPE='VECTORS'&CENTER='500@399'` +
          `&START_TIME='${dateStr} ${timeStr}'` +
          `&STOP_TIME='${stopDateStr} ${stopTimeStr}'&STEP_SIZE='1m'` +
          `&VEC_TABLE='2'`;

        const res = await fetch(url);
        const data = await res.json();
        const result: string = data.result ?? '';
        const match = result.match(/X =\s*([-\d.E+]+)\s*Y =\s*([-\d.E+]+)\s*Z =\s*([-\d.E+]+)/);

        if (!match) return null;

        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        const z = parseFloat(match[3]);
        const distKm = Math.sqrt(x * x + y * y + z * z);

        return { name: v.name, distKm };
      })
    );

    const v1 = results[0];
    const v2 = results[1];

    return Response.json({ voyager1: v1, voyager2: v2 });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
}
