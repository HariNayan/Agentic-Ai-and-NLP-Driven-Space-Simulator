'use client';
import { useEffect, useState } from 'react';
import PanelFooter from '../UI/PanelFooter';

interface SolData {
  sol: string;
  season: string;
  tempHigh: number | null;
  tempLow: number | null;
  pressure: number | null;
  windSpeed: number | null;
  archived: boolean;
  source: string;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #161a26', padding: '3px 0' }}>
      <span style={{ fontSize: '8px', color: '#4a5070', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: '9px', color: '#c8ccd8' }}>{value}</span>
    </div>
  );
}

function parseInSight(d: Record<string, unknown>): SolData | null {
  const solKeys = Object.keys(d).filter(k => /^\d+$/.test(k)).sort();
  if (solKeys.length === 0) return null;
  const latest = d[solKeys[solKeys.length - 1]] as Record<string, unknown>;
  return {
    sol: solKeys[solKeys.length - 1],
    season: (latest.AT as any)?.ob?.season || '--',
    tempHigh: (latest.AT as any)?.mx ?? null,
    tempLow: (latest.AT as any)?.mn ?? null,
    pressure: (latest.PRE as any)?.av ?? null,
    windSpeed: (latest.HWS as any)?.av ?? null,
    archived: true,
    source: 'InSight (archived Dec 2022)',
  };
}

function parseREMS(d: Record<string, unknown>): SolData | null {
  try {
    const soles = d['soles'] as Record<string, unknown>[] | undefined;
    if (!soles || soles.length === 0) return null;
    const latest = soles[soles.length - 1];
    return {
      sol: String(latest['sol'] ?? '--'),
      season: String(latest['season'] ?? '--'),
      tempHigh: latest['max_temp'] != null && latest['max_temp'] !== '--' ? Number(latest['max_temp']) : null,
      tempLow: latest['min_temp'] != null && latest['min_temp'] !== '--' ? Number(latest['min_temp']) : null,
      pressure: latest['pressure'] != null && latest['pressure'] !== '--' ? Number(latest['pressure']) : null,
      windSpeed: latest['wind_speed'] != null && latest['wind_speed'] !== '--' ? Number(latest['wind_speed']) : null,
      archived: false,
      source: 'Curiosity // REMS',
    };
  } catch {
    return null;
  }
}

export default function MarsWeatherPanel() {
  const [sol, setSol] = useState<SolData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchWeather = async () => {
      setLoading(true);

      try {
        const r = await fetch('/api/rems');
        if (r.ok) {
          const d = await r.json();
          const parsed = parseREMS(d);
          if (parsed && mounted) {
            setSol(parsed);
            setError(false);
            setLoading(false);
            setLastUpdated(new Date());
            return;
          }
        }
      } catch {
        // fall through
      }

      try {
        const r = await fetch('/api/nasa?path=insight_weather/&feedtype=json&ver=1.0');
        if (r.ok) {
          const d = await r.json();
          const parsed = parseInSight(d);
          if (parsed && mounted) {
            setSol(parsed);
            setError(false);
            setLoading(false);
            setLastUpdated(new Date());
            return;
          }
        }
      } catch {
        // fall through
      }

      if (mounted) {
        setError(true);
        setLoading(false);
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

  if (loading || !sol) {
    return (
      <div style={{ padding: '8px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Courier New", monospace', fontSize: '9px', color: '#4a5070' }}>
        Fetching Mars weather...
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: '"Courier New", monospace' }}>
      <div style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px' }}>
        <div style={{ fontSize: '8px', color: sol.archived ? '#4a5070' : '#c1440e', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
          MARS // {sol.source}
        </div>
        {sol.archived && (
          <div style={{ fontSize: '7px', color: '#c0473a', marginBottom: '4px', letterSpacing: '0.06em' }}>
            ⚠ ARCHIVED DATA — mission ended Dec 2022
          </div>
        )}
        {rows.map(r => <Row key={r.label} label={r.label} value={r.value} />)}
      </div>
      <PanelFooter source={sol.archived ? "InSight (archived)" : "Curiosity REMS"} lastUpdated={lastUpdated} />
    </div>
  );
}
