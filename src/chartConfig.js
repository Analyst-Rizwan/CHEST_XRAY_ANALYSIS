// Shared Chart.js default options and colour palette

export const MODEL_COLORS = {
  resnet50:        { hex: '#38bdf8', rgb: '56,189,248'  },
  resnet18:        { hex: '#34d399', rgb: '52,211,153'  },
  densenet121:     { hex: '#818cf8', rgb: '129,140,248' },
  vgg16:           { hex: '#f87171', rgb: '248,113,113' },
  efficientnet_b0: { hex: '#fbbf24', rgb: '251,191,36'  },
  mobilenet_v2:    { hex: '#a78bfa', rgb: '167,139,250' },
  inception_v3:    { hex: '#fb923c', rgb: '251,146,60'  },
};

export const CLASS_COLORS = {
  COVID:     { hex: '#f87171', rgb: '248,113,113' },
  NORMAL:    { hex: '#34d399', rgb: '52,211,153'  },
  PNEUMONIA: { hex: '#fbbf24', rgb: '251,191,36'  },
};

// Real datasets from Colab evaluation run (DS3 skipped — only a .zip, not extracted)
export const DS_LABELS = {
  DS1_Standard:     'DS1 – Standard',
  DS2_PA_View:      'DS2 – PA View',
  DS4a_QU_Lung:     'DS4a – QU Lung',
  DS4b_QU_Infection:'DS4b – QU Infect.',
};

export const DS_META = {
  DS1_Standard:     { samples: 341,   note: 'COVID·Normal·Pneumonia (test split)' },
  DS2_PA_View:      { samples: 4575,  note: 'PA-projection, 3-class, large' },
  DS4a_QU_Lung:     { samples: 6788,  note: 'QU-Ex lung-seg masks, 3-class' },
  DS4b_QU_Infection:{ samples: 1166,  note: 'QU-Ex infection-seg masks, 3-class' },
};

export function getModelColor(name) {
  return MODEL_COLORS[name]?.hex ?? '#94a3b8';
}
export function getModelColorRgb(name) {
  return MODEL_COLORS[name]?.rgb ?? '148,163,184';
}

export const BASE_FONT = { family: 'Inter, sans-serif', size: 12 };

export const BASE_TOOLTIP = {
  backgroundColor: '#0d1525',
  titleColor:      '#f1f5f9',
  bodyColor:       '#94a3b8',
  borderColor:     'rgba(255,255,255,0.08)',
  borderWidth:     1,
  padding:         10,
  cornerRadius:    8,
  titleFont:       { ...BASE_FONT, weight: '600' },
  bodyFont:        BASE_FONT,
};

export const BASE_GRID = {
  color: 'rgba(255,255,255,0.05)',
  drawBorder: false,
};

export const BASE_TICK = {
  color: '#475569',
  font: BASE_FONT,
};

export function barOptions({ xLabel = '', yLabel = '%', maxY = 100, indexAxis = 'x' } = {}) {
  return {
    indexAxis,
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    plugins: {
      legend: { labels: { color: '#94a3b8', font: BASE_FONT, boxWidth: 12, padding: 16 } },
      tooltip: BASE_TOOLTIP,
    },
    scales: {
      x: {
        ticks: { ...BASE_TICK, maxRotation: 30 },
        grid:  { ...BASE_GRID, display: indexAxis !== 'y' },
        title: { display: !!xLabel, text: xLabel, color: '#475569', font: BASE_FONT },
      },
      y: {
        beginAtZero: true,
        max:  maxY,
        ticks: { ...BASE_TICK, callback: v => `${v}${yLabel === '%' ? '%' : ''}` },
        grid:  BASE_GRID,
        title: { display: !!yLabel && yLabel !== '%', text: yLabel, color: '#475569', font: BASE_FONT },
      },
    },
  };
}

export function radarOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    plugins: {
      legend: { labels: { color: '#94a3b8', font: BASE_FONT, boxWidth: 12 } },
      tooltip: BASE_TOOLTIP,
    },
    scales: {
      r: {
        min: 0, max: 100,
        ticks: {
          stepSize: 25,
          color:       '#475569',
          font:        { size: 10 },
          backdropColor: 'transparent',
          callback:    v => `${v}%`,
        },
        grid:        { color: 'rgba(255,255,255,0.05)' },
        pointLabels: { color: '#94a3b8', font: { size: 11, family: 'Inter' } },
        angleLines:  { color: 'rgba(255,255,255,0.05)' },
      },
    },
  };
}

export function lineOptions({ yLabel = '%', maxY = 100 } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutQuart' },
    plugins: {
      legend: { labels: { color: '#94a3b8', font: BASE_FONT, boxWidth: 12, padding: 16 } },
      tooltip: { ...BASE_TOOLTIP, mode: 'index', intersect: false },
    },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        ticks: { ...BASE_TICK, maxRotation: 20 },
        grid:  { ...BASE_GRID, display: false },
      },
      y: {
        beginAtZero: false,
        max:  maxY,
        ticks: { ...BASE_TICK, callback: v => `${v}%` },
        grid:  BASE_GRID,
      },
    },
  };
}
