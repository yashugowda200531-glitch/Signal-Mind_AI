import { useMemo, useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { useSignal } from "@/context/SignalContext";

export default function FFTChart() {
  const { data } = useSignal();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Animation state
  const [tIdx, setTIdx] = useState(0);

  useEffect(() => {
    if (!data?.spectrogram?.length) return;
    let frameId: number;
    
    const loop = (time: number) => {
       // Unthrottled 60 FPS for maximum microdynamics
       setTIdx(prev => (prev + 1) % data.spectrogram.length);
       frameId = requestAnimationFrame(loop);
    };
    
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [data?.spectrogram]);

  // EMA Smoothing state
  const smoothedDataRef = useRef<number[]>([]);

  // Native Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data?.spectrogram?.length) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear background
    ctx.clearRect(0, 0, width, height);
    
    const slice = data.spectrogram[tIdx];
    if (!slice || slice.length === 0) return;
    
    const totalBins = slice.length;
    
    // Initialize or resize smoothing buffer
    if (smoothedDataRef.current.length !== totalBins) {
      smoothedDataRef.current = [...slice];
    }
    
    // Apply Exponential Moving Average (EMA) smoothing (alpha = 0.25)
    // with sub-frame SDR microdynamics (ADC quantization texture & thermal breathing)
    const alpha = 0.25;
    for (let i = 0; i < totalBins; i++) {
      // Inject physical measurement instability into every bin
      const thermalNoise = (Math.random() - 0.5) * 1.8;
      const raw_db = slice[i] + thermalNoise;
      smoothedDataRef.current[i] = alpha * raw_db + (1 - alpha) * smoothedDataRef.current[i];
    }
    
    const smoothedSlice = smoothedDataRef.current;
    
    // Draw the continuous polyline
    ctx.beginPath();
    ctx.strokeStyle = "#d946ef"; // purple trace
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    
    // Fill gradient setup
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(233, 213, 255, 0.4)");
    gradient.addColorStop(0.5, "rgba(192, 132, 252, 0.2)");
    gradient.addColorStop(1, "rgba(124, 58, 237, 0.0)");

    for (let i = 0; i < totalBins; i++) {
      const x = (i / (totalBins - 1)) * width;
      // DB Scaling: Map -120 dB to bottom, 0 dB to top
      let db = smoothedSlice[i];
      if (db < -120) db = -120;
      if (db > 0) db = 0;
      
      const normalized = (db + 120) / 120; // 0 (bottom) to 1 (top)
      const y = height * (1 - normalized);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    // Stroke the main line
    ctx.stroke();
    
    // Complete path for fill
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
  }, [data?.spectrogram, tIdx]);

  return (
    <div className="relative overflow-hidden" style={{
      background: "rgba(4,7,20,0.85)",
      backdropFilter: "blur(30px) saturate(1.4)",
      border: "1px solid rgba(168,85,247,0.12)",
      borderRadius: 8,
      padding: "10px 12px 6px",
      boxShadow: "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02), inset 0 0 20px rgba(168,85,247,0.02)",
    }}>
      {/* Top purple glow */}
      <div className="absolute top-0 left-[5%] right-[5%]" style={{
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.6), transparent)",
        boxShadow: "0 0 8px rgba(168,85,247,0.4)",
      }} />

      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <span style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 12,
          fontWeight: 500,
          color: "#cbd5e1",
          letterSpacing: "0.04em",
          textShadow: "0 0 8px rgba(255,255,255,0.1)",
        }}>
          Frequency Domain (FFT)
        </span>
        <button className="flex items-center gap-1" style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 9.5,
          fontWeight: 400,
          color: "#4a5f82",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.04)",
          borderRadius: 4,
          padding: "2px 6px",
          cursor: "pointer",
          letterSpacing: "0.04em",
        }}>
          Hanning Window <ChevronDown style={{ width: 10, height: 10 }} />
        </button>
      </div>

      {/* Peak annotation */}
      <div className="absolute z-10 pointer-events-none" style={{ top: 48, left: "24%" }}>
        <div style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 9.5,
          fontWeight: 600,
          color: "#d8b4fe",
          textShadow: "0 0 12px rgba(168,85,247,0.8)",
        }}>
          {data ? `${data.dominantFreq.toFixed(2)} kHz` : "Scanning"}
        </div>
        <div style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 8.5,
          fontWeight: 500,
          color: "#a78bfa",
        }}>
          {data ? `${data.dominantMag.toFixed(1)} dBFS` : ""}
        </div>
      </div>

      <div className="w-full min-h-[300px] relative" style={{ height: 300, width: "100%" }}>
        {(!data?.spectrogram || data.spectrogram.length === 0) ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <span style={{ fontFamily: "var(--font-rajdhani)", color: "#a78bfa", fontSize: 14, opacity: 0.6 }}>No signal data</span>
          </div>
        ) : null}
        
        {/* Native High-Performance Canvas Renderer */}
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={300} 
          style={{ width: "100%", height: "100%", display: "block" }} 
        />
        
        {/* Simple X-Axis Labels Overlay */}
        {data && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-[9px] text-[#30405c]" style={{ fontFamily: "var(--font-rajdhani)", opacity: 0.8 }}>
            <span>0 kHz</span>
            <span>{(data.sampleRate / 4000).toFixed(1)} kHz</span>
            <span>{(data.sampleRate / 2000).toFixed(1)} kHz</span>
          </div>
        )}
        
        {/* Simple Y-Axis Labels Overlay */}
        <div className="absolute top-0 left-0 bottom-6 flex flex-col justify-between py-2 text-[9px] text-[#30405c]" style={{ fontFamily: "var(--font-rajdhani)", opacity: 0.8 }}>
          <span>0 dB</span>
          <span>-60 dB</span>
          <span>-120 dB</span>
        </div>
      </div>
    </div>
  );
}
