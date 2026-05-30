"use client";

import { useRef, useEffect } from "react";
import { useSignal } from "@/context/SignalContext";
import { useForensic } from "@/context/ForensicContext";
import { Flame } from "lucide-react";

export default function PersistenceHeatmap() {
  const { data } = useSignal();
  const { state: forensicState } = useForensic();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 2D Density Matrix: [x_freq][y_amp]
  const matrixRef = useRef<Float32Array | null>(null);

  // Animation derived from forensic context
  const tIdx = data?.spectrogram?.length && forensicState.durationMs > 0 
      ? Math.floor((forensicState.currentTimeMs / forensicState.durationMs) * data.spectrogram.length) % data.spectrogram.length
      : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data?.spectrogram?.length) return;
    
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Initialize matrix if needed
    if (!matrixRef.current || matrixRef.current.length !== width * height) {
       matrixRef.current = new Float32Array(width * height);
    }
    const matrix = matrixRef.current;

    // We process a few slices around tIdx to build history rapidly
    const slice = data.spectrogram[tIdx];
    if (!slice) return;

    // Decay the entire matrix (Fade-out effect)
    for (let i = 0; i < matrix.length; i++) {
        matrix[i] *= 0.94; // Decay factor
    }

    // Map the current FFT slice into the density matrix
    const totalBins = slice.length;
    for (let x = 0; x < width; x++) {
       // Map canvas X to FFT Bin
       const binIdx = Math.floor((x / width) * totalBins);
       const db = slice[binIdx];
       
       // Map Amplitude to canvas Y (0 dB at top, -120 dB at bottom)
       // dB is usually between 0 and -100
       let y = Math.floor((db / -120) * height);
       if (y < 0) y = 0;
       if (y >= height) y = height - 1;

       // Add density to the specific pixel
       matrix[x + y * width] += 0.2; // Intensity increment
    }

    // Render the matrix to an ImageData buffer using Thermal Colors
    const imgData = ctx.createImageData(width, height);
    const dataBuf = imgData.data;

    for (let i = 0; i < matrix.length; i++) {
        let val = matrix[i];
        if (val > 1.0) val = 1.0;
        
        // Thermal Color Scale (Black -> Dark Blue -> Purple -> Red -> Orange -> Yellow -> White)
        let r = 0, g = 0, b = 0;
        
        if (val < 0.2) {
            // Black to Dark Blue
            b = val * 5 * 200; // max 200
        } else if (val < 0.4) {
            // Dark Blue to Purple
            const t = (val - 0.2) * 5;
            r = t * 150;
            b = 200;
        } else if (val < 0.6) {
            // Purple to Red
            const t = (val - 0.4) * 5;
            r = 150 + t * 105;
            b = 200 - t * 200;
        } else if (val < 0.8) {
            // Red to Yellow
            const t = (val - 0.6) * 5;
            r = 255;
            g = t * 255;
        } else {
            // Yellow to White
            const t = (val - 0.8) * 5;
            r = 255;
            g = 255;
            b = t * 255;
        }

        const pxIdx = i * 4;
        dataBuf[pxIdx] = r;
        dataBuf[pxIdx + 1] = g;
        dataBuf[pxIdx + 2] = b;
        dataBuf[pxIdx + 3] = val > 0.05 ? 255 : (val * 20 * 255); // Alpha fade at very bottom
    }

    // Draw the thermal map
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(imgData, 0, 0);

    // Overlay grid and text
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height/2); ctx.lineTo(width, height/2); // -60dB line
    ctx.moveTo(width/2, 0); ctx.lineTo(width/2, height); // Center Freq line
    ctx.stroke();

  }, [data?.spectrogram, tIdx]);

  return (
    <div style={{
      background: "linear-gradient(180deg, #070B14 0%, #03050B 100%)",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.05)",
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      height: 280,
      boxShadow: "0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)"
    }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame style={{ width: 16, height: 16, color: "#ef4444" }} strokeWidth={2.5} />
          <h2 style={{
            fontFamily: "var(--font-orbitron)",
            fontSize: 14,
            fontWeight: 700,
            color: "#e2e8f0",
            letterSpacing: "0.05em",
            textTransform: "uppercase"
          }}>Signal Heatmap</h2>
          <span style={{
            background: "rgba(239,68,68,0.15)",
            color: "#fca5a5",
            fontSize: 10,
            padding: "2px 6px",
            borderRadius: 4,
            border: "1px solid rgba(239,68,68,0.3)",
            fontFamily: "var(--font-rajdhani)",
            fontWeight: 600,
            marginLeft: 8
          }}>PERSISTENCE MODE</span>
        </div>
        
        <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 12, color: "#64748b" }}>
           {data ? `F: ${data.dominantFreq.toFixed(2)} kHz` : "SCANNING"}
        </div>
      </div>

      <div className="relative flex-1 rounded overflow-hidden" style={{ background: "#02040a" }}>
         <canvas 
            ref={canvasRef}
            width={512}
            height={200}
            className="w-full h-full"
         />
         
         {/* Axis Labels */}
         <div className="absolute top-1 left-2 text-[10px] text-slate-500 font-mono">0 dB</div>
         <div className="absolute bottom-1 left-2 text-[10px] text-slate-500 font-mono">-120 dB</div>
      </div>
    </div>
  );
}
