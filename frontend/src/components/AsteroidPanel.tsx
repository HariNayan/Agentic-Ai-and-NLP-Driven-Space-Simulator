'use client';

import { useEffect, useState } from 'react';
import { memo } from 'react';

interface Asteroid {
  id: string;
  name: string;
  is_potentially_hazardous_asteroid: boolean;
  estimated_diameter: {
    kilometers: { estimated_diameter_max: number };
  };
  close_approach_data: Array<{
    miss_distance: { kilometers: string };
    relative_velocity: { kilometers_per_hour: string };
  }>;
}

export default memo(function AsteroidPanel() {
  const [asteroids, setAsteroids] = useState<Asteroid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchAsteroids = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const r = await fetch(
          `/api/nasa?path=neo/rest/v1/feed&start_date=${today}&end_date=${today}`
        );
        if (!r.ok) throw new Error('API limit');
        const data = await r.json();
        
        if (isMounted) {
          const all = Object.values(data?.near_earth_objects ?? {}).flat() as Asteroid[];
          setAsteroids(all.slice(0, 8));
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) { setLoading(false); setError(true); }
      }
    };
    
    fetchAsteroids();
    const interval = setInterval(fetchAsteroids, 10 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0c14',
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div
            style={{
              padding: '8px',
              fontFamily: "'Courier New', monospace",
              fontSize: '9px',
              color: '#4a5070',
            }}
          >
            Loading...
          </div>
        )}
        {error && !loading && (
          <div style={{ padding: '8px', fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#c0473a' }}>
            ⚠ ASTEROID DATA UNAVAILABLE
          </div>
        )}
        {!error && asteroids.length === 0 && !loading && (
          <div style={{ padding: '8px', fontFamily: "'Courier New', monospace", fontSize: '9px', color: '#4a5070' }}>
            NO ASTEROIDS TODAY
          </div>
        )}
        {!error && asteroids.map((a) => {
          const hazardous = a?.is_potentially_hazardous_asteroid || false;
          const size = a?.estimated_diameter?.kilometers?.estimated_diameter_max?.toFixed(2) ?? '--';
          const dist = parseFloat(
            a?.close_approach_data?.[0]?.miss_distance?.kilometers ?? '0'
          ).toLocaleString(undefined, { maximumFractionDigits: 0 });
          return (
            <div
              key={a.id}
              style={{
                padding: '5px 8px',
                borderBottom: '1px solid #161a26',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '2px',
                }}
              >
                <span
                  style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: '9px',
                    color: hazardous ? '#c0473a' : '#c8ccd8',
                  }}
                >
                  {a.name.replace(/[()]/g, '')}
                </span>
                {hazardous && (
                  <span
                    style={{
                      fontFamily: "'Courier New', monospace",
                      fontSize: '7px',
                      color: '#c0473a',
                      border: '1px solid rgba(192, 71, 58, 0.3)',
                      padding: '1px 4px',
                    }}
                  >
                    HAZARDOUS
                  </span>
                )}
              </div>
              <div style={{ display: 'flex' }}>
                <span
                  style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: '8px',
                    color: '#4a5070',
                    marginRight: '12px',
                  }}
                >
                  Size: {size} km
                </span>
                <span
                  style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: '8px',
                    color: '#4a5070',
                  }}
                >
                  Miss: {dist} km
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});