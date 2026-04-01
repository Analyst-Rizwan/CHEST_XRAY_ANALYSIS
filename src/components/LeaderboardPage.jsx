// LeaderboardPage.jsx — ranked model comparison table + horizontal bar
import React, { useMemo, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getModelColor, getModelColorRgb, DS_LABELS, DS_META, barOptions } from '../chartConfig';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const SORT_KEYS = [
  { key: 'Accuracy',          label: 'Accuracy'      },
  { key: 'Macro_F1',          label: 'Macro F1'      },
  { key: 'Balanced_Accuracy', label: 'Balanced Acc.' },
  { key: 'MCC',               label: 'MCC'           },
  { key: 'Cohen_Kappa',       label: 'Kappa'         },
  { key: 'Macro_AUC',         label: 'AUC'           },
];

/** A model is "collapsed" when its Kappa ≈ 0 (random / single-class prediction) */
const isCollapsed = row => (row.Cohen_Kappa ?? 0) < 0.01;

function RankBadge({ rank }) {
  const cls = rank === 1 ? 'rank rank-1' : rank === 2 ? 'rank rank-2' : rank === 3 ? 'rank rank-3' : 'rank rank-n';
  return <div className={cls}>{rank}</div>;
}

function delta(v, best) {
  const d = ((v - best) * 100).toFixed(2);
  if (d >= -0.01) return null;
  return <span style={{ fontSize: '0.68rem', color: 'var(--rose)', fontFamily: 'JetBrains Mono, monospace' }}>-{Math.abs(d)}%</span>;
}

