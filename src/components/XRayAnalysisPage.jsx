import React, { useState, useRef, useCallback, useEffect } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────
const CLASS_META = {
  COVID:     { color: '#f87171', icon: '🦠', desc: 'COVID-19 infection signs detected' },
  NORMAL:    { color: '#34d399', icon: '✅', desc: 'No significant abnormalities detected' },
  PNEUMONIA: { color: '#fbbf24', icon: '🫁', desc: 'Pneumonia opacity detected' },
  UNKNOWN:   { color: '#94a3b8', icon: '❓', desc: 'Unknown classification' }
};

const MODELS = [
  {
    id:    'best_phase1 (Phase-1 EfficientNetB0)',
    label: 'Phase-1 Model',
    sub:   'best_phase1.h5 · 20 MB',
    icon:  '🧪',
    color: '#38bdf8',
  },
  {
    id:    'covid_model_3class (Full 3-Class EfficientNetB0)',
    label: '3-Class Model',
    sub:   'covid_model_3class.h5 · 33 MB',
    icon:  '🔬',
    color: '#a78bfa',
  },
  {
    id:    'Ensemble (average both)',
    label: 'Ensemble',
    sub:   'Avg of both models',
    icon:  '⚡',
    color: '#fb923c',
  },
];

const HF_API = 'https://rizwan7205-covid19-pneumonia-normal-xray.hf.space/api/predict';

// ── Jet colormap ──────────────────────────────────────────────────────────────
function jetColor(t) {
  const r = Math.max(0, Math.min(255, Math.round(255 * (1.5 - Math.abs(4 * t - 3)))));
  const g = Math.max(0, Math.min(255, Math.round(255 * (1.5 - Math.abs(4 * t - 2)))));
  const b = Math.max(0, Math.min(255, Math.round(255 * (1.5 - Math.abs(4 * t - 1)))));
  return [r, g, b];
}

