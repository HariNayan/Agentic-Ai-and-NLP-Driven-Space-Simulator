export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url =
      'https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&order=sol+desc&num=1';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'space-monitor/1.0' },
    });

    if (!res.ok) {
      return Response.json({ error: `Mars image API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const images = data?.images ?? [];

    if (images.length === 0) {
      return Response.json({ error: 'No images found' }, { status: 404 });
    }

    const img = images[0];
    return Response.json({
      img_src: img.image_files?.medium || img.image_files?.full_res || '',
      sol: img.sol,
      earth_date: img.date_taken_utc?.split('T')[0] || img.date_received?.split('T')[0] || '--',
      camera: img.camera?.instrument || img.camera?.filter_name || '--',
      title: img.title || '',
    });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
}
