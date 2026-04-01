// HeatmapPage.jsx — interactive model × dataset performance heatmap
import React, { useState, useMemo } from 'react';
import { getModelColor, DS_LABELS, DS_META } from '../chartConfig';
import ConfusionMatrix from './ConfusionMatrix';

const METRICS = [
  { key: 'Accuracy',          label: 'Accuracy',      fmt: v => `${(v * 100).toFixed(1)}%`  },
  { key: 'Macro_F1',          label: 'Macro F1',      fmt: v => `${(v * 100).toFixed(1)}%`  },
  { key: 'Balanced_Accuracy', label: 'Bal. Acc.',     fmt: v => `${(v * 100).toFixed(1)}%`  },
  { key: 'Cohen_Kappa',       label: "Cohen's κ",     fmt: v => v.toFixed(3)                },
  { key: 'MCC',               label: 'MCC',           fmt: v => v.toFixed(3)                },
  { key: 'Macro_AUC',         label: 'Macro AUC',     fmt: v => `${(v * 100).toFixed(1)}%`  },
  { key: 'Weighted_F1',       label: 'Weighted F1',   fmt: v => `${(v * 100).toFixed(1)}%`  },
];

const ALL_METRICS_DISPLAY = [
  ['Accuracy',          'Accuracy',       v => `${(v*100).toFixed(2)}%`],
  ['Balanced_Accuracy', 'Balanced Acc.',  v => `${(v*100).toFixed(2)}%`],
  ['Macro_Precision',   'Macro Prec.',    v => `${(v*100).toFixed(2)}%`],
  ['Macro_Recall',      'Macro Recall',   v => `${(v*100).toFixed(2)}%`],
  ['Macro_F1',          'Macro F1',       v => `${(v*100).toFixed(2)}%`],
  ['Weighted_F1',       'Weighted F1',    v => `${(v*100).toFixed(2)}%`],
  ['Cohen_Kappa',       "Cohen's κ",      v => v.toFixed(4)             ],
  ['MCC',               'MCC',            v => v.toFixed(4)             ],
  ['Macro_AUC',         'Macro AUC',      v => `${(v*100).toFixed(2)}%`],
  ['Top2_Accuracy',     'Top-2 Acc.',     v => `${(v*100).toFixed(2)}%`],
];

function cellBg(val, min, max, isCollapsed) {
  if (val == null) return 'rgba(255,255,255,0.03)';
  if (isCollapsed) return 'rgba(251,146,60,0.12)';
  const t = max > min ? (val - min) / (max - min) : 0.5;
  // red (0°) → amber (40°) → green (120°) → cyan (175°)
  const hue = Math.round(t * 175);
  const sat = 72;
  const lit = Math.round(30 + t * 14);
  return `hsla(${hue}, ${sat}%, ${lit}%, 0.72)`;
}

function MiniStat({ label, value }) {
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '0.55rem 0.75rem',
      minWidth: 0,
    }}>
      <div style={{ fontSize: '0.58rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', fontWeight: 700, color: 'var(--cyan)' }}>{value}</div>
    </div>
  );
}

