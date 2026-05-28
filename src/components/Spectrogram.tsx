"use client";

import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { useSignal } from "@/context/SignalContext";

/* ── Jet colormap: dark blue → cyan → green → yellow → red ── */
function jet(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  if (t < 0.125) {
    return [0, 0, Math.round(128 + (t / 0.125) * 127)];
  } else if (t < 0.375) {
    const s = (t - 0.125) / 0.25;
    return [0, Math.round(s * 255), 255];
  } else if (t < 0.625) {
    const s = (t - 0.375) / 0.25;
    return [Math.round(s * 255), 255, Math.round(255 * (1 - s))];
  } else if (t < 0.875) {
    const s = (t - 0.625) / 0.25;
    return [255, Math.round(255 * (1 - s)), 0];
  } else {
    const s = (t - 0.875) / 0.125;
    return [Math.round(255 * (1 - s * 0.45)), 0, 0];
  }
}

export default function Spectrogram() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { data } = useSignal();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let animationFrameId: number;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    const drawW = W * 2;
    const drawH = H * 2;
    canvas.width  = drawW;
    canvas.height = drawH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    // We will simulate a rolling STFT by holding a history matrix
    // size: [drawW] columns, each column is [drawH] pixels
    // To make it fast, we can draw columns and shift image data.
    
    // Initialize empty black canvas
    ctx.fillStyle = "rgb(0,0,128)";
    ctx.fillRect(0, 0, drawW, drawH);

    let tOffset = 0;

    let maxFFT = 1;
    if (data?.fft) {
      maxFFT = Math.max(...data.fft) || 1;
    }

    const renderLoop = () => {
      // Shift everything left by 1 pixel
      const imgData = ctx.getImageData(1, 0, drawW - 1, drawH);
      ctx.putImageData(imgData, 0, 0);

      // Draw the new column on the right edge
      const newCol = ctx.createImageData(1, drawH);
      const d = newCol.data;

      for (let y = 0; y < drawH; y++) {
        const freqRatio = 1 - y / drawH; // 0 to 1
        let power = 0;

        if (data && data.fft && data.fft.length > 0) {
          const fftIndex = Math.floor(freqRatio * data.fft.length);
          const rawMag = data.fft[fftIndex] || -100;
          // data.fft is now in dBFS [-100, 0]
          // Improve contrast: ignore bottom -80 to -100
          let scaled = (rawMag + 80) / 80;
          scaled = Math.pow(Math.max(0, scaled), 1.5);
          
          power = Math.min(1, scaled + Math.random() * 0.03);
          if (Math.abs(freqRatio - (data.dominantFreq / (data.sampleRate/2000))) < 0.02) {
             power = Math.min(1, power + 0.1);
          }
        } else {
          // Idle state noise
          power = Math.random() * 0.05;
          if (freqRatio < 0.2) power += 0.1 * Math.sin(tOffset * 0.05);
          if (Math.abs(freqRatio - 0.5) < 0.01) power += 0.2 * (Math.random() > 0.8 ? 1 : 0);
        }

        const [r, g, b] = jet(Math.max(0, Math.min(1, power)));
        const idx = y * 4;
        d[idx] = r; d[idx+1] = g; d[idx+2] = b; d[idx+3] = 255;
      }

      ctx.putImageData(newCol, drawW - 1, 0);
      tOffset++;

      // If we have data, we animate faster to show "processing", then slow down
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [data]);

  return (
    <div className="relative overflow-hidden" style={{
      background: "rgba(4,7,20,0.85)",
      backdropFilter: "blur(30px) saturate(1.4)",
      border: "1px solid rgba(0,212,255,0.1)",
      borderRadius: 8,
      padding: "10px 12px 6px",
      boxShadow: "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02), inset 0 0 20px rgba(0,212,255,0.02)",
    }}>
      <div className="absolute top-0 left-[5%] right-[5%]" style={{
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)",
        boxShadow: "0 0 8px rgba(0,212,255,0.4)",
      }} />

      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <span style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 12, fontWeight: 500, color: "#cbd5e1", letterSpacing: "0.04em",
          textShadow: "0 0 8px rgba(255,255,255,0.1)",
        }}>
          Spectrogram
        </span>
        <button className="flex items-center gap-1" style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 9.5, fontWeight: 400, color: "#4a5f82",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.04)",
          borderRadius: 4, padding: "2px 6px", cursor: "pointer",
          letterSpacing: "0.04em",
        }}>
          Jet <ChevronDown style={{ width: 10, height: 10 }} />
        </button>
      </div>

      {/* Chart area with axes */}
      <div className="flex gap-1.5 mt-2 w-full h-full min-h-[320px]" style={{ minHeight: 320 }}>
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between items-end" style={{ width: 24, paddingBottom: 16, paddingTop: 0 }}>
          {(() => {
            const nyq = data ? data.sampleRate / 2000 : 20;
            return [nyq, nyq * 0.75, nyq * 0.5, nyq * 0.25, 0].map((v) => (
              <span key={v} style={{
                fontFamily: "var(--font-rajdhani)",
                fontSize: 8.5, color: "#30405c", fontWeight: 400,
              }}>{v.toFixed(v >= 10 ? 0 : 1)}</span>
            ));
          })()}
        </div>

        {/* Canvas + X-axis */}
        <div className="flex-1 flex flex-col h-full">
          <div className="relative flex-1 h-full min-h-[280px]">
            <canvas
              ref={ref}
              style={{
                width: "100%", height: "100%",
                borderRadius: 4, display: "block",
                boxShadow: "0 0 20px rgba(0,212,255,0.08)",
                filter: "contrast(1.1) brightness(1.1)",
              }}
            />
          </div>
          <div className="flex justify-between" style={{ marginTop: 2, paddingLeft: 2, paddingRight: 2 }}>
            {(() => {
              const dur = data ? data.duration : 2;
              return [0, dur * 0.25, dur * 0.5, dur * 0.75, dur].map((v) => (
                <span key={v} style={{
                  fontFamily: "var(--font-rajdhani)",
                  fontSize: 8.5, color: "#30405c", fontWeight: 400,
                }}>{v.toFixed(1)}</span>
              ));
            })()}
          </div>
          <div className="text-center" style={{
            fontFamily: "var(--font-rajdhani)",
            fontSize: 8.5, color: "#30405c", fontWeight: 400, marginTop: 0,
          }}>
            Time (s)
          </div>
        </div>

        {/* Colorbar + power labels */}
        <div className="flex flex-col items-center" style={{ width: 28, paddingBottom: 16 }}>
          <span style={{
            fontFamily: "var(--font-rajdhani)",
            fontSize: 8.5, color: "#45597a", fontWeight: 500, marginBottom: 2,
          }}>
            Power
          </span>
          <div className="flex gap-1" style={{ flex: 1 }}>
            <div style={{
              width: 8, borderRadius: 2,
              background: "linear-gradient(to bottom, #cc0000, #ff4400, #ff9900, #cccc00, #66ff00, #00dd88, #00aaff, #0044ff, #000088)",
              boxShadow: "0 0 8px rgba(0,180,255,0.2)",
            }} />
            <div className="flex flex-col justify-between">
              {["0", "-20", "-40", "-60", "-80", "-100"].map((v) => (
                <span key={v} style={{
                  fontFamily: "var(--font-rajdhani)",
                  fontSize: 7.5, color: "#30405c", lineHeight: 1, fontWeight: 400,
                }}>{v}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
