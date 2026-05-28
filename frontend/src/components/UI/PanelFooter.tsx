'use client';

export default function PanelFooter({
  source,
  lastUpdated,
  updatedLabel,
}: {
  source: string;
  lastUpdated: Date | null;
  updatedLabel?: string;
}) {
  const updatedText = updatedLabel ?? (lastUpdated ? lastUpdated.toLocaleTimeString() : '--');

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 8px', borderTop: '1px solid #161a26',
      fontFamily: '"Courier New", monospace', fontSize: '6px', color: '#3a4060',
    }}>
      <span>SRC: {source}</span>
      <span>UPDATED: {updatedText}</span>
    </div>
  );
}
