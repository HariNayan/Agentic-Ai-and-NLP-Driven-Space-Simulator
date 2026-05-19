'use client';
import { useEffect, useState } from 'react';
import PanelFooter from '../UI/PanelFooter';

const ORBITAL: Record<string, { l0: number; daily: number }> = {
  Mercury: { l0: 252.25, daily: 4.092 },
  Venus:   { l0: 181.98, daily: 1.602 },
  Earth:   { l0: 100.46, daily: 0.986 },
  Mars:    { l0: 355.45, daily: 0.524 },
  Jupiter: { l0: 34.35,  daily: 0.083 },
  Saturn:  { l0: 50.08,  daily: 0.033 },
  Uranus:  { l0: 314.06, daily: 0.012 },
  Neptune: { l0: 304.35, daily: 0.006 },
};

function getAngle(name: string): number {
  const el = ORBITAL[name];
  const j2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  const days = (Date.now() - j2000) / 86400000;
  return (((el.l0 + el.daily * days) % 360 + 360) % 360) * Math.PI / 180;
}

interface Position { name: string; angle: number }

export default function EphemerisPanel() {
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const compute = () => {
      setPositions(Object.keys(ORBITAL).map(name => ({ name, angle: getAngle(name) })));
      setLastUpdated(new Date());
    };
    compute();
    const iv = setInterval(compute, 60_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: '"Courier New", monospace' }}>
      <div style={{ flex: 1, padding: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '8px', color: '#6a9fd8', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
          JPL HORIZONS // HELIOCENTRIC
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!positions ? (
            <div style={{ fontSize: '9px', color: '#4a5070' }}>Fetching...</div>
          ) : (
            positions.map(p => {
              const deg = ((p.angle * 180) / Math.PI + 360) % 360;
              return (
                <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #161a26', padding: '4px 0' }}>
                  <span style={{ fontSize: '9px', color: '#e8d5a3', textTransform: 'uppercase' }}>{p.name}</span>
                  <span style={{ fontSize: '9px', color: '#6a9fd8' }}>{deg.toFixed(2)}°</span>
                </div>
              );
            })
          )}
        </div>
      </div>
      <PanelFooter source="Local Ephemeris (JPL elements)" lastUpdated={lastUpdated} />
    </div>
  );
}
