"use client";

import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { useSignal } from "@/context/SignalContext";
import { getRfSpikes } from "@/lib/rfEngine";

/* ── SDR Colormaps ── */
function jet(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  if (t < 0.125) return [0, 0, Math.round(128 + (t / 0.125) * 127)];
  if (t < 0.375) return [0, Math.round(((t - 0.125) / 0.25) * 255), 255];
  if (t < 0.625) {
    const s = (t - 0.375) / 0.25;
    return [Math.round(s * 255), 255, Math.round(255 * (1 - s))];
  }
  if (t < 0.875) return [255, Math.round(255 * (1 - ((t - 0.625) / 0.25))), 0];
  return [Math.round(255 * (1 - ((t - 0.875) / 0.125) * 0.45)), 0, 0];
}

export default function Spectrogram({
  dynRange: propDynRange,
  persistence: propPersistence,
  overlap: propOverlap,
  fftSize: propFftSize,
  hideOverlays = false,
  onFpsUpdate,
  onDriftUpdate,
  onOccupancyUpdate
}: {
  dynRange?: number;
  persistence?: number;
  overlap?: number;
  fftSize?: number;
  hideOverlays?: boolean;
  onFpsUpdate?: (fps: number) => void;
  onDriftUpdate?: (drift: number) => void;
  onOccupancyUpdate?: (occ: number) => void;
} = {}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { data } = useSignal();
  
  // Real SDR History Engine is now handled entirely in the offscreen Canvas
  // to perfectly emulate hardware phosphor decay and scrolling memory.

  // Controls State (Fallback to internal if props not provided)
  const [internalDynRange, setDynRange] = useState(120);
  const [internalPersistence, setPersistence] = useState(0.92);
  const [internalOverlap, setOverlap] = useState(75);
  const [internalFftSize, setFftSize] = useState(2048);
  const [showControls, setShowControls] = useState(false);

  const dynRange = propDynRange ?? internalDynRange;
  const persistence = propPersistence ?? internalPersistence;
  const overlap = propOverlap ?? internalOverlap;
  const fftSize = propFftSize ?? internalFftSize;

  // Metrics State
  const [fps, setFps] = useState(0);
  const wobblePhaseRef = useRef(0);
  const rollingOccupancyRef = useRef(0);
  const agcGainRef = useRef(0); // Hardware AGC state

  // Force re-renders for React UI layers while Canvas handles high-perf loop if page uses it?
  // Wait, the Page layout renders the metrics! I need to pass occupancy back up.
  // I will add onOccupancyUpdate to the props!
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let animationFrameId: number;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    const drawW = W;
    const drawH = H;
    canvas.width  = drawW;
    canvas.height = drawH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    ctx.fillStyle = "rgb(0,0,32)";
    ctx.fillRect(0, 0, drawW, drawH);

    let tIdx = 0;
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let lastDrawTime = 0;
    let rollingOccupancy = 0;
    
    // Create a persistent offscreen canvas for hardware-style scrolling memory
    const offCanvas = document.createElement("canvas");
    offCanvas.width = drawW;
    offCanvas.height = drawH;
    const offCtx = offCanvas.getContext("2d", { willReadFrequently: true })!;
    offCtx.fillStyle = "rgb(0,0,32)";
    offCtx.fillRect(0, 0, drawW, drawH);
    
    // Slight horizontal wobble oscillator
    let wobblePhase = 0;

    const renderLoop = (time: number) => {
      // Throttle to 30 FPS for authentic SDR hardware rendering speed
      if (time - lastDrawTime < 33) {
        animationFrameId = requestAnimationFrame(renderLoop);
        return;
      }
      lastDrawTime = time;

      // Metric Calculation
      frameCount++;
      if (time - lastFpsTime >= 1000) {
        setFps(frameCount);
        const newDrift = (Math.random() - 0.5) * 0.12;
        
        if (onFpsUpdate) onFpsUpdate(frameCount);
        if (onDriftUpdate) onDriftUpdate(newDrift);
        if (onOccupancyUpdate) onOccupancyUpdate(rollingOccupancy);
        
        frameCount = 0;
        lastFpsTime = time;
      }

      // SDR Phosphor Persistence Decay
      ctx.globalAlpha = 1.0 - persistence;
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillRect(0, 0, drawW, drawH);
      ctx.globalAlpha = 1.0;

      if (data && data.spectrogram && data.spectrogram.length > 0) {
        // Feed rolling FFT history
        tIdx = (tIdx + 1) % data.spectrogram.length;
        const incomingRow = data.spectrogram[tIdx];
        
        // Add micro-instability, thermal texture, and horizontal wobble
        wobblePhase += 0.05;
        const wobble = Math.sin(wobblePhase) * 1.5;
        
        // Calculate dynamic occupancy
        let activeBins = 0;
        const noiseThreshold = data.noiseFloor + 12; // 12 dB above noise floor is considered "active"
        
        // Fetch synchronized Live RF Events
        const liveSpikes = getRfSpikes(time, incomingRow.length);
        
        // ----------------------------------------------------
        // AUTOMATIC GAIN CONTROL (AGC) ENGINE
        // ----------------------------------------------------
        let frameMax = -999;
        for (let i = 0; i < incomingRow.length; i++) {
           const val = incomingRow[i] + liveSpikes[i];
           if (val > frameMax) frameMax = val;
        }

        const AGC_TARGET = -12;
        if (frameMax + agcGainRef.current > AGC_TARGET) {
           agcGainRef.current -= 0.8; // Fast attack
        } else {
           agcGainRef.current += 0.05; // Slow decay
        }
        if (agcGainRef.current > 15) agcGainRef.current = 15;
        if (agcGainRef.current < -30) agcGainRef.current = -30;

        const noisyRow = incomingRow.map((v, i) => {
          // Add the central live spikes + AGC gain
          let binVal = v + liveSpikes[i] + agcGainRef.current;
          
          // Soft-knee analog compression for massive peaks
          if (binVal > -10) {
             binVal = -10 + (binVal + 10) * 0.4;
          }
          
          if (binVal > noiseThreshold) activeBins++;
          
          // ----------------------------------------------------
          // ADVANCED RF BACKGROUND SIMULATION
          // ----------------------------------------------------
          
          // 1. Base Thermal & ADC Quantization Noise
          let noise = (Math.random() - 0.5) * 1.8 + wobble;
          
          // 2. Colored Gaussian Atmospheric Texture (Simulated with low-frequency oscillators)
          const normIdx = i / incomingRow.length;
          const slowDrift = Math.sin(frameCount * 0.02 + normIdx * 10) * 0.6;
          const fastRipple = Math.cos(frameCount * 0.1 - normIdx * 40) * 0.3;
          noise += slowDrift + fastRipple;
          
          // 3. Faint Distant Carrier Leakage (Continuous weak bands)
          if (Math.abs(normIdx - 0.72) < 0.003) noise += Math.random() * 2 + 2;  // Weak carrier A
          if (Math.abs(normIdx - 0.89) < 0.001) noise += Math.random() * 3 + 1;  // Weak carrier B
          if (Math.abs(normIdx - 0.45) < 0.008) noise += Math.random() * 1.5 + 1;  // Diffuse bump
          
          // 4. Intermittent Stochastic Artifacts (Short-lived faint spikes)
          if (Math.random() < 0.0005) noise += Math.random() * 8; // rare medium spike
          if (Math.random() < 0.002) noise += Math.random() * 3;  // common tiny spike
          
          // Only add this heavy texturing if the original bin is near or below the noise floor
          // This prevents washing out actual strong signals
          if (binVal < noiseThreshold + 5) {
             noise += Math.random() * 5; // Extra textural grit in the deep noise floor
          }
          
          return binVal + noise;
        });
        
        // ----------------------------------------------------
        // HIGH-PERF SCROLLING CANVAS MEMORY
        // ----------------------------------------------------
        // 1. Shift the entire historical canvas down by 1 pixel
        offCtx.drawImage(offCanvas, 0, 0, drawW, drawH - 1, 0, 1, drawW, drawH - 1);
        
        // Update occupancy EMA
        const currentOccupancy = (activeBins / incomingRow.length) * 100;
        rollingOccupancy = rollingOccupancy * 0.9 + currentOccupancy * 0.1;

        const fBins = incomingRow.length;
        const imgData = new ImageData(drawW, 1);
        const d = imgData.data;

        for (let x = 0; x < drawW; x++) {
          const fIdx = Math.floor((x / drawW) * fBins);
          const rawMag = noisyRow[fIdx];
          
          let scaled = (rawMag + (dynRange - 30)) / (dynRange * 0.8);
          scaled = Math.max(0, Math.min(1, scaled));
          scaled = scaled < 0.5 ? 2 * scaled * scaled : 1 - 2 * (1 - scaled) * (1 - scaled);
          
          const [r, g, b] = jet(scaled);
          const idx = x * 4;
          d[idx] = r; d[idx+1] = g; d[idx+2] = b; d[idx+3] = 255;
        }
        
        // 3. Inject the new row at the top (y=0)
        offCtx.putImageData(imgData, 0, 0);
        
        // 4. Draw the offscreen buffer to the main presentation canvas
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(offCanvas, 0, 0);
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [data, dynRange, persistence]);

  return (
    <div className="relative overflow-hidden flex flex-col" style={{
      background: "rgba(4,7,20,0.85)",
      backdropFilter: "blur(30px) saturate(1.4)",
      border: "1px solid rgba(0,212,255,0.1)",
      borderRadius: 8,
      padding: "10px 12px 6px",
      boxShadow: "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02), inset 0 0 20px rgba(0,212,255,0.02)",
      height: "100%",
    }}>
      <div className="absolute top-0 left-[5%] right-[5%]" style={{
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)",
        boxShadow: "0 0 8px rgba(0,212,255,0.4)",
      }} />

      {/* ── Header ── */}
      {!hideOverlays && (
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <span style={{
            fontFamily: "var(--font-rajdhani)", fontSize: 12, fontWeight: 500, color: "#cbd5e1",
            letterSpacing: "0.04em", textShadow: "0 0 8px rgba(255,255,255,0.1)",
          }}>
            SDR Waterfall Sink
          </span>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowControls(!showControls)}
              className="flex items-center gap-1" style={{
              fontFamily: "var(--font-rajdhani)", fontSize: 9.5, color: showControls ? "#00d4ff" : "#4a5f82",
              background: "rgba(255,255,255,0.02)", border: `1px solid ${showControls ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.04)'}`,
              borderRadius: 4, padding: "2px 6px", cursor: "pointer",
            }}>
              <Settings2 style={{ width: 10, height: 10 }} /> Controls
            </button>
          </div>
        </div>
      )}

      {/* ── Main Canvas Area ── */}
      <div className="relative flex-1 flex gap-1.5 mt-2 min-h-0">
        
        {/* Controls Overlay */}
        {showControls && !hideOverlays && (
          <div className="absolute top-2 right-2 z-20 flex flex-col gap-2 p-3" style={{
            background: "rgba(10,14,30,0.95)", border: "1px solid rgba(0,212,255,0.2)",
            borderRadius: 4, backdropFilter: "blur(10px)", width: 180,
            boxShadow: "0 4px 20px rgba(0,0,0,0.8)"
          }}>
            <div className="text-[9px] text-[#00d4ff] uppercase tracking-wider mb-1 font-[var(--font-rajdhani)]">DSP Parameters</div>
            {[
              { label: "Dyn Range (dB)", val: dynRange, set: setDynRange, min: 60, max: 140, step: 10 },
              { label: "Persistence", val: persistence, set: setPersistence, min: 0.5, max: 0.99, step: 0.01 },
              { label: "Overlap %", val: overlap, set: setOverlap, min: 0, max: 99, step: 1 },
              { label: "FFT Size", val: fftSize, set: setFftSize, min: 512, max: 8192, step: 512 },
            ].map(ctrl => (
              <div key={ctrl.label} className="flex flex-col gap-1">
                <div className="flex justify-between text-[9px] font-[var(--font-rajdhani)] text-[#cbd5e1]">
                  <span>{ctrl.label}</span>
                  <span className="text-[#00d4ff]">{ctrl.val}</span>
                </div>
                <input 
                  type="range" min={ctrl.min} max={ctrl.max} step={ctrl.step} 
                  value={ctrl.val} onChange={(e) => ctrl.set(parseFloat(e.target.value))}
                  className="w-full h-1 bg-[#1a2333] rounded appearance-none cursor-pointer"
                />
              </div>
            ))}
          </div>
        )}

        {/* Y-axis labels (Time history) */}
        <div className="flex flex-col justify-between items-end" style={{ width: 24, paddingBottom: 16 }}>
          {["0", "-2s", "-4s", "-6s", "-8s"].map((v) => (
            <span key={v} style={{ fontFamily: "var(--font-rajdhani)", fontSize: 8.5, color: "#30405c" }}>{v}</span>
          ))}
        </div>

        {/* Canvas + X-axis (Frequency) */}
        <div className="flex-1 flex flex-col h-full relative">
          
          {/* Metrics Overlay */}
          {!hideOverlays && (
            <div className="absolute top-2 left-2 z-10 flex gap-4" style={{
              fontFamily: "var(--font-rajdhani)", fontSize: 9, color: "rgba(255,255,255,0.7)",
              background: "rgba(0,0,0,0.6)", padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)"
            }}>
              <span>FPS: <span className="text-[#00d4ff]">{fps}</span></span>
              <span>Drift: <span className="text-[#f59e0b]">+0.012 Hz</span></span>
              <span>Occupancy: <span className="text-[#22c55e]">{rollingOccupancyRef.current.toFixed(1)}%</span></span>
              <span>Floor: <span className="text-[#a855f7]">{data ? data.noiseFloor.toFixed(1) : -120} dB</span></span>
            </div>
          )}

          <div className="relative flex-1 h-full min-h-0">
            <canvas ref={ref} style={{
              width: "100%", height: "100%", display: "block", borderRadius: 4,
              boxShadow: "0 0 20px rgba(0,212,255,0.05)", filter: "contrast(1.1) brightness(1.05)"
            }} />
          </div>
          <div className="flex justify-between px-0.5 mt-0.5">
            {(() => {
              const nyq = data ? data.sampleRate / 2000 : 20;
              return [0, nyq * 0.25, nyq * 0.5, nyq * 0.75, nyq].map((v) => (
                <span key={v} style={{ fontFamily: "var(--font-rajdhani)", fontSize: 8.5, color: "#30405c" }}>{v.toFixed(1)}</span>
              ));
            })()}
          </div>
          <div className="text-center text-[#30405c]" style={{ fontFamily: "var(--font-rajdhani)", fontSize: 8.5, marginTop: -2 }}>
            Frequency (kHz)
          </div>
        </div>

        {/* Colorbar */}
        <div className="flex flex-col items-center" style={{ width: 28, paddingBottom: 16 }}>
          <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 8.5, color: "#45597a", marginBottom: 2 }}>Power</span>
          <div className="flex gap-1 flex-1">
            <div style={{
              width: 8, borderRadius: 2,
              background: "linear-gradient(to bottom, #cc0000, #ff4400, #ff9900, #cccc00, #66ff00, #00dd88, #00aaff, #0044ff, #000088)",
            }} />
            <div className="flex flex-col justify-between">
              {["0", "-20", "-40", "-60", "-80", "-100"].map((v) => (
                <span key={v} style={{ fontFamily: "var(--font-rajdhani)", fontSize: 7.5, color: "#30405c" }}>{v}</span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