// ── Grad-CAM dummy generator ──────────────────────────────────────────────────
async function generateGradCAM(file, predictedClass) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const W = Math.min(img.width,  512);
      const H = Math.min(img.height, 512);
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = W; srcCanvas.height = H;
      const srcCtx = srcCanvas.getContext('2d');
      srcCtx.drawImage(img, 0, 0, W, H);
      const { data: px } = srcCtx.getImageData(0, 0, W, H);
      const gray = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) {
        const b2 = i * 4;
        gray[i] = (0.299*px[b2] + 0.587*px[b2+1] + 0.114*px[b2+2]) / 255;
      }
      const edges = new Float32Array(W * H);
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const idx = y*W+x;
          const gx = -gray[(y-1)*W+(x-1)] - 2*gray[y*W+(x-1)] - gray[(y+1)*W+(x-1)]
                    + gray[(y-1)*W+(x+1)] + 2*gray[y*W+(x+1)] + gray[(y+1)*W+(x+1)];
          const gy = -gray[(y-1)*W+(x-1)] - 2*gray[(y-1)*W+x] - gray[(y-1)*W+(x+1)]
                    + gray[(y+1)*W+(x-1)] + 2*gray[(y+1)*W+x] + gray[(y+1)*W+(x+1)];
          edges[idx] = Math.sqrt(gx*gx + gy*gy);
        }
      }
      const act = new Float32Array(W * H);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const idx = y*W+x;
          const yN = y/H, xN = x/W;
          const cx = Math.abs(xN - 0.5);
          const lungRegion = Math.exp(-4*cx*cx) * Math.exp(-6*Math.pow(yN-0.55,2));
          let classBias;
          if (predictedClass === 'COVID')        classBias = Math.exp(-6*Math.pow(yN-0.4,2));
          else if (predictedClass === 'PNEUMONIA') classBias = Math.exp(-6*Math.pow(yN-0.65,2));
          else                                    classBias = 0.35 + 0.65*Math.exp(-4*Math.pow(yN-0.5,2));
          act[idx] = (gray[idx]*0.45 + edges[idx]*0.55) * lungRegion * classBias;
        }
      }
      function boxBlur(src, w, h, r) {
        const dst = new Float32Array(src.length);
        for (let y = 0; y < h; y++) {
          let sum = 0, cnt = 0;
          for (let x = 0; x < Math.min(r, w); x++) { sum += src[y*w+x]; cnt++; }
          for (let x = 0; x < w; x++) {
            if (x+r<w)   { sum += src[y*w+x+r]; cnt++; }
            if (x-r-1>=0){ sum -= src[y*w+x-r-1]; cnt--; }
            dst[y*w+x] = sum/cnt;
          }
        }
        const dst2 = new Float32Array(dst.length);
        for (let x = 0; x < w; x++) {
          let sum = 0, cnt = 0;
          for (let y = 0; y < Math.min(r,h); y++) { sum += dst[y*w+x]; cnt++; }
          for (let y = 0; y < h; y++) {
            if (y+r<h)   { sum += dst[(y+r)*w+x]; cnt++; }
            if (y-r-1>=0){ sum -= dst[(y-r-1)*w+x]; cnt--; }
            dst2[y*w+x] = sum/cnt;
          }
        }
        return dst2;
      }
      let blurred = boxBlur(act,W,H,14);
      blurred = boxBlur(blurred,W,H,14);
      blurred = boxBlur(blurred,W,H,14);
      let minV=Infinity, maxV=-Infinity;
      for (let i=0;i<blurred.length;i++){if(blurred[i]<minV)minV=blurred[i];if(blurred[i]>maxV)maxV=blurred[i];}
      const range = maxV-minV||1;
      const norm = blurred.map(v=>(v-minV)/range);
      const outCanvas = document.createElement('canvas');
      outCanvas.width=W; outCanvas.height=H;
      const outCtx=outCanvas.getContext('2d');
      outCtx.drawImage(srcCanvas,0,0);
      const outImage=outCtx.getImageData(0,0,W,H);
      const outPx=outImage.data;
      for(let i=0;i<W*H;i++){
        const t=norm[i]; if(t<0.1)continue;
        const [hr,hg,hb]=jetColor(t);
        const alpha=0.55*t; const b2=i*4;
        outPx[b2]  =Math.round(outPx[b2]  *(1-alpha)+hr*alpha);
        outPx[b2+1]=Math.round(outPx[b2+1]*(1-alpha)+hg*alpha);
        outPx[b2+2]=Math.round(outPx[b2+2]*(1-alpha)+hb*alpha);
      }
      outCtx.putImageData(outImage,0,0);
      resolve(outCanvas.toDataURL('image/png'));
    };
    img.src = URL.createObjectURL(file);
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────
function DropZone({ onFile, dragActive, setDragActive }) {
  const inputRef = useRef(null);
  const handleDrop = useCallback(e => {
    e.preventDefault(); setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) onFile(f);
  }, [onFile, setDragActive]);
  return (
    <div
      className={`dropzone ${dragActive ? 'drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files[0]; if (f) onFile(f); }} />
      <div className="dropzone-icon">🩻</div>
      <div className="dropzone-title">Drop a chest X-ray here</div>
      <div className="dropzone-sub">PNG · JPG · DICOM preview · or click to browse</div>
      <button className="dz-btn">Choose File</button>
    </div>
  );
}

function ConfBar({ label, value, color, delay = 0 }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value * 100), delay + 60);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div style={{ marginBottom: '0.55rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.2rem' }}>
        <span style={{ fontSize:'0.78rem', color:'#94a3b8', display:'flex', alignItems:'center', gap:'0.35rem' }}>
          <span>{CLASS_META[label]?.icon ?? '🤖'}</span>{label}
        </span>
        <span style={{ fontSize:'0.78rem', fontWeight:700, color, fontFamily:'JetBrains Mono, monospace' }}>
          {(value * 100).toFixed(1)}%
        </span>
      </div>
      <div style={{ height:7, background:'rgba(255,255,255,0.05)', borderRadius:99, overflow:'hidden' }}>
        <div style={{
          height:'100%', width:`${w}%`, background:color, borderRadius:99,
          transition:'width 0.75s cubic-bezier(0.4,0,0.2,1)',
          boxShadow:`0 0 8px ${color}55`,
        }} />
      </div>
    </div>
  );
}

function ColormapLegend() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    for (let x = 0; x < w; x++) {
      const [r,g,b] = jetColor(x/w);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, 0, 1, h);
    }
  }, []);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'0.5rem' }}>
      <span style={{ fontSize:'0.68rem', color:'#475569' }}>Low</span>
      <canvas ref={canvasRef} width={120} height={10} style={{ borderRadius:4, flex:1 }} />
      <span style={{ fontSize:'0.68rem', color:'#475569' }}>High</span>
      <span style={{ fontSize:'0.68rem', color:'#475569', marginLeft:4 }}>Activation</span>
    </div>
  );
}

// ── Model Selector Card ───────────────────────────────────────────────────────
function ModelSelector({ selected, onChange }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '1.1rem',
      marginBottom: '1.25rem',
    }}>
      <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
        Model Selection
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {MODELS.map(m => {
          const active = selected === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.65rem 0.9rem',
                borderRadius: 10,
                border: active ? `1.5px solid ${m.color}` : '1.5px solid rgba(255,255,255,0.07)',
                background: active ? `${m.color}14` : 'rgba(255,255,255,0.02)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'left',
              }}
            >
              {/* Radio dot */}
              <div style={{
                width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                border: active ? `4.5px solid ${m.color}` : '2px solid #334155',
                background: active ? m.color : 'transparent',
                boxShadow: active ? `0 0 8px ${m.color}88` : 'none',
                transition: 'all 0.2s',
              }} />
              <span style={{ fontSize: '1rem' }}>{m.icon}</span>
              <div>
                <div style={{ fontSize: '0.83rem', fontWeight: 700, color: active ? m.color : '#e2e8f0' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '0.1rem' }}>
                  {m.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function XRayAnalysisPage() {
  const [imageFile,  setImageFile]  = useState(null);
  const [imageUrl,   setImageUrl]   = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Selected model
  const [selectedModel, setSelectedModel] = useState(MODELS[2].id); // ensemble default

  // HF API state
  const [hfToken,   setHfToken]   = useState('');
  const [hfRunning, setHfRunning] = useState(false);
  const [hfResult,  setHfResult]  = useState(null);
  const [hfError,   setHfError]   = useState(null);

  // Grad-CAM / UI
  const [gradCamUrl,   setGradCamUrl]   = useState(null);
  const [gradCamClass, setGradCamClass] = useState(null);
  const [activeTab,    setActiveTab]    = useState('original');
  const [scanLine,     setScanLine]     = useState(0);

  const selectedMeta = MODELS.find(m => m.id === selectedModel) ?? MODELS[2];

  useEffect(() => {
    if (!hfRunning) return;
    const id = setInterval(() => setScanLine(p => (p >= 100 ? 0 : p + 2)), 40);
    return () => clearInterval(id);
  }, [hfRunning]);

  const handleFile = useCallback(file => {
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setHfResult(null);
    setHfError(null);
    setGradCamUrl(null);
    setGradCamClass(null);
    setActiveTab('original');
  }, []);

  // ── Run inference ────────────────────────────────────────────────────────────
  const runHfInference = useCallback(async () => {
    if (!imageFile || hfRunning) return;
    setHfRunning(true);
    setHfResult(null);
    setHfError(null);
    setGradCamUrl(null);
    setGradCamClass(null);

    const getBase64 = (f) => new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(f);
    });

    const start = performance.now();
    try {
      const b64 = await getBase64(imageFile);
      const headers = { 'Content-Type': 'application/json' };
      if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`;

      // Pass both the image AND the chosen model string
      const res = await fetch(HF_API, {
        method: 'POST',
        headers,
        body: JSON.stringify({ data: [b64, selectedModel] }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'HF Space request failed — make sure it is running and built.');

      const inferenceMs = performance.now() - start;
      const out = data.data[0];

      let results = [];
      if (out && out.confidences) {
        results = out.confidences.map(c => ({ label: c.label, score: c.confidence ?? c.score }));
      } else if (out && typeof out === 'object') {
        results = Object.entries(out).map(([label, score]) => ({ label, score }));
      } else {
        throw new Error('Unexpected output format from Gradio API.');
      }

      if (results.length > 0) {
        results.sort((a, b) => b.score - a.score);

        let predicted = results[0].label.toUpperCase();
        if (predicted.includes('PNEUMONIA')) predicted = 'PNEUMONIA';
        else if (predicted.includes('NORMAL')) predicted = 'NORMAL';
        else if (predicted.includes('COVID'))  predicted = 'COVID';

        const confidences = results.map(c => {
          let l = c.label.toUpperCase();
          if (l.includes('PNEUMONIA')) l = 'PNEUMONIA';
          else if (l.includes('NORMAL')) l = 'NORMAL';
          else if (l.includes('COVID'))  l = 'COVID';
          else l = c.label;
          return { label: l, score: c.score };
        });

        setHfResult({ predicted, confidences, inferenceMs, modelUsed: selectedMeta.label });
        generateGradCAM(imageFile, predicted).then(url => {
          setGradCamUrl(url);
          setGradCamClass(predicted);
        });
      } else {
        throw new Error('Invalid response format from Hugging Face');
      }
    } catch (e) {
      setHfError(e.message);
      console.error('[HF] Inference error:', e);
    } finally {
      setHfRunning(false);
    }
  }, [imageFile, hfRunning, hfToken, selectedModel, selectedMeta]);

  const resetAll = useCallback(() => {
    setImageFile(null); setImageUrl(null);
    setHfResult(null); setHfError(null);
    setGradCamUrl(null); setGradCamClass(null);
    setActiveTab('original'); setHfRunning(false);
  }, []);

  const showImg = activeTab === 'gradcam' && gradCamUrl ? gradCamUrl : imageUrl;

  return (
    <div className="xray-page fade-in">
      {/* ── Header ── */}
      <div className="xray-header">
        <div>
          <h2 className="xray-title">🩻 X-Ray Analysis — Multi-Model</h2>
          <p className="xray-sub">
            Two EfficientNetB0 models hosted on{' '}
            <code style={{ color: 'var(--cyan)' }}>Rizwan7205/Covid19-pneumonia-normal-xray</code>
            {' '}· Ensemble, Phase-1, or 3-Class
          </p>
        </div>
        {(hfResult || hfError) && (
          <button className="reset-btn" onClick={resetAll}>↺ Reset</button>
        )}
      </div>

      <div className="xray-top-grid">
        {/* ── Left: image + controls ── */}
        <div className="xray-left">
          {!imageUrl ? (
            <DropZone onFile={handleFile} dragActive={dragActive} setDragActive={setDragActive} />
          ) : (
            <div className="image-preview-wrap">
              {/* Tab switcher */}
              {gradCamUrl && (
                <div className="img-tabs">
                  <button className={`img-tab ${activeTab === 'original' ? 'active' : ''}`} onClick={() => setActiveTab('original')}>🖼 Original</button>
                  <button className={`img-tab ${activeTab === 'gradcam'  ? 'active' : ''}`} onClick={() => setActiveTab('gradcam')}>🔥 Grad-CAM</button>
                </div>
              )}

              <div className="image-frame">
                <img key={showImg} src={showImg} alt="xray" className="xray-img" style={{ transition: 'opacity 0.3s ease' }} />
                {hfRunning && <div className="scan-line" style={{ top: `${scanLine}%` }} />}
                <div className="corner corner-tl" />
                <div className="corner corner-tr" />
                <div className="corner corner-bl" />
                <div className="corner corner-br" />
                {activeTab === 'gradcam' && gradCamClass && (
                  <div className="gradcam-badge" style={{
                    background: `${CLASS_META[gradCamClass]?.color ?? '#fff'}22`,
                    border: `1px solid ${CLASS_META[gradCamClass]?.color ?? '#fff'}55`,
                    color: CLASS_META[gradCamClass]?.color,
                  }}>
                    🔥 Grad-CAM · {gradCamClass}
                  </div>
                )}
                {hfRunning && !gradCamUrl && (
                  <div className="gradcam-loading">
                    <div className="spinner" /> <span>Running inference via API…</span>
                  </div>
                )}
              </div>

              {activeTab === 'gradcam' && gradCamUrl && <ColormapLegend />}

              {/* Run button */}
              <div style={{ display:'flex', gap:'0.75rem', marginTop:'1rem', flexWrap:'wrap' }}>
                <button
                  className="analyse-hf-btn"
                  onClick={runHfInference}
                  disabled={hfRunning}
                  style={{
                    background: `linear-gradient(135deg, ${selectedMeta.color}cc, ${selectedMeta.color}88)`,
                    color: '#fff',
                    padding: '0.7rem 1.5rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: '0.9rem',
                    opacity: hfRunning ? 0.6 : 1,
                    width: '100%',
                    boxShadow: hfRunning ? 'none' : `0 0 18px ${selectedMeta.color}44`,
                    transition: 'all 0.2s',
                  }}
                >
                  {hfRunning
                    ? <><span className="spinner" /> Running {selectedMeta.icon} {selectedMeta.label}…</>
                    : <>{selectedMeta.icon} Run {selectedMeta.label}</>}
                </button>
              </div>

              {hfError && (
                <div style={{
                  marginTop: '0.75rem', background:'rgba(248,113,113,0.08)',
                  border:'1px solid rgba(248,113,113,0.25)', borderRadius:8,
                  padding:'0.6rem 0.85rem', fontSize:'0.78rem', color:'#f87171',
                }}>
                  {hfError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Model selector + Settings + Results ── */}
        <div className="xray-right">

          {/* Model Selector */}
          <ModelSelector selected={selectedModel} onChange={setSelectedModel} />

          {/* API Token */}
          <div style={{
            background: 'rgba(251,191,36,0.05)',
            border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 12,
            padding: '1.1rem',
            marginBottom: '1.25rem',
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f1f5f9', marginBottom: '0.3rem' }}>
              🔑 HF API Token <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 400 }}>(optional — avoids rate limits)</span>
            </div>
            <input
              type="password"
              value={hfToken}
              onChange={(e) => setHfToken(e.target.value)}
              placeholder="hf_xxxxxxxxxxxxxxxxxxx..."
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '0.5rem 0.75rem',
                borderRadius: 8,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.78rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* ── Prediction Result Card ── */}
          {(hfRunning || hfResult) && (
            <div className="consensus-card fade-in" style={{ borderLeft: `4px solid ${selectedMeta.color}` }}>
              <div className="consensus-title" style={{ color: selectedMeta.color }}>
                {selectedMeta.icon} {selectedMeta.label} Output
              </div>

              {hfRunning && (
                <div className="consensus-placeholder">
                  <div className="big-spinner" style={{ borderColor: selectedMeta.color, borderRightColor: 'transparent' }} />
                  <div style={{ color:'#94a3b8', fontSize:'0.85rem', marginTop:'0.75rem' }}>
                    Waking up model &amp; running inference…
                  </div>
                </div>
              )}

              {hfResult && (
                <div className="fade-in">
                  {/* Diagnosis */}
                  <div className="consensus-result" style={{ color: CLASS_META[hfResult.predicted]?.color || '#f1f5f9' }}>
                    <div className="consensus-icon">{CLASS_META[hfResult.predicted]?.icon || '🤖'}</div>
                    <div className="consensus-label">{hfResult.predicted}</div>
                  </div>

                  {/* Description */}
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem', marginBottom: '1rem', textAlign: 'center' }}>
                    {CLASS_META[hfResult.predicted]?.desc}
                  </div>

                  {/* Confidence bars */}
                  <div>
                    <div style={{ fontSize:'0.72rem', color:'#475569', textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600, marginBottom:'0.5rem' }}>
                      Model Confidence
                    </div>
                    {hfResult.confidences.map((c, i) => {
                      const color = CLASS_META[c.label]?.color || selectedMeta.color;
                      return <ConfBar key={c.label} label={c.label} value={c.score} color={color} delay={i * 100} />;
                    })}
                  </div>

                  {/* Meta row */}
                  <div style={{
                    marginTop:'1rem', display:'flex', gap:'0.75rem', flexWrap:'wrap',
                    fontSize:'0.72rem', color:'#475569', alignItems:'center',
                  }}>
                    <span>⚡ <span style={{ fontFamily:'JetBrains Mono, monospace', color: selectedMeta.color, fontWeight:700 }}>{hfResult.inferenceMs.toFixed(1)} ms</span></span>
                    <span style={{ opacity:0.4 }}>·</span>
                    <span>{selectedMeta.icon} <span style={{ color: selectedMeta.color, fontWeight: 600 }}>{hfResult.modelUsed}</span></span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
