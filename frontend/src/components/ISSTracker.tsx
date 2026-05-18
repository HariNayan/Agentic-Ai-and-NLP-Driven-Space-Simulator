'use client';

import { useEffect, useState } from 'react';

interface ISSData {
  iss_position: { latitude: string; longitude: string };
  timestamp: number;
}

export default function ISSTracker() {
  const [data, setData] = useState<ISSData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchISS = async () => {
      try {
        const r = await fetch('/api/iss');
        if (!r.ok) throw new Error('API limit');
        const data = await r.json();
        const lat = data?.iss_position?.latitude;
        if (lat !== undefined && isMounted) {
          setData(data);
          setError(false);
        }
      } catch (err) {
        if (isMounted) setError(true);
      }
    };
    fetchISS();
    const interval = setInterval(fetchISS, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const lat = data?.iss_position?.latitude ? parseFloat(data.iss_position.latitude).toFixed(2) : '--';
  const lng = data?.iss_position?.longitude ? parseFloat(data.iss_position.longitude).toFixed(2) : '--';
  const hemisphere = (data?.iss_position?.latitude && data?.iss_position?.longitude)
    ? `${parseFloat(data.iss_position.latitude) >= 0 ? 'N' : 'S'} / ${
        parseFloat(data.iss_position.longitude) >= 0 ? 'E' : 'W'
      }`
    : '--';

  const rows = [
    { label: 'Latitude', value: `${lat}°` },
    { label: 'Longitude', value: `${lng}°` },
    { label: 'Hemisphere', value: hemisphere },
    { label: 'Altitude', value: '408 km' },
    { label: 'Speed', value: '7.66 km/s' },
    { label: 'Signal', value: error ? 'LOST' : data ? 'LOCKED' : '--', valueColor: error ? '#c0473a' : data ? '#4a8c6f' : undefined },
  ];

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0c14',
      }}
    >
      <div
        style={{
          flex: 1,
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {rows.map(({ label, value, valueColor }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #161a26',
              paddingBottom: '4px',
            }}
          >
            <span
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: '8px',
                color: '#4a5070',
                textTransform: 'uppercase',
                letterSpacing: '.06em',
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontFamily: "'Courier New', monospace",
                fontSize: '10px',
                color: valueColor || '#6a9fd8',
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}