export default function HeatmapPage({ data }) {
  const [metric,   setMetric]   = useState('Accuracy');
  const [selected, setSelected] = useState(null); // { model, dataset }

  const metaDef  = METRICS.find(m => m.key === metric);
  const models   = Object.keys(data);
  const datasets = Object.keys(data[models[0]]);

  /* ── build value grid ── */
  const grid = useMemo(() =>
    models.map(model => ({
      model,
      cells: datasets.map(ds => ({
        ds,
        val:       data[model]?.[ds]?.overall?.[metric] ?? null,
        collapsed: (data[model]?.[ds]?.overall?.Cohen_Kappa ?? 0) < 0.01,
      })),
    })),
  [data, models, datasets, metric]);

  /* ── colour scale bounds (exclude collapsed) ── */
  const activeVals = grid
    .flatMap(r => r.cells.filter(c => !c.collapsed).map(c => c.val))
    .filter(v => v != null);
  const minVal = Math.min(...activeVals);
  const maxVal = Math.max(...activeVals);

  /* ── averages ── */
  const rowAvgs = grid.map(r => {
    const vals = r.cells.filter(c => !c.collapsed && c.val != null).map(c => c.val);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });
  const colAvgs = datasets.map((_, ci) => {
    const vals = grid.filter(r => !r.cells[ci].collapsed && r.cells[ci].val != null).map(r => r.cells[ci].val);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  });

  /* ── best model per dataset ── */
  const bestPerDs = datasets.map((_, ci) => {
    let best = -Infinity, bestModel = null;
    grid.forEach(r => {
      const c = r.cells[ci];
      if (!c.collapsed && c.val != null && c.val > best) { best = c.val; bestModel = r.model; }
    });
    return bestModel;
  });

  const selData = selected ? data[selected.model]?.[selected.dataset] : null;

  /* ── gradient scale preview ── */
  const scaleStops = Array.from({ length: 12 }, (_, i) => {
    const t = i / 11;
    const val = minVal + t * (maxVal - minVal);
    return cellBg(val, minVal, maxVal, false);
  });

  return (
    <div>
      {/* ── Metric selector ── */}
      <div className="card card-sm mb fade-in">
        <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          Metric
        </div>
        <div className="pill-group">
          {METRICS.map(m => (
            <button key={m.key} className={`pill ${metric === m.key ? 'active' : ''}`} onClick={() => setMetric(m.key)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Heatmap grid ── */}
      <div className="card card-pad fade-in-2" style={{ overflowX: 'auto' }}>
        <div className="section-head" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="section-title">Model × Dataset Heatmap</div>
            <div className="section-sub">
              {metaDef?.label} · click any cell to inspect · ⚠ amber = collapsed model
            </div>
          </div>
          {/* Colour scale */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <span style={{ fontSize: '0.63rem', color: 'var(--text-3)' }}>{metaDef.fmt(minVal)}</span>
            <div style={{ display: 'flex', width: 100, height: 12, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {scaleStops.map((bg, i) => (
                <div key={i} style={{ flex: 1, background: bg }} />
              ))}
            </div>
            <span style={{ fontSize: '0.63rem', color: 'var(--text-3)' }}>{metaDef.fmt(maxVal)}</span>
          </div>
        </div>

        <div style={{ minWidth: `${datasets.length * 130 + 180}px` }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `180px repeat(${datasets.length}, 1fr) 90px`,
            gap: 4, marginBottom: 4,
          }}>
            <div />
            {datasets.map((ds, di) => (
              <div key={ds} style={{ textAlign: 'center', padding: '6px 4px' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-2)' }}>{DS_LABELS[ds] ?? ds}</div>
                <div style={{ fontSize: '0.57rem', color: 'var(--text-3)', marginTop: 2 }}>
                  {DS_META?.[ds]?.samples?.toLocaleString()} imgs
                </div>
                <div style={{ fontSize: '0.57rem', color: 'var(--cyan)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                  best: {bestPerDs[di]}
                </div>
              </div>
            ))}
            <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textAlign: 'center', padding: '6px 4px', fontWeight: 600 }}>
              MODEL<br />AVG
            </div>
          </div>

          {/* Data rows */}
          {grid.map((row, ri) => (
            <div key={row.model}
              style={{
                display: 'grid',
                gridTemplateColumns: `180px repeat(${datasets.length}, 1fr) 90px`,
                gap: 4, marginBottom: 4,
              }}
            >
              {/* Model label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingRight: 8, overflow: 'hidden' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: getModelColor(row.model), flexShrink: 0 }} />
                <span style={{ fontSize: '0.73rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.model}
                </span>
              </div>

              {/* Cells */}
              {row.cells.map(({ ds, val, collapsed }) => {
                const isSel = selected?.model === row.model && selected?.dataset === ds;
                return (
                  <div
                    key={ds}
                    onClick={() => setSelected(isSel ? null : { model: row.model, dataset: ds })}
                    style={{
                      background:   isSel ? 'rgba(56,189,248,0.22)' : cellBg(val, minVal, maxVal, collapsed),
                      borderRadius:  8,
                      padding:       '10px 4px',
                      textAlign:     'center',
                      cursor:        'pointer',
                      border:        isSel ? '1.5px solid var(--cyan)' : '1.5px solid transparent',
                      transition:    'all 0.18s ease',
                      boxShadow:     isSel ? '0 0 12px rgba(56,189,248,0.2)' : 'none',
                    }}
                  >
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.82rem', fontWeight: 700,
                      color: collapsed ? '#fbbf24' : 'var(--text)',
                    }}>
                      {val != null ? metaDef.fmt(val) : '—'}
                    </div>
                    {collapsed && (
                      <div style={{ fontSize: '0.52rem', color: '#fbbf24', marginTop: 2 }}>⚠ collapsed</div>
                    )}
                  </div>
                );
              })}

              {/* Row average */}
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 8, padding: '10px 4px', textAlign: 'center',
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem',
                fontWeight: 600, color: 'var(--text-2)',
              }}>
                {rowAvgs[ri] != null ? metaDef.fmt(rowAvgs[ri]) : '—'}
              </div>
            </div>
          ))}

          {/* Column averages */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `180px repeat(${datasets.length}, 1fr) 90px`,
            gap: 4, marginTop: 8, paddingTop: 8,
            borderTop: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', fontWeight: 700, display: 'flex', alignItems: 'center', paddingRight: 8 }}>DS AVG</div>
            {colAvgs.map((v, ci) => (
              <div key={ci} style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 4px',
                textAlign: 'center', fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-2)',
              }}>
                {v != null ? metaDef.fmt(v) : '—'}
              </div>
            ))}
            <div />
          </div>
        </div>
      </div>

      {/* ── Detail panel ── */}
      {selData && selected && (
        <div className="card card-pad fade-in" style={{ marginTop: '1.25rem' }}>
          <div className="section-head" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: getModelColor(selected.model), flexShrink: 0 }} />
                {selected.model}
                <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>×</span>
                {DS_LABELS[selected.dataset] ?? selected.dataset}
              </div>
              <div className="section-sub">
                {selData.confusion_matrix.flat().reduce((a, b) => a + b, 0).toLocaleString()} test samples
                {DS_META?.[selected.dataset] && ` · ${DS_META[selected.dataset].note}`}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', padding: '0.25rem 0.75rem', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 }}
            >
              ✕ Close
            </button>
          </div>

          {/* Overall metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: '0.6rem', marginBottom: '1.5rem' }}>
            {ALL_METRICS_DISPLAY.map(([k, label, fmt]) => {
              const v = selData.overall[k];
              if (v == null) return null;
              return (
                <MiniStat key={k} label={label} value={fmt(v)} />
              );
            })}
          </div>

          {/* Per-class table */}
          <div className="section-title" style={{ fontSize: '0.82rem', marginBottom: '0.75rem' }}>Per-Class Metrics</div>
          <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Precision</th>
                  <th>Recall</th>
                  <th>F1</th>
                  <th>Specificity</th>
                  <th>AUC</th>
                  <th>TP</th>
                  <th>FP</th>
                  <th>FN</th>
                  <th>TN</th>
                  <th>Support</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(selData.per_class).map(([cls, m]) => (
                  <tr key={cls}>
                    <td style={{ fontWeight: 700 }}>{cls}</td>
                    {[
                      [m.Precision,    v => `${(v*100).toFixed(2)}%`],
                      [m.Recall,       v => `${(v*100).toFixed(2)}%`],
                      [m.F1_Score,     v => `${(v*100).toFixed(2)}%`],
                      [m.Specificity,  v => `${(v*100).toFixed(2)}%`],
                      [m.AUC,          v => `${(v*100).toFixed(2)}%`],
                      [m.TP,           v => v.toLocaleString()       ],
                      [m.FP,           v => v.toLocaleString()       ],
                      [m.FN,           v => v.toLocaleString()       ],
                      [m.TN,           v => v.toLocaleString()       ],
                      [m.Support,      v => v.toLocaleString()       ],
                    ].map(([v, fmt], i) => (
                      <td key={i} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}>
                        {v != null ? fmt(v) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Confusion matrix */}
          <div style={{ maxWidth: 440, margin: '0 auto' }}>
            <div className="section-title" style={{ fontSize: '0.82rem', textAlign: 'center', marginBottom: '0.75rem' }}>
              Confusion Matrix
            </div>
            <ConfusionMatrix cm={selData.confusion_matrix} />
          </div>
        </div>
      )}
    </div>
  );
}
