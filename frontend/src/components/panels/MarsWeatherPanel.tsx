'use client';
import { useEffect, useState } from 'react';

interface SolData {
  sol: string;
  season: string;
  tempHigh: number;
  tempLow: number;
  pressure: number;
  windSpeed: number;
}

export default function MarsWeatherPanel() {
  const [sol, setSol] = useState<SolData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchWeather = async () => {
      try {
        const r = await fetch('/api/nasa?path=insight_weather/&feedtype=json&ver=1.0');
        if (!r.ok) throw new Error('API error');
        const d = await r.json();
        if (!mounted) return;

        const solKeys = Object.keys(d).filter(k => /^\d+$/.test(k)).sort();
        if (solKeys.length === 0) throw new Error('No sol data');

        const latest = d[solKeys[solKeys.length - 1]];
        setSol({
          sol: solKeys[solKeys.length - 1],
          season: latest.AT?.ob?.season || '--',
          tempHigh: latest.AT?.mx ?? null,
          tempLow: latest.AT?.mn ?? null,
          pressure: latest.PRE?.av ?? null,
          windSpeed: latest.HWS?.av ?? null,
        });
      } catch {
        if (mounted) setError(true);
      }
    };
    fetchWeather();
    const iv = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (error) {
    return (
      <div style={{ padding: '8px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', fontFamily: '"Courier New", monospace' }}>
        <div style={{ fontSize: '9px', color: '#c0473a', textAlign: 'center' }}>⚠ MARS WEATHER OFFLINE</div>
      </div>
    );
  }

  if (!sol) {
    return (
      <div style={{ padding: '8px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Courier New", monospace', fontSize: '9px', color: '#4a5070' }}>
        Syncing with InSight...
      </div>
    );
  }

  const rows = [
    { label: 'SOL', value: sol.sol },
    { label: 'SEASON', value: sol.season },
    { label: 'HIGH', value: sol.tempHigh != null ? `${sol.tempHigh.toFixed(1)}°C` : '--' },
    { label: 'LOW', value: sol.tempLow != null ? `${sol.tempLow.toFixed(1)}°C` : '--' },
    { label: 'PRESSURE', value: sol.pressure != null ? `${sol.pressure.toFixed(1)} Pa` : '--' },
    { label: 'WIND', value: sol.windSpeed != null ? `${sol.windSpeed.toFixed(1)} m/s` : '--' },
  ];

  return (
    <div style={{ padding: '8px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px', fontFamily: '"Courier New", monospace' }}>
      <div style={{ fontSize: '8px', color: '#c1440e', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
        MARS // InSight Lander
      </div>
      {rows.map(r => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #161a26', padding: '3px 0' }}>
          <span style={{ fontSize: '8px', color: '#4a5070', textTransform: 'uppercase' }}>{r.label}</span>
          <span style={{ fontSize: '9px', color: '#c8ccd8' }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
