// PerClassPage.jsx — per-class drill-down + cross-model comparison
import React, { useState, useMemo } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Tooltip, Legend, RadialLinearScale, PointElement, LineElement, Filler,
} from 'chart.js';
import { Bar, Radar } from 'react-chartjs-2';
import {
  DS_LABELS, DS_META, CLASS_COLORS,
  getModelColor, getModelColorRgb,
  barOptions, radarOptions,
} from '../chartConfig';
import ConfusionMatrix from './ConfusionMatrix';
import MetricBar from './MetricBar';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend,
  RadialLinearScale, PointElement, LineElement, Filler);

const CLASS_LIST    = ['COVID', 'NORMAL', 'PNEUMONIA'];
const CLS_METRICS   = ['Precision','Recall','Sensitivity','Specificity','F1_Score','AUC','PPV','NPV'];
const CLS_LBL_MAP   = {
  Precision:'Precision', Recall:'Recall', Sensitivity:'Sensitivity',
  Specificity:'Specificity', F1_Score:'F1 Score', AUC:'AUC-ROC', PPV:'PPV', NPV:'NPV',
};

const COMPARE_METRICS = [
  { key: 'Precision',   label: 'Precision'   },
  { key: 'Recall',      label: 'Recall'      },
  { key: 'F1_Score',    label: 'F1 Score'    },
  { key: 'Specificity', label: 'Specificity' },
  { key: 'AUC',         label: 'AUC-ROC'     },
  { key: 'PPV',         label: 'PPV'         },
  { key: 'NPV',         label: 'NPV'         },
];

