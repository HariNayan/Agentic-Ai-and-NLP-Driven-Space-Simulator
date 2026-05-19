'use client';
import { useEffect, useState } from 'react';
import PanelFooter from '../UI/PanelFooter';

export default function SolarFlaresPanel() {
  const [flares, setFlares] = useState<any[]>([]);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  useEffect(() => {
    let isMounted = true;
    const fetchFlares = async () => {
      try {
        const r = await fetch('/api/solar-flares');
        if (!r.ok) throw new Error('API error');
        const data = await r.json();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setFlares(data);
          setLastUpdated(new Date());
          return;
        }
      } catch {
        // API unavailable
      }
      if (isMounted) setError(true);
    };
    fetchFlares();
    return () => { isMounted = false; };
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
        {error ? (
          <div style={{ color: '#c0473a', fontSize: '9px', fontFamily: '"Courier New", monospace' }}>⚠ SOLAR DATA UNAVAILABLE</div>
        ) : flares.length === 0 ? (
          <div style={{ color: '#4a5070', fontSize: '9px', fontFamily: '"Courier New", monospace' }}>Scanning for solar events...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {flares.map((f, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #161a26', paddingBottom: '4px' }}>
                <div>
                  <div style={{ color: f?.classType?.startsWith('X') ? '#ff0000' : (f?.classType?.startsWith('M') ? '#ffaa00' : '#4a9fd8'), fontWeight: 'bold', fontSize: '10px', fontFamily: '"Courier New", monospace' }}>
                    {f?.classType ?? 'UNK'}
                  </div>
                  <div style={{ color: '#8a9070', fontSize: '7px', fontFamily: '"Courier New", monospace' }}>
                    {f?.beginTime?.replace('T', ' ')?.replace('Z', '') ?? '--'}
                  </div>
                </div>
                <div style={{ color: '#4a5070', fontSize: '8px', fontFamily: '"Courier New", monospace', textAlign: 'right' }}>
                  GOES-{f?.satellite ?? '?'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <PanelFooter source="NOAA SWPC GOES" lastUpdated={lastUpdated} />
    </div>
  );
}
