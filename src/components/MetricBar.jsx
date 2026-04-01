// MetricBar.jsx — animated progress bar for a single metric
import React from 'react';

export default function MetricBar({ label, value, color = 'var(--grad-a)', max = 1, format = v => `${(v * 100).toFixed(1)}%` }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ marginBottom: '0.65rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>
          {format(value)}
        </span>
      </div>
      <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: '99px',
          transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
    </div>
  );
}