/* per-class detail card */
function ClassCard({ name, metrics }) {
  const clr = CLASS_COLORS[name]?.hex ?? '#94a3b8';
  const rgb = CLASS_COLORS[name]?.rgb ?? '148,163,184';
  return (
    <div className="card card-pad" style={{ borderTop: `2px solid ${clr}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: clr }} />
        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{name}</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: 'var(--text-2)' }}>
          n={metrics.Support?.toLocaleString() ?? '—'}
        </span>
      </div>

      {CLS_METRICS.map(k => {
        const v = metrics[k];
        if (v == null) return null;
        return (
          <MetricBar key={k} label={CLS_LBL_MAP[k]} value={v} max={1}
            color={`rgba(${rgb},0.85)`} />
        );
      })}

      {/* TP / FP / FN / TN chips */}
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem' }}>
        {[['TP', metrics.TP, '#34d399'], ['FP', metrics.FP, '#f87171'],
          ['FN', metrics.FN, '#fbbf24'], ['TN', metrics.TN, '#818cf8']].map(([l, v, c]) => (
          <div key={l} style={{
            flex: 1, background: 'var(--surface-2)', border: `1px solid ${c}22`,
            borderRadius: 7, padding: '0.4rem 0.3rem', textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.58rem', color: c, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)' }}>
              {v?.toLocaleString() ?? '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PerClassPage({ data, selectedModel, selectedDataset, setSelectedDataset }) {
  const [tab,          setTab]          = useState('overview');   // 'overview' | 'compare'
  const [activeClass,  setActiveClass]  = useState('COVID');
  const [compareMetric,setCompareMetric]= useState('F1_Score');

  const models   = Object.keys(data);
  const datasets = Object.keys(data[selectedModel]);
  const dsData   = data[selectedModel][selectedDataset];
  const classes  = Object.keys(dsData.per_class);

  /* ── F1 per class × dataset (overview grouped bar) ── */
  const f1Bar = useMemo(() => ({
    labels: datasets.map(d => DS_LABELS[d] ?? d),
    datasets: CLASS_LIST.filter(c => classes.includes(c)).map(cls => ({
      label: cls,
      data: datasets.map(d => {
        const v = data[selectedModel][d]?.per_class?.[cls]?.F1_Score;
        return v != null ? +(v * 100).toFixed(2) : null;
      }),
      backgroundColor: `rgba(${CLASS_COLORS[cls]?.rgb ?? '148,163,184'},0.72)`,
      borderColor:     CLASS_COLORS[cls]?.hex ?? '#94a3b8',
      borderWidth: 1, borderRadius: 5,
    })),
  }), [data, selectedModel, datasets, classes]);

  /* ── Radar: per-class metrics for selected dataset ── */
  const radarData = useMemo(() => ({
    labels: ['Precision','Recall','Sensitivity','Specificity','F1','AUC','PPV','NPV'],
    datasets: CLASS_LIST.filter(c => classes.includes(c)).map(cls => {
      const m = dsData.per_class[cls];
      const color = CLASS_COLORS[cls];
      return {
        label: cls,
        data: [m.Precision, m.Recall, m.Sensitivity ?? m.Recall,
               m.Specificity, m.F1_Score, m.AUC ?? 0, m.PPV ?? m.Precision, m.NPV ?? 0,
        ].map(v => +(v * 100).toFixed(2)),
        backgroundColor: `rgba(${color?.rgb ?? '148,163,184'},0.08)`,
        borderColor:     color?.hex ?? '#94a3b8',
        borderWidth: 2,
        pointBackgroundColor: color?.hex ?? '#94a3b8',
        pointRadius: 3,
        fill: true,
      };
    }),
  }), [dsData, classes]);

  /* ── Cross-model comparison: selected class + metric across all models ── */
  const crossModelBar = useMemo(() => {
    const activeModels = models.filter(m => {
      const kappa = data[m]?.[selectedDataset]?.overall?.Cohen_Kappa ?? 0;
      return kappa >= 0.01; // exclude collapsed
    });
    return {
      labels: activeModels,
      datasets: [{
        label: `${activeClass} — ${COMPARE_METRICS.find(m => m.key === compareMetric)?.label}`,
        data: activeModels.map(m => {
          const v = data[m]?.[selectedDataset]?.per_class?.[activeClass]?.[compareMetric];
          return v != null ? +(v * 100).toFixed(2) : null;
        }),
        backgroundColor: activeModels.map(m => `rgba(${getModelColorRgb(m)},0.78)`),
        borderColor:     activeModels.map(m => getModelColor(m)),
        borderWidth: 1,
        borderRadius: 6,
      }],
    };
  }, [data, models, selectedDataset, activeClass, compareMetric]);

  /* ── Full cross-model table for selected class ── */
  const crossModelRows = useMemo(() =>
    models.map(m => {
      const perCls = data[m]?.[selectedDataset]?.per_class?.[activeClass];
      const collapsed = (data[m]?.[selectedDataset]?.overall?.Cohen_Kappa ?? 0) < 0.01;
      return { model: m, metrics: perCls, collapsed };
    }).filter(r => r.metrics != null)
      .sort((a, b) => (b.metrics.F1_Score ?? 0) - (a.metrics.F1_Score ?? 0)),
  [data, models, selectedDataset, activeClass]);

  /* ── AUC grouped bar across datasets for all classes (selected model) ── */
  const aucBar = useMemo(() => ({
    labels: datasets.map(d => DS_LABELS[d] ?? d),
    datasets: CLASS_LIST.filter(c => classes.includes(c)).map(cls => ({
      label: cls,
      data: datasets.map(d => {
        const v = data[selectedModel][d]?.per_class?.[cls]?.AUC;
        return v != null ? +(v * 100).toFixed(2) : null;
      }),
      backgroundColor: `rgba(${CLASS_COLORS[cls]?.rgb ?? '148,163,184'},0.72)`,
      borderColor:     CLASS_COLORS[cls]?.hex ?? '#94a3b8',
      borderWidth: 1, borderRadius: 5,
    })),
  }), [data, selectedModel, datasets, classes]);

  return (
    <div>
      {/* ── Controls ── */}
      <div className="card card-sm mb fade-in" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Dataset</div>
          <div className="pill-group">
            {datasets.map(d => (
              <button key={d} className={`pill ${selectedDataset === d ? 'active' : ''}`} onClick={() => setSelectedDataset(d)}>
                {DS_LABELS[d] ?? d}
                {DS_META?.[d] && <span style={{ marginLeft: '0.3rem', fontSize: '0.62rem', opacity: 0.65 }}>{DS_META[d].samples.toLocaleString()}</span>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>View</div>
          <div className="pill-group">
            <button className={`pill ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
            <button className={`pill ${tab === 'compare'  ? 'active' : ''}`} onClick={() => setTab('compare')}>Cross-Model Compare</button>
            <button className={`pill ${tab === 'auc'      ? 'active' : ''}`} onClick={() => setTab('auc')}>AUC Analysis</button>
          </div>
        </div>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <>
          {/* Charts row */}
          <div className="grid-2 fade-in-2">
            <div className="card card-pad">
              <div className="section-head">
                <div>
                  <div className="section-title">F1 Score — Per Class × Dataset</div>
                  <div className="section-sub">Model: {selectedModel}</div>
                </div>
              </div>
              <div className="chart-wrap">
                <Bar data={f1Bar} options={barOptions({ maxY: 100 })} />
              </div>
            </div>

            <div className="card card-pad">
              <div className="section-head">
                <div>
                  <div className="section-title">Class Radar — {DS_LABELS[selectedDataset] ?? selectedDataset}</div>
                  <div className="section-sub">8 metrics per class</div>
                </div>
              </div>
              <div style={{ height: 280 }}>
                <Radar data={radarData} options={radarOptions()} />
              </div>
            </div>
          </div>

          {/* Class cards */}
          <div className="fade-in-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
            {CLASS_LIST.filter(c => classes.includes(c)).map(cls => (
              <ClassCard key={cls} name={cls} metrics={dsData.per_class[cls]} />
            ))}
          </div>

          {/* Confusion matrix */}
          <div className="card card-pad fade-in-4">
            <div className="section-head">
              <div className="section-title">Confusion Matrix — {DS_LABELS[selectedDataset] ?? selectedDataset}</div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                Model: <strong style={{ color: 'var(--cyan)' }}>{selectedModel}</strong>
              </span>
            </div>
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              <ConfusionMatrix cm={dsData.confusion_matrix} />
            </div>
          </div>
        </>
      )}

      {/* ── CROSS-MODEL COMPARE TAB ── */}
      {tab === 'compare' && (
        <>
          {/* Class + metric selectors */}
          <div className="card card-sm mb fade-in" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Class</div>
              <div className="pill-group">
                {CLASS_LIST.filter(c => classes.includes(c)).map(c => (
                  <button
                    key={c}
                    className={`pill ${activeClass === c ? 'active' : ''}`}
                    onClick={() => setActiveClass(c)}
                    style={{ borderColor: activeClass === c ? CLASS_COLORS[c]?.hex : undefined }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: CLASS_COLORS[c]?.hex, display: 'inline-block', marginRight: '0.4rem' }} />
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Metric</div>
              <div className="pill-group">
                {COMPARE_METRICS.map(m => (
                  <button key={m.key} className={`pill ${compareMetric === m.key ? 'active' : ''}`} onClick={() => setCompareMetric(m.key)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Horizontal bar — all models */}
          <div className="card card-pad fade-in-2">
            <div className="section-head">
              <div>
                <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: CLASS_COLORS[activeClass]?.hex, display: 'inline-block' }} />
                  {activeClass} — {COMPARE_METRICS.find(m => m.key === compareMetric)?.label}
                </div>
                <div className="section-sub">
                  {DS_LABELS[selectedDataset] ?? selectedDataset} · collapsed models excluded
                </div>
              </div>
            </div>
            <div className="chart-wrap" style={{ height: `${Math.max(220, crossModelBar.labels.length * 50)}px` }}>
              <Bar
                data={crossModelBar}
                options={{
                  ...barOptions({ indexAxis: 'y', maxY: 100 }),
                  plugins: { ...barOptions({ indexAxis: 'y', maxY: 100 }).plugins, legend: { display: false } },
                }}
              />
            </div>
          </div>

          {/* Full cross-model table */}
          <div className="card card-pad fade-in-3">
            <div className="section-head">
              <div className="section-title">All Models — {activeClass} Class Detail</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>{DS_LABELS[selectedDataset] ?? selectedDataset}</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Model</th>
                    <th>Precision</th>
                    <th>Recall</th>
                    <th>F1</th>
                    <th>Specificity</th>
                    <th>AUC-ROC</th>
                    <th>PPV</th>
                    <th>NPV</th>
                    <th>TP</th>
                    <th>FP</th>
                    <th>FN</th>
                    <th>Support</th>
                  </tr>
                </thead>
                <tbody>
                  {crossModelRows.map((row, i) => (
                    <tr key={row.model} style={row.collapsed ? { opacity: 0.45 } : undefined}>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-3)', fontSize: '0.78rem' }}>{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: getModelColor(row.model), flexShrink: 0 }} />
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}>{row.model}</span>
                          {row.collapsed && (
                            <span style={{ fontSize: '0.58rem', background: 'rgba(251,146,60,0.12)', color: '#fbbf24', border: '1px solid rgba(251,146,60,0.25)', borderRadius: 4, padding: '0 4px' }}>⚠ collapsed</span>
                          )}
                        </div>
                      </td>
                      {['Precision','Recall','F1_Score','Specificity','AUC','PPV','NPV'].map(k => {
                        const v = row.metrics[k];
                        const isBest = !row.collapsed && v != null &&
                          v === Math.max(...crossModelRows.filter(r => !r.collapsed).map(r => r.metrics[k] ?? 0));
                        return (
                          <td key={k} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: isBest ? 'var(--cyan)' : undefined }}>
                            {v != null ? `${(v * 100).toFixed(2)}%` : '—'}
                          </td>
                        );
                      })}
                      {[row.metrics.TP, row.metrics.FP, row.metrics.FN, row.metrics.Support].map((v, i) => (
                        <td key={i} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}>
                          {v?.toLocaleString() ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── AUC TAB ── */}
      {tab === 'auc' && (
        <>
          <div className="card card-pad fade-in-2">
            <div className="section-head">
              <div>
                <div className="section-title">AUC-ROC per Class × Dataset</div>
                <div className="section-sub">Model: {selectedModel} · one-vs-rest AUC</div>
              </div>
            </div>
            <div className="chart-wrap">
              <Bar data={aucBar} options={barOptions({ maxY: 100, yLabel: '%', xLabel: 'Dataset' })} />
            </div>
          </div>

          {/* AUC summary across all models on selected dataset */}
          <div className="card card-pad fade-in-3">
            <div className="section-head">
              <div className="section-title">AUC by Model — {DS_LABELS[selectedDataset] ?? selectedDataset}</div>
              <div className="section-sub">Per-class one-vs-rest AUC for all models</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Macro AUC</th>
                    {CLASS_LIST.filter(c => classes.includes(c)).map(c => (
                      <th key={c} style={{ color: CLASS_COLORS[c]?.hex }}>{c} AUC</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {models
                    .map(m => ({
                      model: m,
                      macroAUC: data[m]?.[selectedDataset]?.overall?.Macro_AUC,
                      collapsed: (data[m]?.[selectedDataset]?.overall?.Cohen_Kappa ?? 0) < 0.01,
                      perClass: CLASS_LIST.filter(c => classes.includes(c)).map(c =>
                        data[m]?.[selectedDataset]?.per_class?.[c]?.AUC
                      ),
                    }))
                    .sort((a, b) => (b.macroAUC ?? 0) - (a.macroAUC ?? 0))
                    .map((row, i) => (
                      <tr key={row.model} style={row.collapsed ? { opacity: 0.45 } : undefined}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: getModelColor(row.model), flexShrink: 0 }} />
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}>{row.model}</span>
                          </div>
                        </td>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: i === 0 && !row.collapsed ? 'var(--cyan)' : undefined, fontWeight: i === 0 ? 700 : undefined }}>
                          {row.macroAUC != null ? `${(row.macroAUC * 100).toFixed(2)}%` : '—'}
                        </td>
                        {row.perClass.map((v, ci) => (
                          <td key={ci} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}>
                            {v != null ? `${(v * 100).toFixed(2)}%` : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Visual AUC bars per class per model */}
          {CLASS_LIST.filter(c => classes.includes(c)).map(cls => {
            const clrHex = CLASS_COLORS[cls]?.hex ?? '#94a3b8';
            const clrRgb = CLASS_COLORS[cls]?.rgb ?? '148,163,184';
            const activeModels = models.filter(m => (data[m]?.[selectedDataset]?.overall?.Cohen_Kappa ?? 0) >= 0.01);
            const barD = {
              labels: activeModels,
              datasets: [{
                label: `${cls} AUC`,
                data: activeModels.map(m => {
                  const v = data[m]?.[selectedDataset]?.per_class?.[cls]?.AUC;
                  return v != null ? +(v * 100).toFixed(2) : null;
                }),
                backgroundColor: `rgba(${clrRgb},0.72)`,
                borderColor: clrHex,
                borderWidth: 1, borderRadius: 6,
              }],
            };
            return (
              <div key={cls} className="card card-pad fade-in-3" style={{ marginTop: '1rem' }}>
                <div className="section-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: clrHex }} />
                    <div className="section-title">{cls} — AUC-ROC Across Models</div>
                  </div>
                </div>
                <div className="chart-wrap" style={{ height: `${Math.max(180, activeModels.length * 44)}px` }}>
                  <Bar
                    data={barD}
                    options={{
                      ...barOptions({ indexAxis: 'y', maxY: 100 }),
                      plugins: { ...barOptions({ indexAxis: 'y', maxY: 100 }).plugins, legend: { display: false } },
                    }}
                  />
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
