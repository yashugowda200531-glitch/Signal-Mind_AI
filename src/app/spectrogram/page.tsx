"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useSignal } from "@/context/SignalContext";
import { Settings2, Activity, Zap, Radio, RefreshCcw } from "lucide-react";

// Use dynamic imports to prevent SSR hydration errors on canvas-heavy components
const FFTChart    = dynamic(() => import("@/components/FFTChart"),    { ssr: false });
const Spectrogram = dynamic(() => import("@/components/Spectrogram"), { ssr: false });

export default function SpectrogramPage() {
  const { data } = useSignal();

  // SDR Controls State
  const [fftSize, setFftSize] = useState(2048);
  const [overlap, setOverlap] = useState(75);
  const [dynRange, setDynRange] = useState(120);
  const [persistence, setPersistence] = useState(0.92);
  const [waterfallSpeed, setWaterfallSpeed] = useState(1);
  const [peakHold, setPeakHold] = useState(false);
  const [averaging, setAveraging] = useState(1);
  const [colormap, setColormap] = useState("jet");
  const [rfMode, setRfMode] = useState("rf");

  // Metrics State from Spectrogram engine
  const [fps, setFps] = useState(0);
  const [drift, setDrift] = useState(0);
  const [occupancy, setOccupancy] = useState(0);

  return (
    <div className="min-h-screen overflow-x-hidden flex" style={{ background: "#030512", color: "#dfe6f0" }}>
      <Sidebar />
      
      <div className="flex-1 flex flex-col relative z-10" style={{ marginLeft: 156 }}>
        <Header />

        <main className="flex-1 p-4 flex flex-col gap-4 mt-16 max-h-[calc(100vh-64px)] overflow-hidden">
          
          {/* 1. TOP CONTROL PANEL */}
          <div className="flex items-center gap-6 shrink-0" style={{
            background: "rgba(4,7,20,0.85)", backdropFilter: "blur(30px) saturate(1.4)",
            border: "1px solid rgba(0,212,255,0.15)", borderRadius: 8, padding: "12px 20px",
            boxShadow: "0 4px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.02)"
          }}>
            <div className="flex items-center gap-2 border-r border-[#ffffff0a] pr-6">
              <Settings2 size={16} className="text-[#00d4ff]" />
              <span className="font-[var(--font-rajdhani)] text-[13px] font-semibold tracking-wider text-[#cbd5e1]">
                SDR CONTROLS
              </span>
            </div>

            <div className="flex flex-1 items-center justify-between gap-4 font-[var(--font-rajdhani)] text-[11px] text-[#8fa1c4]">
              
              <div className="flex items-center gap-2">
                <span>FFT Size</span>
                <select value={fftSize} onChange={e => setFftSize(Number(e.target.value))} className="bg-[#0a0f25] border border-[#ffffff10] rounded px-2 py-1 text-[#00d4ff] outline-none">
                  {[512, 1024, 2048, 4096, 8192].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span>Overlap</span>
                <input type="range" min={0} max={99} value={overlap} onChange={e => setOverlap(Number(e.target.value))} className="w-16 accent-[#00d4ff]" />
                <span className="text-[#00d4ff] w-6">{overlap}%</span>
              </div>

              <div className="flex items-center gap-2">
                <span>Dyn Range</span>
                <input type="range" min={60} max={140} step={10} value={dynRange} onChange={e => setDynRange(Number(e.target.value))} className="w-16 accent-[#00d4ff]" />
                <span className="text-[#00d4ff] w-10">{dynRange} dB</span>
              </div>

              <div className="flex items-center gap-2">
                <span>Persistence</span>
                <input type="range" min={0.5} max={0.99} step={0.01} value={persistence} onChange={e => setPersistence(Number(e.target.value))} className="w-16 accent-[#00d4ff]" />
                <span className="text-[#00d4ff] w-8">{persistence}</span>
              </div>

              <div className="flex items-center gap-2">
                <span>Colormap</span>
                <select value={colormap} onChange={e => setColormap(e.target.value)} className="bg-[#0a0f25] border border-[#ffffff10] rounded px-2 py-1 text-[#00d4ff] outline-none">
                  {["jet", "heat", "viridis", "plasma"].map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setPeakHold(!peakHold)} className={`px-3 py-1 rounded border transition-colors ${peakHold ? 'bg-[#00d4ff20] border-[#00d4ff] text-[#00d4ff]' : 'bg-[#ffffff05] border-[#ffffff10] text-[#8fa1c4]'}`}>
                  Peak Hold
                </button>
              </div>

            </div>
          </div>

          {/* 2 & 3. LIVE FFT OVERLAY + MAIN WATERFALL DISPLAY */}
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {/* Live FFT (Top 25% of view) */}
            <div className="shrink-0 h-[22%]" style={{
              background: "rgba(4,7,20,0.85)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 8, overflow: "hidden",
              boxShadow: "0 8px 30px rgba(0,0,0,0.5)"
            }}>
              <FFTChart />
            </div>

            {/* SDR Waterfall (Bottom 75% of view) */}
            <div className="flex-1">
              <Spectrogram 
                hideOverlays={true}
                dynRange={dynRange}
                persistence={persistence}
                overlap={overlap}
                fftSize={fftSize}
                colormap={colormap}
                onFpsUpdate={setFps}
                onDriftUpdate={setDrift}
                onOccupancyUpdate={setOccupancy}
              />
            </div>
          </div>

          {/* 4. BOTTOM METRICS PANEL */}
          <div className="flex justify-between items-center shrink-0" style={{
            background: "rgba(4,7,20,0.85)", backdropFilter: "blur(30px) saturate(1.4)",
            border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8, padding: "8px 20px",
            boxShadow: "0 4px 30px rgba(0,0,0,0.5)"
          }}>
            <div className="flex gap-8 font-[var(--font-rajdhani)] text-[12px] tracking-wide">
              
              <div className="flex items-center gap-2">
                <RefreshCcw size={13} className="text-[#00d4ff]" />
                <span className="text-[#8fa1c4]">Waterfall FPS:</span>
                <span className="text-[#00d4ff] font-semibold">{fps}</span>
              </div>

              <div className="flex items-center gap-2">
                <Activity size={13} className="text-[#f59e0b]" />
                <span className="text-[#8fa1c4]">Signal Drift:</span>
                <span className="text-[#f59e0b] font-semibold">{drift > 0 ? '+' : ''}{drift.toFixed(3)} Hz</span>
              </div>

              <div className="flex items-center gap-2">
                <Zap size={13} className="text-[#a855f7]" />
                <span className="text-[#8fa1c4]">Dominant Carrier:</span>
                <span className="text-[#a855f7] font-semibold">{data ? (data.dominantFreq || data.spectralCentroid).toFixed(2) : '--'} kHz</span>
              </div>

              <div className="flex items-center gap-2">
                <Radio size={13} className="text-[#22c55e]" />
                <span className="text-[#8fa1c4]">Occupancy:</span>
                <span className="text-[#22c55e] font-semibold">{occupancy.toFixed(1)}%</span>
              </div>

              <div className="flex items-center gap-2">
                <Activity size={13} className="text-[#cbd5e1]" />
                <span className="text-[#8fa1c4]">Noise Floor:</span>
                <span className="text-[#cbd5e1] font-semibold">{data ? data.noiseFloor.toFixed(1) : '-120.0'} dB</span>
              </div>
              
            </div>
            
            <div className="font-[var(--font-rajdhani)] text-[11px] text-[#4a5f82]">
              SDR Waterfall Engine v2.4 (Active)
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
