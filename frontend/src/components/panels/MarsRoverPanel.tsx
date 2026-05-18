'use client';
import { useEffect, useState } from 'react';

export default function MarsRoverPanel() {
  const [img, setImg] = useState<string|null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchMars = async () => {
      try {
        const r = await fetch('/api/mars-rover');
        if (!r.ok) throw new Error('API error');
        const data = await r.json();
        if (isMounted && data?.img_src) {
          setImg(data.img_src);
          setMeta(data);
        } else if (isMounted) {
          setError(true);
        }
      } catch (err) {
        if (isMounted) setError(true);
      }
    };
    fetchMars();
    return () => { isMounted = false; };
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', background: '#0a0c14', overflow: 'hidden' }}>
      {error ? (
        <div style={{ padding: '8px', color: '#c0473a', fontSize: '9px', fontFamily: '"Courier New", monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          ⚠ MRO RELAY OFFLINE
        </div>
      ) : img ? (
        <>
          <img src={img} alt="Mars Rover" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7, filter: 'sepia(40%) hue-rotate(-15deg) contrast(1.2)' }} />
          <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(10,12,20,0.85)', padding: '6px', borderLeft: '2px solid #c1440e' }}>
            <div style={{ color: '#ff6633', fontSize: '9px', fontFamily: '"Courier New", monospace', fontWeight: 'bold' }}>PERSEVERANCE (M2020)</div>
            <div style={{ color: '#8899aa', fontSize: '7px', fontFamily: '"Courier New", monospace' }}>SOL: {meta?.sol ?? '--'} | DATE: {meta?.earth_date ?? '--'}</div>
            <div style={{ color: '#4a5070', fontSize: '7px', fontFamily: '"Courier New", monospace' }}>CAM: {meta?.camera?.name ?? '--'}</div>
          </div>
          <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#00ff88', fontSize: '7px', fontFamily: '"Courier New", monospace', textTransform: 'uppercase' }}>Live Relay</span>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88', display: 'inline-block', boxShadow: '0 0 4px #00ff88', animation: 'pulse-slow 2s infinite' }}></span>
          </div>
          <style>{`
            @keyframes pulse-slow {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.3; transform: scale(0.8); }
            }
          `}</style>
        </>
      ) : (
        <div style={{ padding: '8px', color: '#4a5070', fontSize: '9px', fontFamily: '"Courier New", monospace' }}>Awaiting MRO Relay...</div>
      )}
    </div>
  );
}
