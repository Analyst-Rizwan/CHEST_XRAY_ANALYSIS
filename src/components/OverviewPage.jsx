// OverviewPage.jsx
import React, { useMemo } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, PointElement, LineElement, RadialLinearScale,
  Filler,
} from 'chart.js';
import { Bar, Radar, Line } from 'react-chartjs-2';
import {
  getModelColor, getModelColorRgb, DS_LABELS, DS_META,
  barOptions, radarOptions, lineOptions,
} from '../chartConfig';
import ConfusionMatrix from './ConfusionMatrix';
import MetricBar from './MetricBar';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
  PointElement, LineElement, RadialLinearScale, Filler,
);

const OVERALL_METRICS = [
  { key: 'Accuracy',          label: 'Accuracy'          },
  { key: 'Balanced_Accuracy', label: 'Balanced Acc.'     },
  { key: 'Macro_F1',          label: 'Macro F1'          },
  { key: 'Weighted_F1',       label: 'Weighted F1'       },
  { key: 'Cohen_Kappa',       label: "Cohen's κ"         },
  { key: 'MCC',               label: 'MCC'               },
  { key: 'Macro_AUC',         label: 'Macro AUC'         },
  { key: 'Top2_Accuracy',     label: 'Top-2 Acc.'        },
];

/* ── small helpers ── */
const fmt = v => (typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : 'N/A');
const fmtRaw = v => (typeof v === 'number' ? v.toFixed(3) : 'N/A');

