"use client";

import { useForensic } from "@/context/ForensicContext";
import { Play, Pause, Square, Circle, Download, FastForward, Rewind } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

export default function ForensicPlayer() {
  const { state, actions } = useForensic();
  const timelineRef = useRef<HTMLDivElement>(null);

  // Auto-hide when empty and not recording
  if (state.durationMs === 0 && !state.isRecording && state.markers.length === 0) {
     // Return a mini record button if empty
     return (
       <div className="fixed bottom-4 right-4 z-50">
          <button 
             onClick={actions.startRecording}
             className="flex items-center gap-2 px-3 py-2 rounded-md font-semibold text-xs text-white shadow-lg"
             style={{
                background: "rgba(220, 38, 38, 0.2)",
                border: "1px solid rgba(220, 38, 38, 0.4)",
                fontFamily: "var(--font-rajdhani)",
             }}
          >
             <Circle fill="#ef4444" color="#ef4444" size={12} />
             INIT FORENSIC RECORD
          </button>
       </div>
     );
  }

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    actions.seek(pct * state.durationMs);
  };

  const progressPct = state.durationMs > 0 ? (state.currentTimeMs / state.durationMs) * 100 : 0;

  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col"
      style={{
         background: "rgba(4, 7, 20, 0.95)",
         backdropFilter: "blur(20px)",
         borderTop: "1px solid rgba(255,255,255,0.08)",
         fontFamily: "var(--font-rajdhani)",
      }}
    >
       {/* TIMELINE */}
       <div 
         ref={timelineRef}
         onClick={handleTimelineClick}
         className="w-full h-8 relative cursor-pointer group"
         style={{ background: "rgba(0,0,0,0.5)" }}
       >
          {/* Progress Bar */}
          <div 
             className="absolute top-0 bottom-0 left-0"
             style={{
                width: `${progressPct}%`,
                background: "rgba(0, 212, 255, 0.2)",
                borderRight: "2px solid #00d4ff"
             }}
          />

          {/* Markers */}
          {state.markers.map((m, i) => {
             const leftPct = (m.timeMs / state.durationMs) * 100;
             return (
               <div key={i} className="absolute top-0 bottom-0 flex flex-col items-center group-hover:z-10" style={{ left: `${leftPct}%` }}>
                  <div style={{ width: 2, height: "100%", background: m.color }} />
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black px-2 py-1 rounded text-xs whitespace-nowrap" style={{ color: m.color, border: `1px solid ${m.color}` }}>
                     [{m.type}] {m.label} ({(m.timeMs/1000).toFixed(1)}s)
                  </div>
               </div>
             )
          })}
       </div>

       {/* CONTROLS */}
       <div className="flex items-center justify-between px-6 py-2">
          
          <div className="flex items-center gap-4">
             {state.isRecording ? (
                <button onClick={actions.stopRecording} className="flex items-center gap-1 text-red-500 hover:text-red-400">
                   <Square fill="currentColor" size={16} /> <span className="font-bold text-xs mt-0.5">STOP RECORDING</span>
                </button>
             ) : (
                <>
                   <button onClick={actions.startRecording} className="flex items-center gap-1 text-red-500 hover:text-red-400 opacity-60 hover:opacity-100">
                      <Circle fill="currentColor" size={14} />
                   </button>
                   <div className="h-4 w-px bg-white/10" />
                   
                   <button className="text-slate-400 hover:text-white" onClick={() => actions.seek(Math.max(0, state.currentTimeMs - 5000))}>
                      <Rewind size={16} />
                   </button>
                   
                   {state.isPlaying ? (
                     <button className="text-cyan-400 hover:text-cyan-300" onClick={actions.pause}>
                        <Pause size={20} fill="currentColor" />
                     </button>
                   ) : (
                     <button className="text-cyan-400 hover:text-cyan-300" onClick={actions.play}>
                        <Play size={20} fill="currentColor" />
                     </button>
                   )}

                   <button className="text-slate-400 hover:text-white" onClick={() => actions.seek(Math.min(state.durationMs, state.currentTimeMs + 5000))}>
                      <FastForward size={16} />
                   </button>
                </>
             )}
          </div>

          {/* Time display */}
          <div className="text-slate-300 text-sm font-semibold tracking-wider font-mono">
             {(state.currentTimeMs / 1000).toFixed(2)}s / {(state.durationMs / 1000).toFixed(2)}s
          </div>

          <div className="flex items-center gap-3">
             <div className="text-xs text-slate-500 font-medium tracking-widest uppercase">
                RF Forensic Memory Eng.
             </div>
             <button onClick={actions.exportData} className="flex items-center gap-1 text-slate-300 hover:text-white text-xs px-2 py-1 rounded bg-white/5 border border-white/10 transition-colors">
                <Download size={12} /> EXPORT INTEL
             </button>
          </div>
       </div>

    </motion.div>
  );
}