export default function LeaderboardPage({ data, selectedDataset, setSelectedDataset }) {
  const [sortKey, setSortKey] = useState('Accuracy');
  const models   = Object.keys(data);
  const datasets = Object.keys(data[models[0]]);

  const dsMeta = DS_META?.[selectedDataset];

  /* build ranked rows */
  const rows = useMemo(() => {
    return models.map(name => {
      const ds = data[name][selectedDataset];
      if (!ds) return null;
      const ov = ds.overall;
      return { name, ...ov };
    }).filter(Boolean).sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));
  }, [data, selectedDataset, sortKey, models]);

  /* Exclude collapsed models from "best" calculation so they don't pollute delta */
  const activeRows = rows.filter(r => !isCollapsed(r));
  const bestVal = activeRows[0]?.[sortKey] ?? rows[0]?.[sortKey] ?? 1;

  /* horizontal bar data for top metric — exclude collapsed models */
  const hbarData = useMemo(() => ({
    labels: activeRows.map(r => r.name),
    datasets: [{
      label: SORT_KEYS.find(s => s.key === sortKey)?.label ?? sortKey,
      data:  activeRows.map(r => +((r[sortKey] ?? 0) * 100).toFixed(2)),
      backgroundColor: activeRows.map(r => `rgba(${getModelColorRgb(r.name)},0.8)`),
      borderColor:     activeRows.map(r => getModelColor(r.name)),
      borderWidth: 1,
      borderRadius: 6,
    }],
  }), [activeRows, sortKey]);

  const hbarOpts = {
    ...barOptions({ indexAxis: 'y', maxY: 100 }),
    plugins: {
      ...barOptions({ indexAxis: 'y', maxY: 100 }).plugins,
      legend: { display: false },
    },
  };

  const collapsedModels = rows.filter(isCollapsed).map(r => r.name);

  return (
    <div>
      {/* Dataset + sort controls */}
      <div className="card card-pad mb fade-in" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Dataset</div>
          <div className="pill-group">
            {datasets.map(d => (
              <button key={d} className={`pill ${selectedDataset === d ? 'active' : ''}`} onClick={() => setSelectedDataset(d)}>
                {DS_LABELS[d] ?? d}
                {DS_META?.[d] && (
                  <span style={{ marginLeft: '0.35rem', fontSize: '0.64rem', opacity: 0.65 }}>
                    {DS_META[d].samples.toLocaleString()}
                  </span>
                )}
              </button>
            ))}
          </div>
          {dsMeta && (
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: '0.4rem' }}>
              {dsMeta.samples.toLocaleString()} test images · {dsMeta.note}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Sort By</div>
          <div className="pill-group">
            {SORT_KEYS.map(s => (
              <button key={s.key} className={`pill ${sortKey === s.key ? 'active' : ''}`} onClick={() => setSortKey(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Collapsed model warning */}
      {collapsedModels.length > 0 && (
        <div className="fade-in" style={{
          background: 'rgba(251,146,60,0.08)',
          border: '1px solid rgba(251,146,60,0.25)',
          borderRadius: '10px',
          padding: '0.65rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.78rem',
          color: '#fbbf24',
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠</span>
          <span>
            <strong>{collapsedModels.join(', ')}</strong> collapsed to single-class prediction on this dataset
            (Cohen's κ ≈ 0, MCC ≈ 0). Excluded from visual ranking bar. This is expected for Inception-V3 at 299×299
            when evaluated with 224×224 eval transform — retrain with correct transform to fix.
          </span>
        </div>
      )}

      {/* Domain-shift note for DS2 */}
      {selectedDataset === 'DS2_PA_View' && (
        <div className="fade-in" style={{
          background: 'rgba(56,189,248,0.06)',
          border: '1px solid rgba(56,189,248,0.18)',
          borderRadius: '10px',
          padding: '0.65rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.78rem',
          color: 'var(--cyan)',
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>ℹ</span>
          <span>
            DS2 has significant <strong>domain shift</strong> — all models were trained on DS1 (341 images) and tested
            here on 4,575 images, explaining the lower scores. Best model: <strong>EfficientNet-B0 (59.3% Acc)</strong>.
          </span>
        </div>
      )}

      <div className="grid-2 fade-in-2">
        {/* Ranked table */}
        <div className="card card-pad" style={{ gridColumn: 'span 2' }}>
          <div className="section-head">
            <div className="section-title">
              Model Rankings — {DS_LABELS[selectedDataset] ?? selectedDataset}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>
              Sorted by {SORT_KEYS.find(s => s.key === sortKey)?.label}
            </div>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Model</th>
                  <th>Accuracy</th>
                  <th>Bal. Acc.</th>
                  <th>Macro F1</th>
                  <th>Wt. F1</th>
                  <th>Kappa</th>
                  <th>MCC</th>
                  <th>Macro AUC</th>
                  <th>Top-2</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const collapsed = isCollapsed(r);
                  return (
                    <tr key={r.name} style={collapsed ? { opacity: 0.5 } : undefined}>
                      <td><RankBadge rank={i + 1} /></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: getModelColor(r.name), flexShrink: 0 }} />
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>{r.name}</span>
                          {collapsed && (
                            <span style={{
                              fontSize: '0.6rem',
                              background: 'rgba(251,146,60,0.15)',
                              color: '#fbbf24',
                              border: '1px solid rgba(251,146,60,0.3)',
                              borderRadius: '4px',
                              padding: '0 4px',
                              fontWeight: 600,
                              letterSpacing: '0.03em',
                            }}>⚠ COLLAPSED</span>
                          )}
                        </div>
                      </td>
                      {[
                        'Accuracy','Balanced_Accuracy','Macro_F1','Weighted_F1',
                        'Cohen_Kappa','MCC','Macro_AUC','Top2_Accuracy',
                      ].map(key => {
                        const v = r[key];
                        const isBest = !collapsed && Math.abs((v ?? 0) - bestVal) < 0.0001 && key === sortKey;
                        return (
                          <td key={key}>
                            <span style={{ color: isBest ? 'var(--cyan)' : undefined, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
                              {v != null ? (v * 100).toFixed(2) + '%' : '—'}
                            </span>
                            {key === sortKey && i > 0 && !collapsed && delta(v, bestVal)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Horizontal bar — active models only */}
      <div className="card card-pad fade-in-3">
        <div className="section-head">
          <div>
            <div className="section-title">Visual Ranking — {SORT_KEYS.find(s => s.key === sortKey)?.label}</div>
            <div className="section-sub">
              {DS_LABELS[selectedDataset] ?? selectedDataset}
              {collapsedModels.length > 0 && ` · collapsed models hidden`}
            </div>
          </div>
        </div>
        <div className="chart-wrap" style={{ height: `${Math.max(220, activeRows.length * 46)}px` }}>
          <Bar data={hbarData} options={hbarOpts} />
        </div>
      </div>
    </div>
  );
}
