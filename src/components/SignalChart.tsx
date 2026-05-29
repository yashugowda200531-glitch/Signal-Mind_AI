"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { useSignal } from "@/context/SignalContext";

export default function SignalChart() {
  const { data } = useSignal();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Oscilloscope state
  const smoothedBuffer = useRef<number[]>([]);
  const offsetRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    let frameId: number;
    const numPoints = 800; // Resolution of the oscilloscope
    
    // Initialize smoothing buffer
    if (smoothedBuffer.current.length !== numPoints) {
      smoothedBuffer.current = new Array(numPoints).fill(0);
    }
    
    const loop = () => {
      frameId = requestAnimationFrame(loop);
      
      const width = canvas.width;
      const height = canvas.height;
      const midY = height / 2;
      
      // Clear background with slight fade for persistence effect
      ctx.fillStyle = "rgba(4, 7, 20, 0.4)";
      ctx.fillRect(0, 0, width, height);
      
      if (!data?.waveform || data.waveform.length === 0) {
        // Draw dead line if no data
        ctx.beginPath();
        ctx.strokeStyle = "rgba(0, 212, 255, 0.3)";
        ctx.lineWidth = 1;
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();
        return;
      }
      
      const wave = data.waveform;
      const waveLen = wave.length;
      
      // Advance the sliding window (scroll speed)
      // Speed scales roughly with sample rate so it looks natural
      const speed = Math.max(1, Math.floor(waveLen / 400));
      offsetRef.current = (offsetRef.current + speed) % waveLen;
      const currentOffset = offsetRef.current;
      
      // Calculate dynamic AGC (Auto Gain Control) to keep wave visible
      let maxAmp = 0.01;
      const step = Math.max(1, Math.floor(waveLen / numPoints));
      
      for (let i = 0; i < numPoints; i++) {
        const idx = (currentOffset + i * step) % waveLen;
        let sample = wave[idx];
        if (Math.abs(sample) > maxAmp) maxAmp = Math.abs(sample);
      }
      
      // Target 80% vertical occupancy
      const gain = (height * 0.4) / maxAmp;
      
      ctx.beginPath();
      ctx.strokeStyle = "#00d4ff"; // Cyan oscilloscope trace
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      
      const alpha = 0.2; // EMA Smoothing factor
      
      for (let i = 0; i < numPoints; i++) {
        const idx = (currentOffset + i * step) % waveLen;
        let sample = wave[idx];
        
        // Add tiny ADC thermal noise when signal is dead to keep it "alive"
        if (maxAmp < 0.05) {
          sample += (Math.random() - 0.5) * 0.015;
        } else {
          // Inject correlated amplitude bursts and transient noise for signal physics
          sample += (Math.random() - 0.5) * 0.03 * sample;
        }
        
        // Apply EMA temporal smoothing to the pixel buffer (Phosphor decay effect)
        smoothedBuffer.current[i] = alpha * sample + (1 - alpha) * smoothedBuffer.current[i];
        
        const x = (i / (numPoints - 1)) * width;
        const y = midY - (smoothedBuffer.current[i] * gain);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
    };
    
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [data?.waveform]);

  return (
    <div className="relative overflow-hidden" style={{
      background: "rgba(4,7,20,0.85)",
      backdropFilter: "blur(30px) saturate(1.4)",
      border: "1px solid rgba(0,212,255,0.1)",
      borderRadius: 8,
      padding: "10px 12px 6px",
      boxShadow: "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02), inset 0 0 20px rgba(0,212,255,0.02)",
    }}>
      {/* Top glow line */}
      <div className="absolute top-0 left-[5%] right-[5%]" style={{
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)",
        boxShadow: "0 0 8px rgba(0,212,255,0.4)",
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
          Time Domain Signal
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
          ◀ Real-time <ChevronDown style={{ width: 10, height: 10 }} />
        </button>
      </div>

      <div className="w-full min-h-[300px] relative" style={{ height: 300, width: "100%" }}>
        {(!data?.waveform || data.waveform.length === 0) ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <span style={{ fontFamily: "var(--font-rajdhani)", color: "#00d4ff", fontSize: 14, opacity: 0.6 }}>No signal data</span>
          </div>
        ) : null}
        
        {/* Native High-Performance Canvas Renderer */}
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={300} 
          style={{ width: "100%", height: "100%", display: "block" }} 
        />
        
        {/* Center line (0 Volt reference) */}
        <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-[#00d4ff] opacity-10 pointer-events-none" />
        
        {/* Simple Time-Axis Labels Overlay */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-[9px] text-[#30405c]" style={{ fontFamily: "var(--font-rajdhani)", opacity: 0.8 }}>
          <span>Live 0ms</span>
          <span>Rolling Buffer</span>
          <span>-{(data?.waveform ? (data.waveform.length / (data.sampleRate || 48000)) * 1000 : 0).toFixed(0)} ms</span>
        </div>
        
        {/* Simple Amplitude Labels Overlay */}
        <div className="absolute top-0 left-0 bottom-6 flex flex-col justify-between py-2 text-[9px] text-[#30405c]" style={{ fontFamily: "var(--font-rajdhani)", opacity: 0.8 }}>
          <span>+V</span>
          <span>0</span>
          <span>-V</span>
        </div>
      </div>
    </div>
  );
}
