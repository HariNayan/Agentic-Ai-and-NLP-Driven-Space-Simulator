'use client';

export default function PanelFooter({ source, lastUpdated }: { source: string; lastUpdated: Date | null }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 8px', borderTop: '1px solid #161a26',
      fontFamily: '"Courier New", monospace', fontSize: '6px', color: '#3a4060',
    }}>
      <span>{source}</span>
      <span>{lastUpdated ? lastUpdated.toLocaleTimeString() : '--'}</span>
    </div>
  );
}
