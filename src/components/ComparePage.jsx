// ComparePage.jsx — macro comparison across all models and datasets
import React, { useMemo, useState } from 'react';
import { Chart as ChartJS, LinearScale, PointElement, Tooltip, Legend } from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import { getModelColor, getModelColorRgb, DS_LABELS, BASE_TOOLTIP, BASE_TICK, BASE_GRID, BASE_FONT } from '../chartConfig';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

const METRICS = [
  { key: 'Accuracy',          label: 'Accuracy'      },
  { key: 'Balanced_Accuracy', label: 'Balanced Acc.' },
  { key: 'Macro_F1',          label: 'Macro F1'      },
  { key: 'Weighted_F1',       label: 'Weighted F1'   },
  { key: 'Cohen_Kappa',       label: 'Kappa'         },
  { key: 'MCC',               label: 'MCC'           },
  { key: 'Macro_AUC',         label: 'Macro AUC'     },
  { key: 'Top2_Accuracy',     label: 'Top-2 Acc.'    },
];

const scatterOptions = (xLabel, yLabel) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600 },
  plugins: {
    legend: { labels: { color: '#94a3b8', font: BASE_FONT, boxWidth: 12, padding: 16 } },
    tooltip: {
      ...BASE_TOOLTIP,
      callbacks: {
        label: (ctx) => {
          const pt = ctx.raw;
          return `${pt.model} on ${DS_LABELS[pt.dataset] ?? pt.dataset}: ${xLabel}=${(pt.x).toFixed(1)}%, ${yLabel}=${(pt.y).toFixed(1)}%`;
        }
      }
    },
  },
  scales: {
    x: {
      ticks: { ...BASE_TICK, callback: v => `${v}%` },
      grid: BASE_GRID,
      title: { display: true, text: xLabel, color: '#475569', font: BASE_FONT },
    },
    y: {
      ticks: { ...BASE_TICK, callback: v => `${v}%` },
      grid: BASE_GRID,
      title: { display: true, text: yLabel, color: '#475569', font: BASE_FONT },
    },
  },
});

export default function ComparePage({ data }) {
  const models   = Object.keys(data);
  const datasets = Object.keys(data[models[0]]);

  const [xAxis, setXAxis] = useState('Accuracy');
  const [yAxis, setYAxis] = useState('Macro_F1');
  const [sortCol, setSortCol] = useState('Accuracy');
  const [sortDesc, setSortDesc] = useState(true);

  /* ── Flat list of all Model × Dataset combinations ── */
  const allRows = useMemo(() => {
    const rows = [];
    models.forEach(model => {
      datasets.forEach(ds => {
        const ov = data[model]?.[ds]?.overall;
        if (ov) {
          rows.push({
            model,
            dataset: ds,
            collapsed: (ov.Cohen_Kappa ?? 0) < 0.01,
            ...ov
          });
        }
      });
    });
    return rows;
  }, [data, models, datasets]);

  /* ── Sort table ── */
  const sortedRows = useMemo(() => {
    return [...allRows].sort((a, b) => {
      if (a.model === 'inception_v3' && b.model !== 'inception_v3') return 1; // push collapsed inception to bottom
      if (b.model === 'inception_v3' && a.model !== 'inception_v3') return -1;
      const vA = a[sortCol] ?? 0;
      const vB = b[sortCol] ?? 0;
      return sortDesc ? vB - vA : vA - vB;
    });
  }, [allRows, sortCol, sortDesc]);

  /* ── Scatter plot data ── */
  const scatterData = useMemo(() => {
    return {
      datasets: models.map(m => {
        return {
          label: m,
          data: datasets.map(ds => {
            const ov = data[m]?.[ds]?.overall;
            if (!ov) return null;
            return {
              x: (ov[xAxis] ?? 0) * 100,
              y: (ov[yAxis] ?? 0) * 100,
              model: m,
              dataset: ds
            };
          }).filter(Boolean),
          backgroundColor: `rgba(${getModelColorRgb(m)}, 0.6)`,
          borderColor: getModelColor(m),
          borderWidth: 1.5,
          pointRadius: m === 'inception_v3' ? 3 : 6,
          pointHoverRadius: 9,
          pointStyle: m === 'inception_v3' ? 'triangle' : 'circle',
        };
      })
    };
  }, [data, models, datasets, xAxis, yAxis]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDesc(!sortDesc);
    else { setSortCol(col); setSortDesc(true); }
  };

  return (
    <div>
      {/* ── Macro Scatter Plot ── */}
      <div className="card card-pad mb fade-in">
        <div className="section-head" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>
          <div>
            <div className="section-title">Macro Scatter Plot</div>
            <div className="section-sub">Compare all models across all datasets: {METRICS.find(m => m.key === xAxis)?.label} vs {METRICS.find(m => m.key === yAxis)?.label}</div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>X-Axis</div>
              <select className="model-select" style={{ minWidth: 140, padding: '0.4rem 0.6rem' }} value={xAxis} onChange={e => setXAxis(e.target.value)}>
                {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Y-Axis</div>
              <select className="model-select" style={{ minWidth: 140, padding: '0.4rem 0.6rem' }} value={yAxis} onChange={e => setYAxis(e.target.value)}>
                {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        
        <div className="chart-wrap" style={{ height: 400 }}>
          <Scatter data={scatterData} options={scatterOptions(METRICS.find(m => m.key === xAxis)?.label, METRICS.find(m => m.key === yAxis)?.label)} />
        </div>
      </div>

      {/* ── All Combinations Table ── */}
      <div className="card card-pad fade-in-2">
        <div className="section-head">
          <div>
            <div className="section-title">Global Rankings</div>
            <div className="section-sub">All {models.length} models × {datasets.length} datasets ({sortedRows.length} combinations)</div>
          </div>
        </div>
        
        <div className="tbl-wrap" style={{ maxHeight: 600, overflowY: 'auto' }}>
          <table className="tbl">
            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--surface)', zIndex: 10 }}>
              <tr>
                <th>#</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('model')}>Model {sortCol === 'model' && (sortDesc ? '▼' : '▲')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('dataset')}>Dataset {sortCol === 'dataset' && (sortDesc ? '▼' : '▲')}</th>
                {METRICS.map(m => (
                  <th key={m.key} style={{ cursor: 'pointer', color: sortCol === m.key ? 'var(--cyan)' : undefined }} onClick={() => handleSort(m.key)}>
                    {m.label} {sortCol === m.key && (sortDesc ? '▼' : '▲')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => (
                <tr key={`${row.model}-${row.dataset}`} style={row.collapsed ? { opacity: 0.45 } : undefined}>
                  <td style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>{i + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: getModelColor(row.model), flexShrink: 0 }} />
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', fontWeight: 600 }}>{row.model}</span>
                      {row.collapsed && <span style={{ fontSize: '0.58rem', background: 'rgba(251,146,60,0.12)', color: '#fbbf24', border: '1px solid rgba(251,146,60,0.25)', borderRadius: 4, padding: '0 4px' }}>⚠</span>}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>{DS_LABELS[row.dataset] ?? row.dataset}</td>
                  {METRICS.map(m => (
                    <td key={m.key} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: sortCol === m.key ? 'var(--cyan)' : undefined }}>
                      {row[m.key] != null ? `${(row[m.key] * 100).toFixed(2)}%` : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
