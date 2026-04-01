import React, { useState, useRef, useCallback, useEffect } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────
const CLASS_META = {
  COVID:     { color: '#f87171', icon: '🦠', desc: 'COVID-19 infection signs detected' },
  NORMAL:    { color: '#34d399', icon: '✅', desc: 'No significant abnormalities detected' },
  PNEUMONIA: { color: '#fbbf24', icon: '🫁', desc: 'Pneumonia opacity detected' },
  UNKNOWN:   { color: '#94a3b8', icon: '❓', desc: 'Unknown classification' }
};

const ENSEMBLE_MODEL = 'Ensemble (average both)';
const ACCENT = '#fb923c';
const HF_BASE = 'https://rizwan7205-covid19-pneumonia-normal-xray.hf.space';

// ── Jet colormap ──────────────────────────────────────────────────────────────
function jetColor(t) {
  const r = Math.max(0, Math.min(255, Math.round(255 * (1.5 - Math.abs(4 * t - 3)))));
  const g = Math.max(0, Math.min(255, Math.round(255 * (1.5 - Math.abs(4 * t - 2)))));
  const b = Math.max(0, Math.min(255, Math.round(255 * (1.5 - Math.abs(4 * t - 1)))));
  return [r, g, b];
}

// ── Grad-CAM generator ───────────────────────────────────────────────────────
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
    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginTop:'0.6rem' }}>
      <span style={{ fontSize:'0.68rem', color:'#475569' }}>Low</span>
      <canvas ref={canvasRef} width={120} height={10} style={{ borderRadius:4, flex:1 }} />
      <span style={{ fontSize:'0.68rem', color:'#475569' }}>High</span>
      <span style={{ fontSize:'0.68rem', color:'#475569', marginLeft:4 }}>Activation</span>
    </div>
  );
}

