'use client';
import { useEffect, useState } from 'react';
import PanelFooter from '../UI/PanelFooter';

interface APODData {
  title: string;
  url: string;
  hdurl: string;
  explanation: string;
  date: string;
  copyright: string;
}

export default function APODPanel() {
  const [data, setData] = useState<APODData | null>(null);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchAPOD = async () => {
      try {
        const r = await fetch('/api/nasa?path=planetary/apod');
        if (!r.ok) throw new Error('API error');
        const d = await r.json();
        if (mounted) {
          setData(d);
          setLastUpdated(new Date());
        }
      } catch {
        if (mounted) setError(true);
      }
    };
    fetchAPOD();
    return () => { mounted = false; };
  }, []);

  if (error) {
    return (
      <div style={{ padding: '8px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Courier New", monospace', fontSize: '9px', color: '#c0473a' }}>
        ⚡ IMAGE UNAVAILABLE
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '8px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Courier New", monospace', fontSize: '9px', color: '#4a5070' }}>
        Fetching image...
      </div>
    );
  }

  const isVideo = data.url?.includes('youtube');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#020408', position: 'relative', overflow: 'hidden' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {isVideo ? (
          <iframe src={data.url} width="100%" height="100%" style={{ border: 'none' }} allowFullScreen />
        ) : (
          <img
            src={data.hdurl || data.url}
            alt={data.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
          />
        )}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(2,4,8,0.95))',
          padding: '20px 8px 6px',
        }}>
          <div style={{ fontFamily: '"Courier New", monospace', fontSize: '7px', color: '#e8d5a3', letterSpacing: '0.08em', marginBottom: '2px' }}>
            APOD // {data.date}
          </div>
          <div style={{ fontFamily: '"Courier New", monospace', fontSize: '9px', color: '#c8ccd8', lineHeight: '1.3' }}>
            {data.title}
          </div>
        </div>
      </div>
      <PanelFooter source="NASA APOD" lastUpdated={lastUpdated} />
    </div>
  );
}
