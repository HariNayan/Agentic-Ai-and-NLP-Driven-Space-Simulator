'use client';
import { useEffect, useState } from 'react';
import PanelFooter from '../UI/PanelFooter';

interface VoyagerData {
  name: string;
  distKm: number;
}

export default function VoyagerPanel() {
  const [data, setData] = useState<[VoyagerData | null, VoyagerData | null]>([null, null]);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchVoyager = async () => {
      try {
        const r = await fetch('/api/voyager');
        if (!r.ok) throw new Error('API error');
        const d = await r.json();
        if (mounted) {
          setData([d.voyager1, d.voyager2]);
          setLastUpdated(new Date());
        }
      } catch {
        if (mounted) setError(true);
      }
    };
    fetchVoyager();
    const iv = setInterval(fetchVoyager, 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  const fmtDist = (km: number) => {
    const au = km / 149597870.7;
    return `${au.toFixed(3)} AU`;
  };

  if (error) {
    return (
      <div style={{ padding: '8px 12px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Courier New", monospace', fontSize: '9px', color: '#c0473a' }}>
        ⚡ VOYAGER TELEMETRY OFFLINE
      </div>
    );
  }

  const v1 = data[0];
  const v2 = data[1];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: '"Courier New", monospace' }}>
      <div style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px' }}>
        {!v1 && !v2 ? (
          <div style={{ fontSize: '9px', color: '#4a5070' }}>Acquiring signal...</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#ffaa00', fontWeight: 'bold' }}>VOYAGER 1</div>
                <div style={{ fontSize: '7px', color: '#8899aa' }}>INTERSTELLAR SPACE</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#fff' }}>{v1 ? fmtDist(v1.distKm) : '--'}</div>
                <div style={{ fontSize: '7px', color: '#4a9fd8' }}>{v1 ? `${(v1.distKm / 1e6).toFixed(0)}M km` : '--'}</div>
              </div>
            </div>
            <div style={{ height: '1px', background: '#161a26' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#ffaa00', fontWeight: 'bold' }}>VOYAGER 2</div>
                <div style={{ fontSize: '7px', color: '#8899aa' }}>INTERSTELLAR SPACE</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#fff' }}>{v2 ? fmtDist(v2.distKm) : '--'}</div>
                <div style={{ fontSize: '7px', color: '#4a9fd8' }}>{v2 ? `${(v2.distKm / 1e6).toFixed(0)}M km` : '--'}</div>
              </div>
            </div>
          </>
        )}
      </div>
      <PanelFooter source="JPL Horizons (Voyager 1 & 2)" lastUpdated={lastUpdated} />
    </div>
  );
}
