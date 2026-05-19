'use client';
import { useEffect, useState } from 'react';
import PanelFooter from '../UI/PanelFooter';

interface Dish {
  name: string;
  target: string;
  band: string;
  power: string;
  range: string;
  direction: string;
  active: boolean;
  desc: string;
}

export default function DeepSpaceNetworkPanel() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchDSN = async () => {
      try {
        const r = await fetch('/api/dsn');
        if (!r.ok) throw new Error('API error');
        const data = await r.json();
        if (!mounted) return;
        const list: Dish[] = (data.dishes || []).slice(0, 6);
        if (list.length === 0) throw new Error('No dishes');
        setDishes(list);
        setLastUpdated(new Date());
      } catch {
        if (mounted) setError(true);
      }
    };
    fetchDSN();
    const iv = setInterval(fetchDSN, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  if (error) {
    return (
      <div style={{ padding: '8px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Courier New", monospace', fontSize: '9px', color: '#c0473a' }}>
        ⚡ DSN UNAVAILABLE
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: '"Courier New", monospace' }}>
      <div style={{ flex: 1, padding: '8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {dishes.length === 0 ? (
          <div style={{ fontSize: '9px', color: '#4a5070' }}>Connecting to DSN...</div>
        ) : (
          dishes.map((d, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: d.active ? 'rgba(0, 255, 136, 0.05)' : 'rgba(255, 255, 255, 0.02)', border: d.active ? '1px solid #00ff8844' : '1px solid #161a26' }}>
              <div>
                <div style={{ fontSize: '9px', color: '#00ff88', fontWeight: 'bold' }}>{d.name}</div>
                <div style={{ fontSize: '7px', color: '#8899aa', marginTop: '2px' }}>{d.target}</div>
                <div style={{ fontSize: '7px', color: '#4a5070', marginTop: '1px' }}>{d.desc}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '8px', color: '#fff' }}>{d.direction} {d.band}</div>
                <div style={{ fontSize: '7px', color: '#4a5070', marginTop: '2px' }}>{d.power} · {d.range}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <PanelFooter source="NASA DSN Now" lastUpdated={lastUpdated} />
    </div>
  );
}
