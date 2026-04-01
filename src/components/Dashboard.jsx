// Dashboard.jsx — main shell: sidebar + topbar + routed pages
import React, { useState } from 'react';
import metricsData from '../data/metrics.json';
import { getModelColor, DS_LABELS } from '../chartConfig';
import OverviewPage       from './OverviewPage';
import LeaderboardPage    from './LeaderboardPage';
import PerClassPage       from './PerClassPage';
import HeatmapPage        from './HeatmapPage';
import ComparePage        from './ComparePage';
import XRayAnalysisPage   from './XRayAnalysisPage';

const PAGES = [
  { id: 'overview',    label: 'Overview',     icon: '◈' },
  { id: 'heatmap',     label: 'Heatmap',      icon: '⊞' },
  { id: 'compare',     label: 'Compare All',  icon: '⧉' },
  { id: 'leaderboard', label: 'Leaderboard',  icon: '⊞' },
  { id: 'perclass',    label: 'Per-Class',    icon: '◉' },
  { id: 'xray',        label: 'X-Ray Analyse',icon: '🩻' },
];

export default function Dashboard() {
  const models   = Object.keys(metricsData);
  const datasets = Object.keys(metricsData[models[0]]);

  const [page,            setPage]            = useState('overview');
  const [selectedModel,   setSelectedModel]   = useState(models[0]);
  const [selectedDataset, setSelectedDataset] = useState(datasets[0]);

  const pageLabels = {
    overview:    'Overview',
    heatmap:     'Performance Heatmap',
    compare:     'Macro Comparison',
    leaderboard: 'Leaderboard',
    perclass:    'Per-Class Analysis',
    xray:        'X-Ray Analysis',
  };

  const dsCount = datasets.length;
  const modCount = models.length;

  return (
    <div className="app">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <div className="logo-icon">🫁</div>
            <span className="logo-title">XRay Eval</span>
          </div>
          <div className="logo-sub">Multi-Dataset Dashboard</div>
        </div>

        {/* Model Selector */}
        <div className="model-selector-wrap">
          <div className="model-selector-label">Active Model</div>
          <select
            className="model-select"
            value={selectedModel}
            onChange={e => setSelectedModel(e.target.value)}
          >
            {models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: getModelColor(selectedModel), flexShrink: 0 }} />
            <span style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>
              {modCount} models · {dsCount} datasets
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-label">Navigation</div>
          {PAGES.map(p => (
            <button
              key={p.id}
              className={`nav-btn ${page === p.id ? 'active' : ''}`}
              onClick={() => setPage(p.id)}
            >
              <span style={{ fontSize: '0.9rem', width: 16, textAlign: 'center' }}>{p.icon}</span>
              {p.label}
            </button>
          ))}
        </nav>

        {/* Sidebar footer: dataset quick info */}
        <div className="sidebar-footer">
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Datasets
          </div>
          {datasets.map(d => (
            <div key={d}
              onClick={() => setSelectedDataset(d)}
              style={{
                padding: '0.3rem 0.5rem',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: selectedDataset === d ? 'rgba(56,189,248,0.08)' : 'transparent',
                transition: 'background 0.2s',
                marginBottom: '0.15rem',
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: selectedDataset === d ? 'var(--cyan)' : 'var(--text-3)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.72rem', color: selectedDataset === d ? 'var(--cyan)' : 'var(--text-2)', fontWeight: selectedDataset === d ? 600 : 400 }}>
                {DS_LABELS[d] ?? d}
              </span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main">
        {/* Topbar */}
        <header className="topbar">
          <div>
            <div className="topbar-title">{pageLabels[page]}</div>
            <div className="topbar-sub">
              {selectedModel} · {DS_LABELS[selectedDataset] ?? selectedDataset}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="status-badge">
              <div className="status-dot" />
              {modCount} Models · {dsCount} Datasets
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="page">
          {page === 'overview' && (
            <OverviewPage
              data={metricsData}
              selectedModel={selectedModel}
              selectedDataset={selectedDataset}
              setSelectedDataset={setSelectedDataset}
            />
          )}
          {page === 'heatmap' && (
            <HeatmapPage
              data={metricsData}
              selectedModel={selectedModel}
              selectedDataset={selectedDataset}
              setSelectedDataset={setSelectedDataset}
            />
          )}
          {page === 'compare' && (
            <ComparePage
              data={metricsData}
            />
          )}
          {page === 'leaderboard' && (
            <LeaderboardPage
              data={metricsData}
              selectedDataset={selectedDataset}
              setSelectedDataset={setSelectedDataset}
            />
          )}
          {page === 'perclass' && (
            <PerClassPage
              data={metricsData}
              selectedModel={selectedModel}
              selectedDataset={selectedDataset}
              setSelectedDataset={setSelectedDataset}
            />
          )}
          {page === 'xray' && (
            <XRayAnalysisPage
              data={metricsData}
            />
          )}
        </main>
      </div>
    </div>
  );
}
