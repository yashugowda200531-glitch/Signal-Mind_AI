"use client";

import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { useSignal } from "@/context/SignalContext";

export default function ConstellationDiagram() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { data } = useSignal();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let animationFrameId: number;
    const ctx = canvas.getContext("2d")!;
    
    // Crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.offsetWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    let frame = 0;

    const render = () => {
      // Fade out for persistence effect (lower opacity = longer trails)
      ctx.fillStyle = "rgba(4,7,20,0.08)";
      ctx.fillRect(0, 0, size, size);

      // Draw grid
      ctx.strokeStyle = "rgba(0,212,255,0.05)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
      ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
      ctx.stroke();

      const cx = size / 2;
      const cy = size / 2;
      const r = size * 0.35;

      // Draw faint center crosshair
      ctx.fillStyle = "rgba(0,212,255,0.4)";
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#00ffff";

      // Pre-compute mean and RMS outside the animation loop for true DC removal and scaling
      let meanI = 0; let meanQ = 0; let rms = 1;
      const iqStep = (data?.waveform?.length) ? Math.max(1, Math.floor(data.waveform.length / 4)) : 1;
      
      if (data && data.waveform && data.waveform.length > iqStep) {
         let sumI = 0, sumQ = 0, sumSq = 0;
         const limit = data.waveform.length - iqStep;
         for (let j = 0; j < limit; j++) {
            sumI += data.waveform[j];
            sumQ += data.waveform[j + iqStep];
            sumSq += data.waveform[j]*data.waveform[j] + data.waveform[j+iqStep]*data.waveform[j+iqStep];
         }
         meanI = sumI / limit;
         meanQ = sumQ / limit;
         rms = Math.sqrt(sumSq / limit) || 1;
      }

      if (data && data.waveform && data.waveform.length > 1) {
        // Draw a chunk of 400 random samples every frame to build a persistent glowing cloud
        const ptsToDraw = 400;
        const maxIdx = data.waveform.length - iqStep - 1;
        
        for (let i = 0; i < ptsToDraw; i++) {
          const idx = Math.floor(Math.random() * maxIdx);
          
          // DC removal and auto-scaling
          const realI = ((data.waveform[idx] - meanI) / rms) * 0.4;
          const realQ = ((data.waveform[idx + iqStep] - meanQ) / rms) * 0.4;

          // Instantaneous Amplitude (Envelope)
          const A = Math.sqrt(realI * realI + realQ * realQ);

          // Instantaneous Phase extraction: atan2(x[n], x[n-1])
          const prevIdx = Math.max(0, idx - 1);
          const x_n = data.waveform[idx] - meanI;
          const x_prev = data.waveform[prevIdx] - meanI;
          let phase = Math.atan2(x_n, x_prev);
          
          // Add authentic SDR oscillator phase jitter
          phase += (Math.random() - 0.5) * 0.08;
          
          // Add authentic thermal amplitude jitter
          const jitteredA = A + (Math.random() - 0.5) * 0.02;

          // Analytic signal IQ projection
          const I = jitteredA * Math.cos(phase) * 1.5;
          const Q = jitteredA * Math.sin(phase) * 1.5;

          const x = cx + I * r;
          const y = cy - Q * r;

          ctx.globalAlpha = 0.6; // Let the background fader handle temporal decay
          ctx.beginPath();
          ctx.arc(x, y, 1.0, 0, Math.PI * 2);
          
          ctx.shadowBlur = 4;
          ctx.shadowColor = "#00ffff";
          ctx.fillStyle = "#00ffff";
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
      } else {
        // Idle noise cloud (ADC thermal noise simulator)
        for (let i = 0; i < 20; i++) {
          const I = (Math.random() - 0.5) * 0.15;
          const Q = (Math.random() - 0.5) * 0.15;
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.arc(cx + I * r, cy + Q * r, 0.8, 0, Math.PI * 2);
          ctx.fillStyle = "#00ffff";
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;
      }

      frame++;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

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
      <div className="absolute top-0 left-[10%] right-[10%]" style={{
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)",
        boxShadow: "0 0 8px rgba(0,212,255,0.4)",
      }} />

      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <span style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 12, fontWeight: 500, color: "#cbd5e1", letterSpacing: "0.04em",
          textShadow: "0 0 8px rgba(255,255,255,0.1)",
        }}>
          Pseudo-IQ Visualization
        </span>
        <button className="flex items-center gap-1" style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 9.5, fontWeight: 400, color: "#4a5f82",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.04)",
          borderRadius: 4, padding: "2px 6px", cursor: "pointer",
          letterSpacing: "0.04em",
        }}>
          {data ? data.modulation : "IDLE"} <ChevronDown style={{ width: 10, height: 10 }} />
        </button>
      </div>

      <div className="w-full h-full min-h-[320px] flex justify-center items-center mt-2" style={{ minHeight: 320 }}>
        <canvas
          ref={ref}
          style={{
            width: "100%", height: "100%",
            maxWidth: 320, maxHeight: 320,
            aspectRatio: "1/1",
            borderRadius: "50%",
            background: "radial-gradient(circle at center, rgba(0,212,255,0.05) 0%, transparent 70%)",
            border: "1px solid rgba(0,212,255,0.05)",
            boxShadow: "0 0 30px rgba(0,212,255,0.05) inset",
            filter: "contrast(1.1) brightness(1.1) drop-shadow(0 0 2px rgba(0,255,255,0.25))",
          }}
        />
      </div>
    </div>
  );
}
