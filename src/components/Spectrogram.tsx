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

    // Fill background
    ctx.fillStyle = "rgb(0,0,32)";
    ctx.fillRect(0, 0, drawW, drawH);

    let tIdx = 0;
    let lastTime = 0;

    const renderLoop = (time: number) => {
      // Shift everything DOWN by 1 pixel with SDR Waterfall temporal fading (energy smearing)
      ctx.globalAlpha = 0.96; // Persistence memory multiplier
      ctx.drawImage(canvas, 0, 0, drawW, drawH - 1, 0, 1, drawW, drawH - 1);
      
      // Apply slight background washout to simulate analog signal decay
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "rgb(0,0,32)";
      ctx.fillRect(0, 1, drawW, drawH - 1);
      
      ctx.globalAlpha = 1.0; // Reset for new row

      // Draw the new row on the top edge (y=0)
      const newRow = ctx.createImageData(drawW, 1);
      const d = newRow.data;

      if (data && data.spectrogram && data.spectrogram.length > 0) {
        // Unthrottled 60FPS SDR waterfall update
        tIdx = (tIdx + 1) % data.spectrogram.length;
        
        const row = data.spectrogram[tIdx];
        const fBins = row.length;

        for (let x = 0; x < drawW; x++) {
          const fIdx = Math.floor((x / drawW) * fBins);
          const rawMag = row[fIdx] || -120;
          
          let scaled = (rawMag + 90) / 80;
          scaled = Math.max(0, Math.min(1, scaled));
          // Contrast curve for heatmap
          scaled = scaled < 0.5 ? 2 * scaled * scaled : 1 - 2 * (1 - scaled) * (1 - scaled);
          
          const [r, g, b] = jet(scaled);
          
          const idx = x * 4;
          d[idx] = r; d[idx+1] = g; d[idx+2] = b; d[idx+3] = 255;
        }
      } else {
        // Idle state: dark
        for (let x = 0; x < drawW; x++) {
          const idx = x * 4;
          d[idx] = 0; d[idx+1] = 0; d[idx+2] = 32; d[idx+3] = 255;
        }
      }

      ctx.putImageData(newRow, 0, 0);
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);

    return () => cancelAnimationFrame(animationFrameId);
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
        {/* Y-axis labels (Time history) */}
        <div className="flex flex-col justify-between items-end" style={{ width: 24, paddingBottom: 16, paddingTop: 0 }}>
          {["0", "-2s", "-4s", "-6s", "-8s"].map((v) => (
            <span key={v} style={{
              fontFamily: "var(--font-rajdhani)",
              fontSize: 8.5, color: "#30405c", fontWeight: 400,
            }}>{v}</span>
          ))}
        </div>

        {/* Canvas + X-axis (Frequency) */}
        <div className="flex-1 flex flex-col h-full">
          <div className="relative flex-1 h-full min-h-[280px]">
            <canvas
              ref={ref}
              style={{
                width: "100%", height: "100%",
                borderRadius: 4, display: "block",
                boxShadow: "0 0 20px rgba(0,212,255,0.08)",
                filter: "contrast(1.05) brightness(1.05)",
              }}
            />
          </div>
          <div className="flex justify-between" style={{ marginTop: 2, paddingLeft: 2, paddingRight: 2 }}>
            {(() => {
              const nyq = data ? data.sampleRate / 2000 : 20;
              return [0, nyq * 0.25, nyq * 0.5, nyq * 0.75, nyq].map((v) => (
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
            Frequency (kHz)
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
