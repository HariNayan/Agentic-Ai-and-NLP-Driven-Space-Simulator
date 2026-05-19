'use client';
import { useEffect, useState, memo } from 'react';
import PanelFooter from './UI/PanelFooter';

interface Launch {
  id: string;
  name: string;
  net: string;
  launch_service_provider: { name: string };
  status: { name: string };
}

export default memo(function LaunchPanel() {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchLaunches = async () => {
      try {
        const r = await fetch('https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=6&format=json');
        if (!r.ok) throw new Error('API limit');
        const data = await r.json();
        if (isMounted) {
          setLaunches(data?.results ?? []);
          setLoading(false);
          setLastUpdated(new Date());
        }
      } catch {
        if (isMounted) { setLoading(false); setError(true); }
      }
    };
    fetchLaunches();
    const interval = setInterval(fetchLaunches, 10 * 60 * 1000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const statusColor = (status: string) => {
    if (status.includes('Go')) return '#4a8c6f';
    if (status.includes('TBD') || status.includes('TBC')) return '#c8a840';
    return '#4a5070';
  };

  const badgeBg = (status: string) => {
    if (status.includes('Go')) return 'rgba(74, 140, 111, 0.15)';
    if (status.includes('TBD') || status.includes('TBC')) return 'rgba(200, 168, 64, 0.15)';
    return 'transparent';
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0c14' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: '8px', fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#4a5070' }}>Loading...</div>
        )}
        {error && !loading && (
          <div style={{ padding: '8px', fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#c0473a' }}>⚠ LAUNCH DATA UNAVAILABLE</div>
        )}
        {!error && !loading && launches.length === 0 && (
          <div style={{ padding: '8px', fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#4a5070' }}>NO UPCOMING LAUNCHES</div>
        )}
        {!error && launches.map(l => (
          <div key={l.id} style={{ padding: '5px 8px', borderBottom: '1px solid #161a26', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#0d1018')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: '8px', color: '#6a9fd8', textTransform: 'uppercase' }}>
                {l.launch_service_provider?.name?.split(' ')[0] ?? 'TBD'}
              </span>
              <span style={{ fontFamily: "'Courier New', monospace", fontSize: '7px', color: statusColor(l.status?.name ?? ''), border: `1px solid ${statusColor(l.status?.name ?? '')}${statusColor(l.status?.name ?? '') !== '#4a5070' ? '40' : ''}`, padding: '1px 4px', background: badgeBg(l.status?.name ?? '') }}>
                {l.status?.name ?? 'TBD'}
              </span>
            </div>
            <div style={{ fontSize: '10px', color: '#c8ccd8', marginBottom: '2px', lineHeight: '1.3', fontFamily: "'Courier New', monospace" }}>
              {l.name}
            </div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: '8px', color: '#4a5070' }}>
              {formatDate(l.net)}
            </div>
          </div>
        ))}
      </div>
      <PanelFooter source="Launch Library 2" lastUpdated={lastUpdated} />
    </div>
  );
});