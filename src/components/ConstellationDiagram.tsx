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

      // Draw ideal constellation points if we have data and guess the modulation
      if (data && data.snr > 15) {
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        const mod = data.modulation;
        if (mod === "QAM-16") {
          for (let i = -1.5; i <= 1.5; i += 1) {
            for (let j = -1.5; j <= 1.5; j += 1) {
              ctx.beginPath();
              ctx.arc(cx + i * (r/1.5), cy + j * (r/1.5), 2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else {
          // PSK
          for (let i = 0; i < 4; i++) {
             const angle = (i * Math.PI) / 2 + Math.PI/4;
             ctx.beginPath();
             ctx.arc(cx + Math.cos(angle)*r, cy + Math.sin(angle)*r, 2, 0, Math.PI * 2);
             ctx.fill();
          }
        }
      }

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
        const ptsToDraw = 80;
        const maxIdx = data.waveform.length - iqStep - 1;
        const offset = (frame * 3) % Math.max(1, maxIdx - ptsToDraw);
        
        for (let i = 0; i < ptsToDraw; i++) {
          const idx = offset + i;
          if (idx + iqStep >= data.waveform.length) break;
          
          let I = 0;
          let Q = 0;
          const snrNorm = Math.max(0, Math.min(1, data.snr / 45));
          const noiseSpread = (1 - snrNorm) * 0.5 + 0.03; 
          const modType = data.signalType || data.modulation || "";
          
          // DC removal and auto-scaling
          const realI = ((data.waveform[idx] - meanI) / rms) * 0.4;
          const realQ = ((data.waveform[idx + iqStep] - meanQ) / rms) * 0.4;
          
          // Jitter and Drift
          const phaseJitter = (Math.random() - 0.5) * 0.15 * (1 - snrNorm);
          const ampJitter = 1.0 + (Math.random() - 0.5) * 0.05 * (1 - snrNorm);
          const symbolDrift = Math.sin(frame * 0.05 + i) * 0.02 * (1 - snrNorm);

          if (modType.includes("Noise") || modType.includes("Speech") || modType.includes("Voice") || modType.includes("Interference")) {
            // Random Gaussian/diffuse cloud
            I = realI * ampJitter + (Math.random() - 0.5) * noiseSpread * 2.5;
            Q = realQ * ampJitter + (Math.random() - 0.5) * noiseSpread * 2.5;
            I += symbolDrift; Q += symbolDrift;
          } else if (modType.includes("Carrier") || modType.includes("Tone")) {
            // Tight center cluster
            I = (Math.random() - 0.5) * noiseSpread * 0.5 + symbolDrift;
            Q = (Math.random() - 0.5) * noiseSpread * 0.5 + symbolDrift;
          } else if (modType.includes("16QAM")) {
            // 16 Grid Clusters
            const iVals = [-0.9, -0.3, 0.3, 0.9];
            const qVals = [-0.9, -0.3, 0.3, 0.9];
            const baseI = iVals[Math.floor(Math.random() * 4)];
            const baseQ = qVals[Math.floor(Math.random() * 4)];
            I = baseI * ampJitter + (Math.random() - 0.5) * noiseSpread;
            Q = baseQ * ampJitter + (Math.random() - 0.5) * noiseSpread;
          } else if (modType.includes("8PSK")) {
            // 8 Phase Clusters
            const angles = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, 5*Math.PI/4, 3*Math.PI/2, 7*Math.PI/4];
            const ang = angles[Math.floor(Math.random() * 8)];
            I = Math.cos(ang) * 0.8 * ampJitter + (Math.random() - 0.5) * noiseSpread;
            Q = Math.sin(ang) * 0.8 * ampJitter + (Math.random() - 0.5) * noiseSpread;
          } else if (modType.includes("QPSK") || modType.includes("Modulated") || modType.includes("Harmonic")) {
            // 4 Clusters
            const angles = [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4];
            const ang = angles[Math.floor(Math.random() * 4)];
            I = Math.cos(ang) * 0.8 * ampJitter + (Math.random() - 0.5) * noiseSpread;
            Q = Math.sin(ang) * 0.8 * ampJitter + (Math.random() - 0.5) * noiseSpread;
          } else {
            I = realI + (Math.random() - 0.5) * noiseSpread;
            Q = realQ + (Math.random() - 0.5) * noiseSpread;
          }
          
          // Global rotation offset
          const offsetPhase = frame * 0.01 + phaseJitter;
          if (!modType.includes("Noise") && !modType.includes("Carrier") && !modType.includes("Tone") && !modType.includes("Speech")) {
             const rotI = I * Math.cos(offsetPhase) - Q * Math.sin(offsetPhase);
             const rotQ = I * Math.sin(offsetPhase) + Q * Math.cos(offsetPhase);
             I = rotI; Q = rotQ;
          }

          const x = cx + I * r;
          const y = cy - Q * r;

          ctx.globalAlpha = 1 - (i / ptsToDraw) * 0.8;
          ctx.beginPath();
          const ptSize = 0.8 + (1 - i / ptsToDraw) * 1.0;
          ctx.arc(x, y, ptSize, 0, Math.PI * 2);
          
          ctx.shadowBlur = 4;
          ctx.shadowColor = "#00ffff";
          ctx.fillStyle = "#00ffff";
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
      } else {
        // Idle animation
        for (let i = 0; i < 3; i++) {
          const t = frame * 0.05 + i * 2;
          const I = Math.cos(t) * 0.5 + (Math.random() - 0.5) * 0.2;
          const Q = Math.sin(t) * 0.5 + (Math.random() - 0.5) * 0.2;

          ctx.beginPath();
          ctx.arc(cx + I * r, cy + Q * r, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
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
          {data ? data.modulation : "QAM-16"} <ChevronDown style={{ width: 10, height: 10 }} />
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
            filter: "contrast(1.2) brightness(1.2) drop-shadow(0 0 4px rgba(0,255,255,0.4))",
          }}
        />
      </div>
    </div>
  );
}