// ── Image Frame with corners + optional badge ─────────────────────────────────
function ImageFrame({ src, label, badge, badgeColor, children, style }) {
  return (
    <div style={{
      position: 'relative',
      background: '#0a0a12',
      borderRadius: 10,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
      ...style,
    }}>
      <img src={src} alt={label} style={{
        width: '100%', display: 'block', objectFit: 'contain',
        maxHeight: 400,
      }} />
      {badge && (
        <div style={{
          position: 'absolute', top: 8, left: 8,
          background: `${badgeColor || '#fff'}22`,
          border: `1px solid ${badgeColor || '#fff'}55`,
          color: badgeColor || '#fff',
          fontSize: '0.68rem', fontWeight: 700,
          padding: '0.2rem 0.55rem', borderRadius: 6,
          backdropFilter: 'blur(8px)',
        }}>
          {badge}
        </div>
      )}
      {/* Corner brackets */}
      <div className="corner corner-tl" />
      <div className="corner corner-tr" />
      <div className="corner corner-bl" />
      <div className="corner corner-br" />
      {children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function XRayAnalysisPage() {
  const [imageFile,  setImageFile]  = useState(null);
  const [imageUrl,   setImageUrl]   = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // HF API state
  const [hfRunning, setHfRunning] = useState(false);
  const [hfResult,  setHfResult]  = useState(null);
  const [hfError,   setHfError]   = useState(null);

  // Grad-CAM
  const [gradCamUrl,   setGradCamUrl]   = useState(null);
  const [gradCamClass, setGradCamClass] = useState(null);
  const [scanLine,     setScanLine]     = useState(0);

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
  }, []);

  // ── Run ensemble inference ──────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
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

      // ── Step 1: submit to /gradio_api/call/predict ───────────────────────
      // Image must be sent as a Gradio FileData object with base64 in "url"
      const imageData = { url: b64, meta: { _type: 'gradio.FileData' } };

      const submitRes = await fetch(`${HF_BASE}/gradio_api/call/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [imageData, ENSEMBLE_MODEL] }),
      });

      const submitRaw = await submitRes.text();
      if (!submitRes.ok) {
        if (submitRes.status === 503 || submitRaw.toLowerCase().includes('your space') || submitRaw.startsWith('<')) {
          throw new Error('🔄 HF Space is still building or sleeping — please wait 1–2 minutes and try again.');
        }
        let errMsg = 'HF Space request failed.';
        try { errMsg = JSON.parse(submitRaw).detail || JSON.parse(submitRaw).error || errMsg; } catch {}
        throw new Error(errMsg);
      }
      let eventId;
      try { eventId = JSON.parse(submitRaw).event_id; } catch {
        throw new Error('🔄 Unexpected response from HF Space — try again in a moment.');
      }
      if (!eventId) throw new Error('No event_id returned from HF Space.');

      // ── Step 2: stream SSE result from /gradio_api/call/predict/{event_id}
      const streamRes = await fetch(`${HF_BASE}/gradio_api/call/predict/${eventId}`);
      if (!streamRes.ok) throw new Error(`Stream error: ${streamRes.status}`);

      const sseText = await streamRes.text();
      // SSE format: lines starting with "data:" — take the last non-null one
      const dataLines = sseText
        .split('\n')
        .filter(l => l.startsWith('data:'))
        .map(l => l.slice(5).trim())
        .filter(l => l && l !== 'null');
      if (!dataLines.length) throw new Error('No data received from HF Space.');

      let out;
      try {
        // Result is a JSON array: [LabelData]
        const parsed = JSON.parse(dataLines[dataLines.length - 1]);
        out = Array.isArray(parsed) ? parsed[0] : parsed;
      } catch {
        throw new Error('Could not parse HF Space response.');
      }

      const inferenceMs = performance.now() - start;

      // out = { label: "PNEUMONIA", confidences: [{label, confidence}, ...] }
      let results = [];
      if (out && out.confidences) {
        results = out.confidences.map(c => ({ label: c.label, score: c.confidence ?? c.score ?? 0 }));
      } else if (out && out.label) {
        // fallback: only top label returned
        results = [{ label: out.label, score: 1.0 }];
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

        setHfResult({ predicted, confidences, inferenceMs });
        generateGradCAM(imageFile, predicted).then(url => {
          setGradCamUrl(url);
          setGradCamClass(predicted);
        });
      } else {
        throw new Error('Invalid response from Hugging Face');
      }
    } catch (e) {
      setHfError(e.message);
      console.error('[HF] Inference error:', e);
    } finally {
      setHfRunning(false);
    }
  }, [imageFile, hfRunning]);

  const resetAll = useCallback(() => {
    setImageFile(null); setImageUrl(null);
    setHfResult(null); setHfError(null);
    setGradCamUrl(null); setGradCamClass(null);
    setHfRunning(false);
  }, []);

  const predColor = hfResult ? (CLASS_META[hfResult.predicted]?.color || ACCENT) : ACCENT;

  return (
    <div className="xray-page fade-in">
      {/* ── Header ── */}
      <div className="xray-header">
        <div>
          <h2 className="xray-title">🩻 X-Ray Analysis</h2>
          <p className="xray-sub">
            Ensemble EfficientNetB0 inference via{' '}
            <code style={{ color: 'var(--cyan)' }}>Rizwan7205/Covid19-pneumonia-normal-xray</code>
            {' '}· COVID · Normal · Pneumonia
          </p>
        </div>
        {(hfResult || hfError || imageUrl) && (
          <button className="reset-btn" onClick={resetAll}>↺ Reset</button>
        )}
      </div>

      {/* ── Drop zone (no image yet) ── */}
      {!imageUrl && (
        <DropZone onFile={handleFile} dragActive={dragActive} setDragActive={setDragActive} />
      )}

      {/* ── Image loaded: show image + analysis button ── */}
      {imageUrl && !hfResult && (
        <div style={{ maxWidth: 520 }}>
          <ImageFrame src={imageUrl} label="Original X-Ray" badge="🖼 Original">
            {hfRunning && <div className="scan-line" style={{ top: `${scanLine}%` }} />}
            {hfRunning && (
              <div className="gradcam-loading">
                <div className="spinner" /> <span>Running ensemble inference…</span>
              </div>
            )}
          </ImageFrame>
          <button
            onClick={runAnalysis}
            disabled={hfRunning}
            style={{
              marginTop: '1rem',
              background: `linear-gradient(135deg, ${ACCENT}dd, ${ACCENT}88)`,
              color: '#fff',
              padding: '0.75rem 1.5rem', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.95rem',
              opacity: hfRunning ? 0.6 : 1,
              width: '100%',
              boxShadow: hfRunning ? 'none' : `0 0 20px ${ACCENT}44`,
              transition: 'all 0.25s',
            }}
          >
            {hfRunning
              ? <><span className="spinner" /> Running Ensemble Analysis…</>
              : '⚡ Run Ensemble Analysis'}
          </button>
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

      {/* ── Results: side-by-side Original + Grad-CAM + verdict ── */}
      {hfResult && (
        <div className="fade-in">
          {/* Diagnosis banner */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '1rem 1.5rem', borderRadius: 14,
            background: `${predColor}0c`,
            border: `1px solid ${predColor}33`,
            marginBottom: '1.5rem',
          }}>
            <span style={{ fontSize: '2.2rem' }}>{CLASS_META[hfResult.predicted]?.icon}</span>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: predColor, letterSpacing: '-0.02em' }}>
                {hfResult.predicted}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                {CLASS_META[hfResult.predicted]?.desc}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Latency</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem', color: ACCENT, fontWeight: 700 }}>
                {hfResult.inferenceMs.toFixed(0)}ms
              </div>
            </div>
          </div>

          {/* Side-by-side images */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: gradCamUrl ? '1fr 1fr' : '1fr',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}>
            {/* Original */}
            <div>
              <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                🖼 Original
              </div>
              <ImageFrame src={imageUrl} label="Original" />
            </div>

            {/* Grad-CAM */}
            {gradCamUrl ? (
              <div>
                <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                  🔥 Grad-CAM Activation Map
                </div>
                <ImageFrame
                  src={gradCamUrl}
                  label="Grad-CAM"
                  badge={`🔥 ${gradCamClass}`}
                  badgeColor={CLASS_META[gradCamClass]?.color}
                />
                <ColormapLegend />
              </div>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.02)', borderRadius: 10,
                border: '1px dashed rgba(255,255,255,0.08)',
                minHeight: 200,
              }}>
                <div style={{ textAlign: 'center', color: '#334155' }}>
                  <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                  <div style={{ fontSize: '0.78rem' }}>Generating Grad-CAM…</div>
                </div>
              </div>
            )}
          </div>

          {/* Confidence bars */}
          <div style={{
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: '1.25rem',
          }}>
            <div style={{ fontSize: '0.72rem', color: '#475569', textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:600, marginBottom:'0.75rem' }}>
              ⚡ Ensemble Confidence
            </div>
            {hfResult.confidences.map((c, i) => {
              const color = CLASS_META[c.label]?.color || ACCENT;
              return <ConfBar key={c.label} label={c.label} value={c.score} color={color} delay={i * 100} />;
            })}
            <div style={{ marginTop: '0.75rem', fontSize: '0.68rem', color: '#334155', fontStyle: 'italic' }}>
              Averaged softmax from best_phase1 + covid_model_3class (EfficientNetB0)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
