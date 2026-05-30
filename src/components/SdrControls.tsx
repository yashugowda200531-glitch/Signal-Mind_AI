"use client";

import { useState, useEffect } from "react";
import { Radio, Power, Settings2, Activity } from "lucide-react";
import { useSignal } from "@/context/SignalContext";
import { sdrClient } from "@/lib/sdrClient";

export default function SdrControls() {
  const { isLiveSdr, toggleLiveSDR } = useSignal();
  
  const [freqStr, setFreqStr] = useState("100.0");
  const [gainStr, setGainStr] = useState("30");
  const [device, setDevice] = useState("simulated");

  const [connectedState, setConnectedState] = useState(false);

  useEffect(() => {
    // Sync connection state
    const interval = setInterval(() => {
       setConnectedState(sdrClient.isConnected);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleApplyFreq = () => {
    const f = parseFloat(freqStr);
    if (!isNaN(f)) {
       sdrClient.setCenterFreq(f * 1e6); // Convert MHz to Hz
    }
  };

  const handleApplyGain = () => {
    const g = parseFloat(gainStr);
    if (!isNaN(g)) {
       sdrClient.setGain(g);
    }
  };

  return (
    <div style={{
      background: "rgba(4,7,20,0.85)",
      backdropFilter: "blur(30px) saturate(1.4)",
      border: "1px solid rgba(0,212,255,0.1)",
      borderRadius: 8,
      padding: "16px",
      boxShadow: "0 8px 30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02)",
      display: "flex",
      flexDirection: "column",
      gap: 12
    }}>
      <div className="flex items-center justify-between mb-2">
         <div className="flex items-center gap-2">
            <Radio style={{ width: 16, height: 16, color: "#a855f7" }} strokeWidth={2.5} />
            <h2 style={{
               fontFamily: "var(--font-orbitron)",
               fontSize: 13,
               fontWeight: 700,
               color: "#e2e8f0",
               letterSpacing: "0.05em",
               textTransform: "uppercase"
            }}>SDR Hardware</h2>
         </div>
         
         <button 
           onClick={toggleLiveSDR}
           className="flex items-center gap-1.5 px-3 py-1.5 rounded transition-all"
           style={{
              background: isLiveSdr ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
              border: `1px solid ${isLiveSdr ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
              color: isLiveSdr ? "#fca5a5" : "#86efac",
              fontFamily: "var(--font-rajdhani)",
              fontWeight: 600,
              fontSize: 11
           }}
         >
           <Power size={12} />
           {isLiveSdr ? "DISCONNECT" : "CONNECT LIVE"}
         </button>
      </div>

      {/* Device Status */}
      <div className="flex items-center justify-between bg-black/40 border border-white/5 p-2 rounded">
         <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-rajdhani uppercase">Connection</span>
            <div className="flex items-center gap-1.5">
               <div className={`w-1.5 h-1.5 rounded-full ${connectedState ? "bg-green-500 shadow-[0_0_5px_#22c55e]" : "bg-red-500 shadow-[0_0_5px_#ef4444]"}`} />
               <span className="text-xs font-mono text-slate-300">
                  {connectedState ? "LINK ACTIVE" : "OFFLINE"}
               </span>
            </div>
         </div>
         <select 
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono text-slate-300 outline-none"
            value={device}
            onChange={(e) => setDevice(e.target.value)}
            disabled={isLiveSdr}
         >
            <option value="simulated">Simulated RF</option>
            <option value="rtlsdr">RTL-SDR V3</option>
            <option value="hackrf">HackRF One</option>
         </select>
      </div>

      {/* Frequency Tuning */}
      <div className="flex flex-col gap-1">
         <span className="text-[10px] text-slate-500 font-rajdhani uppercase">Center Frequency (MHz)</span>
         <div className="flex gap-2">
            <input 
               type="text" 
               className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm font-mono text-cyan-400 outline-none focus:border-cyan-500/50"
               value={freqStr}
               onChange={(e) => setFreqStr(e.target.value)}
               disabled={!isLiveSdr}
            />
            <button 
               onClick={handleApplyFreq}
               disabled={!isLiveSdr}
               className="px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs font-bold text-slate-300 disabled:opacity-50"
            >
               TUNE
            </button>
         </div>
      </div>

      {/* Gain & Settings */}
      <div className="flex flex-col gap-1">
         <span className="text-[10px] text-slate-500 font-rajdhani uppercase">Hardware Gain (dB)</span>
         <div className="flex gap-2">
            <input 
               type="text" 
               className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1.5 text-sm font-mono text-purple-400 outline-none focus:border-purple-500/50"
               value={gainStr}
               onChange={(e) => setGainStr(e.target.value)}
               disabled={!isLiveSdr}
            />
            <button 
               onClick={handleApplyGain}
               disabled={!isLiveSdr}
               className="px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs font-bold text-slate-300 disabled:opacity-50"
            >
               SET
            </button>
         </div>
      </div>

    </div>
  );
}
