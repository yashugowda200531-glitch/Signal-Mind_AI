import { useMemo, useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { useSignal } from "@/context/SignalContext";
import { getRfSpikes } from "@/lib/rfEngine";

import { useForensic } from "@/context/ForensicContext";

export default function FFTChart() {
  const { data } = useSignal();
  const { state: forensicState } = useForensic();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Animation state derived from forensic timeline
  const tIdx = data?.spectrogram?.length && forensicState.durationMs > 0 
      ? Math.floor((forensicState.currentTimeMs / forensicState.durationMs) * data.spectrogram.length) % data.spectrogram.length
      : 0;

  // EMA Smoothing state
  const smoothedDataRef = useRef<number[]>([]);
  const peakHoldDataRef = useRef<number[]>([]);
  const mousePosRef = useRef<{ x: number, y: number } | null>(null);
  const agcGainRef = useRef(0); // Hardware AGC state

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
      peakHoldDataRef.current = new Array(totalBins).fill(-120);
    }
    
    // Fetch synchronized Live RF Events (interference bursts, transient carriers)
    const liveSpikes = getRfSpikes(performance.now(), totalBins);
    
    // Apply Exponential Moving Average (EMA) smoothing (alpha = 0.25)
    // with sub-frame SDR microdynamics (ADC quantization texture & thermal breathing)
    const alpha = 0.25;
    const globalBreath = Math.sin(performance.now() * 0.005) * 0.5; // slow noise floor breathing
    
    // ----------------------------------------------------
    // AUTOMATIC GAIN CONTROL (AGC) ENGINE
    // ----------------------------------------------------
    let frameMax = -999;
    for (let i = 0; i < totalBins; i++) {
        const val = slice[i] + liveSpikes[i];
        if (val > frameMax) frameMax = val;
    }

    const AGC_TARGET = -12; // Target peak dBFS
    const ATTACK_RATE = 0.8; // Fast attack when signal hits
    const DECAY_RATE = 0.05; // Slow release when signal fades
    
    if (frameMax + agcGainRef.current > AGC_TARGET) {
       agcGainRef.current -= ATTACK_RATE; // Compress gain
    } else {
       agcGainRef.current += DECAY_RATE; // Expand gain
    }
    
    // Clamp hardware AGC limits
    if (agcGainRef.current > 15) agcGainRef.current = 15;
    if (agcGainRef.current < -30) agcGainRef.current = -30;
    
    for (let i = 0; i < totalBins; i++) {
      // Apply AGC Gain Shift
      let raw_db = slice[i] + liveSpikes[i] + agcGainRef.current;
      
      // Soft-knee analog compression for massive peaks
      if (raw_db > -10) {
         raw_db = -10 + (raw_db + 10) * 0.4; // 2.5:1 compression above -10 dBFS
      }
      
      // Inject physical measurement instability (increased for realism)
      let thermalNoise = (Math.random() - 0.5) * 2.5 + globalBreath;
      
      // Sub-frame peak instability & tiny amplitude modulation for actual signal peaks
      if (raw_db > -60) {
         const amplitudeFlutter = (Math.random() - 0.5) * Math.abs(raw_db) * 0.04;
         thermalNoise += amplitudeFlutter;
      }
      
      raw_db += thermalNoise;
      smoothedDataRef.current[i] = alpha * raw_db + (1 - alpha) * smoothedDataRef.current[i];
      
      // Update Peak Hold (slow decay)
      peakHoldDataRef.current[i] = Math.max(
        peakHoldDataRef.current[i] - 0.2, // decay rate
        smoothedDataRef.current[i]
      );
    }
    
    const smoothedSlice = smoothedDataRef.current;
    const peakSlice = peakHoldDataRef.current;
    
    // ----------------------------------------------------
    // 1. Draw Professional RF Grid & Labels
    // ----------------------------------------------------
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    ctx.font = "9px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.textAlign = "left";

    // Vertical Grid (Frequency)
    const nyquist = (data.sampleRate / 2) / 1000; // in kHz
    for (let i = 1; i <= 10; i++) {
       const x = (width / 10) * i;
       ctx.moveTo(x, 0);
       ctx.lineTo(x, height);
       
       // kHz Label at bottom
       if (i < 10) {
         const freq = (nyquist / 10) * i;
         ctx.fillText(`${freq.toFixed(1)}k`, x + 4, height - 6);
       }
    }
    
    // Nyquist label
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(0, 212, 255, 0.4)";
    ctx.fillText(`NYQUIST (${nyquist.toFixed(1)}k)`, width - 6, height - 6);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";

    // Horizontal Grid (dB)
    for (let i = 1; i <= 6; i++) {
       const y = (height / 6) * i;
       ctx.moveTo(0, y);
       ctx.lineTo(width, y);
       
       // dB Label on left
       if (i < 6) {
         const dbVal = -((i / 6) * 120);
         ctx.fillText(`${Math.round(dbVal)} dB`, 6, y - 4);
       }
    }
    ctx.stroke();

    // ----------------------------------------------------
    // LIVE CARRIER & HARMONIC DETECTION ENGINE
    // ----------------------------------------------------
    if (data.dominantFreq > 0) {
      const drawMarker = (freq: number, label: string, color: string, dash: number[], alignRight = false) => {
          if (freq >= nyquist || freq <= 0) return;
          const x = (freq / nyquist) * width;
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.setLineDash(dash);
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
          ctx.setLineDash([]);
          
          let labelX = x + 4;
          if (alignRight) labelX = x - 25;
          if (labelX < 6) labelX = 6;
          if (labelX > width - 40) labelX = width - 40;
          
          ctx.fillStyle = color.replace(/0\.\d+\)$/, "0.8)");
          ctx.fillText(label, labelX, 22);
      };

      // 1. Primary Carrier
      const domX = (data.dominantFreq / nyquist) * width;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)"; // Red faint dashed line
      ctx.setLineDash([4, 4]);
      ctx.moveTo(domX, 0);
      ctx.lineTo(domX, height);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = "rgba(239, 68, 68, 0.7)";
      let labelX = domX - 45;
      if (labelX < 6) labelX = 6;
      if (labelX > width - 90) labelX = width - 90;
      ctx.fillText(`▼ CARRIER ${data.dominantFreq.toFixed(2)}`, labelX, 12);

      // 2. Harmonic Multiples (H2, H3, H4)
      for (let i = 2; i <= 4; i++) {
         const hFreq = data.dominantFreq * i;
         if (hFreq < nyquist) {
            const hBin = Math.round((hFreq / nyquist) * totalBins);
            if (hBin >= 0 && hBin < totalBins) {
               // Only draw if energy actually exists there
               const energy = smoothedSlice[hBin];
               const noiseFloorThreshold = data.noiseFloor + 5;
               if (energy > noiseFloorThreshold) {
                   drawMarker(hFreq, `H${i}`, "rgba(168, 85, 247, 0.5)", [2, 6]);
               }
            }
         }
      }
      
      // 3. Sideband Detection
      // Assuming a standardized symmetric sideband based on the 99% occupancy bandwidth
      const sbOffset = (data.bandwidth / 2) / 1000; // kHz
      if (sbOffset > 0.1) { 
         const lsbFreq = data.dominantFreq - sbOffset;
         const usbFreq = data.dominantFreq + sbOffset;
         drawMarker(lsbFreq, "LSB", "rgba(56, 189, 248, 0.4)", [2, 4], true);
         drawMarker(usbFreq, "USB", "rgba(56, 189, 248, 0.4)", [2, 4]);
      }
    }

    // Helper to map dB to Y coordinate
    const getDbY = (db: number) => {
      let d = db;
      if (d < -120) d = -120;
      if (d > 0) d = 0;
      return height * (1 - ((d + 120) / 120));
    };

    // ----------------------------------------------------
    // 2. Draw Peak Hold Trace
    // ----------------------------------------------------
    ctx.beginPath();
    ctx.strokeStyle = "rgba(168, 85, 247, 0.6)"; // Stronger peak hold memory
    ctx.lineWidth = 1.0;
    ctx.lineJoin = "round";
    for (let i = 0; i < totalBins; i++) {
      const x = (i / (totalBins - 1)) * width;
      const y = getDbY(peakSlice[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // ----------------------------------------------------
    // 3. Draw Main FFT Trace with Phosphor Glow
    // ----------------------------------------------------
    ctx.globalCompositeOperation = "lighter";
    
    // First Pass: Outer diffuse bloom
    ctx.beginPath();
    ctx.strokeStyle = "rgba(232, 121, 249, 0.6)"; // Brighter Neon pink/purple faint
    ctx.lineWidth = 4.5;
    ctx.lineJoin = "round";
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#e879f9";

    for (let i = 0; i < totalBins; i++) {
      const x = (i / (totalBins - 1)) * width;
      const y = getDbY(smoothedSlice[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Second Pass: Hot core
    ctx.beginPath();
    ctx.strokeStyle = "#ffffff"; // Pure white core
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.shadowBlur = 6;
    ctx.shadowColor = "#f0abfc";

    for (let i = 0; i < totalBins; i++) {
      const x = (i / (totalBins - 1)) * width;
      const y = getDbY(smoothedSlice[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Reset styles
    ctx.shadowBlur = 0; 
    ctx.globalCompositeOperation = "source-over";

    // ----------------------------------------------------
    // 3.5 Draw Multi-Carrier Tracking Overlays
    // ----------------------------------------------------
    if (data?.trackedCarriers) {
      for (const track of data.trackedCarriers) {
        const info = track.info;
        const startX = (info.startIndex / totalBins) * width;
        const endX = (info.endIndex / totalBins) * width;
        const centerX = ((info.startIndex + info.endIndex) / 2 / totalBins) * width;
        const peakY = getDbY(info.peakMag);
        
        const isThreat = track.ai.threatAssessment.severity === "HIGH" || track.ai.threatAssessment.severity === "CRITICAL";
        const colorPrimary = isThreat ? "#ef4444" : "#22c55e"; // Red for threat, Green for safe
        const colorBg = isThreat ? "rgba(239, 68, 68, 0.15)" : "rgba(168, 85, 247, 0.08)";
        const colorBorder = isThreat ? "rgba(239, 68, 68, 0.4)" : "rgba(168, 85, 247, 0.3)";

        // A. Shaded Bandwidth Region
        ctx.fillStyle = colorBg;
        ctx.fillRect(startX, 0, endX - startX, height);
        
        // B. Vertical edges
        ctx.strokeStyle = colorBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(startX, 0); ctx.lineTo(startX, height);
        ctx.moveTo(endX, 0); ctx.lineTo(endX, height);
        ctx.stroke();

        // C. Target Crosshair at Peak
        ctx.strokeStyle = colorPrimary;
        ctx.lineWidth = isThreat ? 2.0 : 1.5;
        ctx.beginPath();
        if (isThreat) {
           // Diamond lock for threat
           ctx.moveTo(centerX, peakY - 8); ctx.lineTo(centerX + 8, peakY);
           ctx.lineTo(centerX, peakY + 8); ctx.lineTo(centerX - 8, peakY);
           ctx.closePath();
        } else {
           // Normal crosshair
           ctx.moveTo(centerX - 6, peakY); ctx.lineTo(centerX + 6, peakY);
           ctx.moveTo(centerX, peakY - 6); ctx.lineTo(centerX, peakY + 6);
        }
        ctx.stroke();

        // D. Intelligence Label
        ctx.fillStyle = isThreat ? "rgba(239, 68, 68, 0.15)" : "rgba(4, 7, 20, 0.85)";
        ctx.strokeStyle = isThreat ? "rgba(239, 68, 68, 0.8)" : "rgba(34, 197, 94, 0.5)";
        
        const labelText = `[${info.id}] ${isThreat ? "THREAT" : track.ai.modulationType} | ${info.snr.toFixed(1)}dB`;
        const labelWidth = ctx.measureText(labelText).width + 12;
        
        let lx = centerX - labelWidth/2;
        let ly = peakY - 24;
        
        // Bounds checking
        if (lx < 4) lx = 4;
        if (lx + labelWidth > width - 4) lx = width - labelWidth - 4;
        if (ly < 10) ly = peakY + 14;

        ctx.fillRect(lx, ly, labelWidth, 16);
        ctx.strokeRect(lx, ly, labelWidth, 16);
        
        ctx.fillStyle = colorPrimary;
        ctx.font = isThreat ? "bold 9px monospace" : "9px monospace";
        ctx.fillText(labelText, lx + 6, ly + 11);
      }
    }

    // ----------------------------------------------------
    // 4. Draw Live Frequency Cursor
    // ----------------------------------------------------
    if (mousePosRef.current) {
      const { x } = mousePosRef.current;
      
      // Calculate raw bin under mouse
      let rawBinIdx = Math.round((x / width) * (totalBins - 1));
      
      // PEAK SNAP: Magnetic lock to local signal peak within a 15-bin search radius
      let binIdx = rawBinIdx;
      let maxDb = -999;
      const searchRadius = 15;
      for(let j = Math.max(0, rawBinIdx - searchRadius); j <= Math.min(totalBins - 1, rawBinIdx + searchRadius); j++) {
         if (smoothedSlice[j] > maxDb) {
            maxDb = smoothedSlice[j];
            binIdx = j;
         }
      }

      if (binIdx >= 0 && binIdx < totalBins) {
        const binX = (binIdx / (totalBins - 1)) * width;
        const binY = getDbY(smoothedSlice[binIdx]);
        
        // Vertical Frequency Tracking Line
        ctx.beginPath();
        ctx.strokeStyle = "rgba(0, 212, 255, 0.4)";
        ctx.lineWidth = 1;
        ctx.moveTo(binX, 0);
        ctx.lineTo(binX, height);
        ctx.stroke();

        // Horizontal Amplitude Tracking Line
        ctx.beginPath();
        ctx.strokeStyle = "rgba(0, 212, 255, 0.25)";
        ctx.setLineDash([2, 4]);
        ctx.moveTo(0, binY);
        ctx.lineTo(width, binY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Signal Node Marker
        ctx.beginPath();
        ctx.arc(binX, binY, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#00d4ff";
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#00d4ff";
        
        // Telemetry Readout Logic
        const freqKHz = (binIdx / totalBins) * (data.sampleRate / 2000);
        const dbLevel = smoothedSlice[binIdx];
        const relativeDb = dbLevel - data.dominantMag;
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(4, 7, 20, 0.95)";
        ctx.strokeStyle = "rgba(0, 212, 255, 0.5)";
        ctx.lineWidth = 1;
        
        // Smart bounds checking to keep tooltip on-screen
        let ttX = binX + 12;
        if (ttX > width - 110) ttX = binX - 115;
        let ttY = binY - 45;
        if (ttY < 10) ttY = binY + 15;
        
        // Draw Telemetry Glass Box
        ctx.fillRect(ttX, ttY, 105, 52);
        ctx.strokeRect(ttX, ttY, 105, 52);
        
        // Text Data
        ctx.fillStyle = "#00d4ff";
        ctx.font = "9px monospace";
        ctx.fillText(`F: ${freqKHz.toFixed(3)} kHz`, ttX + 6, ttY + 12);
        ctx.fillText(`P: ${dbLevel.toFixed(1)} dBFS`, ttX + 6, ttY + 24);
        
        // Relative dBc (red if dangerously close to primary carrier peak)
        ctx.fillStyle = relativeDb >= -3 ? "#f87171" : "#94a3b8"; 
        ctx.fillText(`Δ: ${relativeDb > 0 ? '+' : ''}${relativeDb.toFixed(1)} dBc`, ttX + 6, ttY + 36);
        
        // Raw DSP Bin
        ctx.fillStyle = "#475569";
        ctx.fillText(`BIN: [${binIdx}]`, ttX + 6, ttY + 48);
      }
    }

    // ----------------------------------------------------
    // 5. Global Threat Pulse Overlay
    // ----------------------------------------------------
    if (data?.globalThreat && (data.globalThreat.severity === "HIGH" || data.globalThreat.severity === "CRITICAL")) {
       const pulseAlpha = (Math.sin(performance.now() * 0.005) + 1) / 2 * 0.15 + 0.05;
       ctx.fillStyle = `rgba(239, 68, 68, ${pulseAlpha})`;
       ctx.fillRect(0, 0, width, height);
       
       // Red border
       ctx.strokeStyle = `rgba(239, 68, 68, ${pulseAlpha + 0.2})`;
       ctx.lineWidth = 4;
       ctx.strokeRect(0, 0, width, height);
    }
    
  }, [data?.spectrogram, tIdx, data?.globalThreat, data?.trackedCarriers]);

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

      <div className="w-full flex-1 relative min-h-0">
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
        
        {/* Interactive Mouse Overlay for Cursor */}
        <div 
          className="absolute inset-0 z-30 cursor-crosshair"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            mousePosRef.current = {
              x: (e.clientX - rect.left) * (800 / rect.width),
              y: (e.clientY - rect.top) * (300 / rect.height)
            };
          }}
          onMouseLeave={() => { mousePosRef.current = null; }}
        />
      </div>
    </div>
  );
}