export default function OverviewPage({ data, selectedModel, selectedDataset, setSelectedDataset }) {
  const models   = Object.keys(data);
  const datasets = Object.keys(data[selectedModel]);
  const dsData   = data[selectedModel][selectedDataset];

  /* ── 1. Grouped bar: Accuracy + F1 per dataset ── */
  const groupedBar = useMemo(() => ({
    labels: datasets.map(d => DS_LABELS[d] ?? d),
    datasets: [
      {
        label: 'Accuracy',
        data: datasets.map(d => +(data[selectedModel][d].overall.Accuracy * 100).toFixed(2)),
        backgroundColor: 'rgba(56,189,248,0.75)',
        borderColor: '#38bdf8', borderWidth: 1, borderRadius: 6,
      },
      {
        label: 'Macro F1',
        data: datasets.map(d => +(data[selectedModel][d].overall.Macro_F1 * 100).toFixed(2)),
        backgroundColor: 'rgba(129,140,248,0.75)',
        borderColor: '#818cf8', borderWidth: 1, borderRadius: 6,
      },
      {
        label: 'Weighted F1',
        data: datasets.map(d => +(data[selectedModel][d].overall.Weighted_F1 * 100).toFixed(2)),
        backgroundColor: 'rgba(52,211,153,0.75)',
        borderColor: '#34d399', borderWidth: 1, borderRadius: 6,
      },
    ],
  }), [data, selectedModel, datasets]);

  /* ── 2. Radar: all 8 metrics for selected dataset ── */
  const radarData = useMemo(() => {
    const ov = dsData.overall;
    const vals = [
      ov.Accuracy, ov.Balanced_Accuracy, ov.Macro_F1,
      ov.Weighted_F1, ov.Cohen_Kappa, ov.MCC, ov.Macro_AUC ?? 0, ov.Top2_Accuracy,
    ].map(v => +(v * 100).toFixed(2));
    return {
      labels: ['Accuracy','Bal. Acc.','Macro F1','Wt. F1','Kappa','MCC','Macro AUC','Top-2'],
      datasets: [{
        label: selectedModel,
        data: vals,
        backgroundColor: `rgba(${getModelColorRgb(selectedModel)},0.1)`,
        borderColor: getModelColor(selectedModel),
        borderWidth: 2,
        pointBackgroundColor: getModelColor(selectedModel),
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
      }],
    };
  }, [dsData, selectedModel]);

  /* ── 3. Multi-model line: Accuracy across datasets ── */
  const lineData = useMemo(() => ({
    labels: datasets.map(d => DS_LABELS[d] ?? d),
    datasets: models.map(name => ({
      label: name,
      data: datasets.map(d => {
        const v = data[name]?.[d]?.overall?.Accuracy;
        return v != null ? +(v * 100).toFixed(2) : null;
      }),
      borderColor: getModelColor(name),
      backgroundColor: `rgba(${getModelColorRgb(name)},0.06)`,
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 7,
      tension: 0.3,
      fill: false,
      spanGaps: true,
    })),
  }), [data, models, datasets]);

  /* ── 4. Multi-model radar overlay: all models on same radar ── */
  const multiRadarData = useMemo(() => ({
    labels: ['Accuracy','Bal. Acc.','Macro F1','Wt. F1','Kappa','MCC','AUC','Top-2'],
    datasets: models.map(name => {
      const ov = data[name]?.[selectedDataset]?.overall;
      if (!ov) return null;
      const vals = [
        ov.Accuracy, ov.Balanced_Accuracy, ov.Macro_F1,
        ov.Weighted_F1, ov.Cohen_Kappa, ov.MCC, ov.Macro_AUC ?? 0, ov.Top2_Accuracy,
      ].map(v => +(v * 100).toFixed(2));
      return {
        label: name,
        data: vals,
        backgroundColor: `rgba(${getModelColorRgb(name)},0.04)`,
        borderColor:     getModelColor(name),
        borderWidth: 1.5,
        pointBackgroundColor: getModelColor(name),
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: true,
      };
    }).filter(Boolean),
  }), [data, models, selectedDataset]);

  /* ── 5. KPI numbers ── */
  const avgAcc = (datasets.reduce((s, d) => s + data[selectedModel][d].overall.Accuracy, 0) / datasets.length);
  const avgF1  = (datasets.reduce((s, d) => s + data[selectedModel][d].overall.Macro_F1,  0) / datasets.length);
  const avgMCC = (datasets.reduce((s, d) => {
    const v = data[selectedModel][d].overall.MCC;
    return s + (v ?? 0);
  }, 0) / datasets.length);
  const avgKappa = (datasets.reduce((s, d) => {
    const v = data[selectedModel][d].overall.Cohen_Kappa;
    return s + (v ?? 0);
  }, 0) / datasets.length);

  return (
    <div>
      {/* KPI row */}
      <div className="kpi-grid fade-in">
        <div className="kpi-card cyan">
          <div className="kpi-label">Avg Accuracy</div>
          <div className="kpi-value">{(avgAcc * 100).toFixed(1)}%</div>
          <div className="kpi-sub">Across {datasets.length} datasets</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-label">Avg Macro F1</div>
          <div className="kpi-value">{(avgF1 * 100).toFixed(1)}%</div>
          <div className="kpi-sub">Macro-averaged</div>
        </div>
        <div className="kpi-card violet">
          <div className="kpi-label">Avg Kappa</div>
          <div className="kpi-value">{avgKappa.toFixed(3)}</div>
          <div className="kpi-sub">Cohen's κ agreement</div>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-label">Avg MCC</div>
          <div className="kpi-value">{avgMCC.toFixed(3)}</div>
          <div className="kpi-sub">Matthews Corr. Coeff.</div>
        </div>
      </div>

      {/* Dataset selector pills */}
      <div style={{ marginBottom: '1.25rem' }} className="fade-in-2">
        <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          Active Dataset
        </div>
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
        {DS_META?.[selectedDataset] && (
          <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: '0.4rem' }}>
            {DS_META[selectedDataset].samples.toLocaleString()} test images · {DS_META[selectedDataset].note}
          </div>
        )}
      </div>

      {/* Row 1: Grouped Bar + Radar */}
      <div className="grid-2 fade-in-2">
        <div className="card card-pad">
          <div className="section-head">
            <div>
              <div className="section-title">Performance by Dataset</div>
              <div className="section-sub">Accuracy · Macro F1 · Weighted F1</div>
            </div>
          </div>
          <div className="chart-wrap">
            <Bar data={groupedBar} options={barOptions({ maxY: 100 })} />
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-head">
            <div>
              <div className="section-title">Metric Radar — {DS_LABELS[selectedDataset] ?? selectedDataset}</div>
              <div className="section-sub">8 metrics at a glance</div>
            </div>
          </div>
          <div className="chart-wrap-radar" style={{ height: 280 }}>
            <Radar data={radarData} options={radarOptions()} />
          </div>
        </div>
      </div>

      {/* Row 2: Multi-model line + Metric breakdown bars */}
      <div className="grid-2 fade-in-3">
        <div className="card card-pad">
          <div className="section-head">
            <div>
              <div className="section-title">All Models — Accuracy Across Datasets</div>
              <div className="section-sub">Hover for exact values · ⚠ inception_v3 collapsed to baseline</div>
            </div>
          </div>
          <div className="chart-wrap">
            <Line data={lineData} options={lineOptions({ maxY: 100 })} />
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-head">
            <div>
              <div className="section-title">All Metrics — {DS_LABELS[selectedDataset] ?? selectedDataset}</div>
              <div className="section-sub">Overall metrics for {selectedModel}</div>
            </div>
          </div>
          <div style={{ paddingTop: '0.5rem' }}>
            {OVERALL_METRICS.map(({ key, label }) => {
              const v = dsData.overall[key];
              if (v == null) return null;
              return (
                <MetricBar
                  key={key}
                  label={label}
                  value={v}
                  max={1}
                  color={key === 'MCC' || key === 'Cohen_Kappa' ? 'var(--grad-c)' : 'var(--grad-a)'}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Confusion Matrix */}
      <div className="card card-pad fade-in-4">
        <div className="section-head">
          <div>
            <div className="section-title">Confusion Matrix — {DS_LABELS[selectedDataset] ?? selectedDataset}</div>
            <div className="section-sub">Hover cells for row-recall detail</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>Model: <strong style={{ color: 'var(--cyan)' }}>{selectedModel}</strong></div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>Total: {dsData.confusion_matrix.flat().reduce((a,b) => a+b, 0).toLocaleString()} samples</div>
          </div>
        </div>
        <div style={{ maxWidth: '520px', margin: '0 auto' }}>
          <ConfusionMatrix cm={dsData.confusion_matrix} />
        </div>
      </div>

      {/* Row 4: Multi-model radar overlay */}
      <div className="card card-pad fade-in-4" style={{ marginTop: '1.25rem' }}>
        <div className="section-head">
          <div>
            <div className="section-title">All Models — Radar Overlay</div>
            <div className="section-sub">{DS_LABELS[selectedDataset] ?? selectedDataset} · 8 metrics · ⚠ inception_v3 at baseline</div>
          </div>
        </div>
        <div className="chart-wrap-radar" style={{ height: 340 }}>
          <Radar data={multiRadarData} options={radarOptions()} />
        </div>
      </div>
    </div>
  );
}
