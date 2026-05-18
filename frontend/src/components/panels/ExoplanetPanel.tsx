'use client';
import { useEffect, useState } from 'react';

interface Exoplanet {
  pl_name: string;
  sy_dist: number;
  pl_rade: number;
  pl_eqt: number;
  discoverymethod: string;
}

export default function ExoplanetPanel() {
  const [planets, setPlanets] = useState<Exoplanet[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchExoplanets = async () => {
      try {
        const r = await fetch('/api/exoplanets');
        if (!r.ok) throw new Error('API error');
        const data = await r.json();
        if (!mounted) return;
        const list: Exoplanet[] = (Array.isArray(data) ? data : data.data || []).slice(0, 8);
        if (list.length === 0) throw new Error('Empty');
        setPlanets(list);
      } catch {
        if (mounted) setError(true);
      }
    };
    fetchExoplanets();
    return () => { mounted = false; };
  }, []);

  if (error) {
    return (
      <div style={{ padding: '8px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Courier New", monospace', fontSize: '9px', color: '#c0473a' }}>
        ⚡ EXOPLANET CATALOG OFFLINE
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0c14' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {planets.length === 0 ? (
          <div style={{ padding: '8px', fontSize: '9px', color: '#4a5070', fontFamily: '"Courier New", monospace' }}>Loading catalog...</div>
        ) : (
          planets.map((p, i) => (
            <div key={i} style={{ padding: '5px 8px', borderBottom: '1px solid #161a26' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontFamily: '"Courier New", monospace', fontSize: '9px', color: '#4a9fd8', fontWeight: 'bold' }}>{p.pl_name}</span>
                <span style={{ fontFamily: '"Courier New", monospace', fontSize: '7px', color: '#ffaa00' }}>{p.discoverymethod || '--'}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontFamily: '"Courier New", monospace', fontSize: '8px', color: '#4a5070' }}>
                  Dist: {p.sy_dist ? `${p.sy_dist.toFixed(1)} pc` : '--'}
                </span>
                <span style={{ fontFamily: '"Courier New", monospace', fontSize: '8px', color: '#4a5070' }}>
                  Radius: {p.pl_rade ? `${p.pl_rade.toFixed(2)} R⊕` : '--'}
                </span>
                <span style={{ fontFamily: '"Courier New", monospace', fontSize: '8px', color: '#4a5070' }}>
                  Temp: {p.pl_eqt ? `${p.pl_eqt.toFixed(0)} K` : '--'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
