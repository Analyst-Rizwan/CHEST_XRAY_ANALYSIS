// ConfusionMatrix.jsx — interactive heatmap with hover highlights
import React, { useState } from 'react';

const CLASS_LABELS = ['COVID', 'NORMAL', 'PNEUMONIA'];

function heatColor(val, max) {
  const t = max > 0 ? val / max : 0;
  if (t > 0.6)  return `rgba(56,189,248,${0.15 + t * 0.7})`;
  if (t > 0.2)  return `rgba(129,140,248,${0.1 + t * 0.5})`;
  return `rgba(255,255,255,${0.03 + t * 0.12})`;
}

export default function ConfusionMatrix({ cm }) {
  const [hover, setHover] = useState(null); // [row, col]
  if (!cm || cm.length === 0) return <p style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>No data</p>;

  const flat   = cm.flat();
  const maxVal = Math.max(...flat);
  const total  = flat.reduce((a, b) => a + b, 0);
  const n      = cm.length;
  const labels = CLASS_LABELS.slice(0, n);

  return (
    <div>
      {/* Axis label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Predicted →</span>
        <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <span style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>← True</span>
      </div>

      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${n}, 1fr)`, gap: '4px', marginBottom: '4px' }}>
        <div />
        {labels.map(l => (
          <div key={l} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0' }}>
            {l}
          </div>
        ))}
      </div>

      {/* Matrix rows */}
      {cm.map((row, ri) => (
        <div key={ri} style={{ display: 'grid', gridTemplateColumns: `60px repeat(${n}, 1fr)`, gap: '4px', marginBottom: '4px' }}>
          {/* Row label */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {labels[ri]}
          </div>

          {row.map((val, ci) => {
            const isDiag  = ri === ci;
            const isHover = hover && (hover[0] === ri || hover[1] === ci);
            const pct     = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
            const rowTotal = row.reduce((a, b) => a + b, 0);
            const recall  = rowTotal > 0 ? ((val / rowTotal) * 100).toFixed(1) : '0.0';

            return (
              <div
                key={ci}
                onMouseEnter={() => setHover([ri, ci])}
                onMouseLeave={() => setHover(null)}
                title={`True: ${labels[ri]} | Pred: ${labels[ci]}\nCount: ${val} (${pct}% of total)\nRow recall: ${recall}%`}
                style={{
                  background:  heatColor(val, maxVal),
                  borderRadius: '7px',
                  padding:      '10px 6px',
                  textAlign:    'center',
                  cursor:       'default',
                  border:       isDiag
                    ? '1px solid rgba(56,189,248,0.35)'
                    : isHover
                      ? '1px solid rgba(255,255,255,0.08)'
                      : '1px solid transparent',
                  transition:   'all 0.2s ease',
                  transform:    hover && hover[0] === ri && hover[1] === ci ? 'scale(1.06)' : 'scale(1)',
                  boxShadow:    isDiag ? '0 0 8px rgba(56,189,248,0.15)' : 'none',
                }}
              >
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem', fontWeight: 700, color: isDiag ? 'var(--cyan)' : 'var(--text)' }}>
                  {val}
                </div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginTop: '2px' }}>
                  {pct}%
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.75rem' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>Low</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map(t => (
          <div key={t} style={{ flex: 1, height: '6px', borderRadius: '3px', background: heatColor(t, 1) }} />
        ))}
        <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>High</span>
      </div>
    </div>
  );
}
