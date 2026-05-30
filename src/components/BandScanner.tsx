"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RadioReceiver, Activity, Radar, Plane, Ship, Satellite, Mic } from "lucide-react";

interface BandPreset {
  id: string;
  name: string;
  freq: string;
  type: string;
  color: string;
  icon: any;
  sim: {
    channels: [number, number];
    occ: [number, number];
    carrierTypes: string[];
    idPrefix: string;
  }
}

const BANDS: BandPreset[] = [
  { id: "adsb", name: "ADS-B", freq: "1090 MHz", type: "Telemetry", color: "#3b82f6", icon: Plane, sim: { channels: [4, 12], occ: [15, 30], carrierTypes: ["PPM", "Mode S"], idPrefix: "ICAO-" } },
  { id: "airband", name: "Airband", freq: "118-137 MHz", type: "Voice AM", color: "#00d4ff", icon: Mic, sim: { channels: [1, 5], occ: [5, 15], carrierTypes: ["AM Voice"], idPrefix: "ATC-" } },
  { id: "ais", name: "AIS", freq: "161-162 MHz", type: "Telemetry", color: "#22c55e", icon: Ship, sim: { channels: [2, 8], occ: [10, 25], carrierTypes: ["GMSK", "FSK"], idPrefix: "MMSI-" } },
  { id: "noaa", name: "NOAA APT", freq: "137 MHz", type: "Satellite", color: "#f59e0b", icon: Satellite, sim: { channels: [1, 2], occ: [80, 100], carrierTypes: ["FM-APT"], idPrefix: "NOAA-" } },
  { id: "amateur", name: "2m Ham", freq: "144-148 MHz", type: "Voice FM", color: "#a855f7", icon: RadioReceiver, sim: { channels: [1, 6], occ: [2, 10], carrierTypes: ["NFM", "D-STAR"], idPrefix: "CALL-" } }
];

export default function BandScanner() {
  const [activeBand, setActiveBand] = useState<BandPreset | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  
  // Simulated intelligence
  const [channels, setChannels] = useState(0);
  const [occupancy, setOccupancy] = useState(0);
  const [activitySpark, setActivitySpark] = useState<number[]>(Array(20).fill(0));
  const [carriers, setCarriers] = useState<any[]>([]);

  useEffect(() => {
    if (!activeBand || isScanning) return;
    
    // Simulate live telemetry
    const interval = setInterval(() => {
      setActivitySpark(prev => {
         const newSpark = [...prev.slice(1), Math.random() * 100];
         return newSpark;
      });

      // Randomly spawn/despawn carriers
      setCarriers(prev => {
         const updated = prev.map(c => ({
            ...c, 
            power: c.power + (Math.random() - 0.5) * 5,
            age: c.age + 1
         })).filter(c => c.age < 15 + Math.random() * 20); // They disappear eventually
         
         // Spawn new
         if (Math.random() > 0.6 && updated.length < activeBand.sim.channels[1]) {
            const freqBase = parseFloat(activeBand.freq) || 100;
            const freq = (freqBase + (Math.random() - 0.5) * 2).toFixed(3);
            updated.push({
               id: `${activeBand.sim.idPrefix}${Math.floor(Math.random() * 999999).toString(16).toUpperCase()}`,
               freq: `${freq} MHz`,
               power: -100 + Math.random() * 60,
               type: activeBand.sim.carrierTypes[Math.floor(Math.random() * activeBand.sim.carrierTypes.length)],
               age: 0
            });
         }
         
         setChannels(updated.length);
         // Simulate occupancy based on active channels + noise
         setOccupancy(
            (updated.length / activeBand.sim.channels[1]) * activeBand.sim.occ[1] * 0.8 + 
            (Math.random() * 10)
         );
         
         return updated;
      });

    }, 500); // 500ms radar sweep

    return () => clearInterval(interval);
  }, [activeBand, isScanning]);

  const selectBand = (band: BandPreset) => {
    setActiveBand(band);
    setIsScanning(true);
    setCarriers([]);
    setChannels(0);
    setOccupancy(0);
    setActivitySpark(Array(20).fill(0));
    
    // Simulate lock-on delay
    setTimeout(() => {
       setIsScanning(false);
    }, 1500);
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
      gap: 16
    }}>
      
      {/* HEADER & PRESETS */}
      <div>
         <div className="flex items-center gap-2 mb-3">
            <Radar style={{ width: 16, height: 16, color: "#00d4ff" }} strokeWidth={2.5} />
            <h2 style={{
               fontFamily: "var(--font-orbitron)",
               fontSize: 13,
               fontWeight: 700,
               color: "#e2e8f0",
               letterSpacing: "0.05em",
               textTransform: "uppercase"
            }}>Targeted Band Scanner</h2>
         </div>
         
         <div className="flex flex-wrap gap-2">
            {BANDS.map(b => {
               const isActive = activeBand?.id === b.id;
               const Icon = b.icon;
               return (
                  <button
                     key={b.id}
                     onClick={() => selectBand(b)}
                     style={{
                        display: "flex", alignItems: "center", gap: 6,
                        background: isActive ? `rgba(${hexToRgb(b.color)}, 0.2)` : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isActive ? b.color : "rgba(255,255,255,0.1)"}`,
                        color: isActive ? "#fff" : "#94a3b8",
                        padding: "6px 10px",
                        borderRadius: 6,
                        fontFamily: "var(--font-rajdhani)",
                        fontSize: 12,
                        fontWeight: 600,
                        transition: "all 0.2s"
                     }}
                     className={isActive ? "shadow-lg" : "hover:bg-white/5"}
                  >
                     <Icon size={12} color={isActive ? b.color : "#94a3b8"} />
                     {b.name}
                  </button>
               )
            })}
         </div>
      </div>

      {/* TACTICAL READOUT */}
      <div style={{
         background: "#02040a",
         border: "1px solid rgba(255,255,255,0.05)",
         borderRadius: 6,
         padding: 12,
         minHeight: 180,
         display: "flex",
         flexDirection: "column"
      }}>
         {!activeBand ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 font-mono text-xs text-center opacity-60">
               <Radar size={24} className="mb-2" />
               AWAITING BAND SELECTION
            </div>
         ) : isScanning ? (
            <div className="flex-1 flex flex-col items-center justify-center text-cyan-400 font-mono text-xs animate-pulse">
               <Activity size={24} className="mb-2" />
               TUNING SDR TO {activeBand.freq}...
            </div>
         ) : (
            <AnimatePresence>
               <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col h-full gap-4"
               >
                  {/* Top Stats */}
                  <div className="grid grid-cols-3 gap-4 border-b border-white/5 pb-3">
                     <div>
                        <div className="text-[10px] text-slate-500 font-rajdhani uppercase">Tuned Freq</div>
                        <div className="text-sm font-bold text-white font-orbitron" style={{ color: activeBand.color }}>{activeBand.freq}</div>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">{activeBand.type}</div>
                     </div>
                     <div>
                        <div className="text-[10px] text-slate-500 font-rajdhani uppercase">Active Channels</div>
                        <div className="text-sm font-bold text-white font-orbitron">{channels}</div>
                     </div>
                     <div>
                        <div className="text-[10px] text-slate-500 font-rajdhani uppercase">Occupancy</div>
                        <div className="text-sm font-bold text-white font-orbitron">{occupancy.toFixed(1)}%</div>
                     </div>
                  </div>

                  {/* Sparkline & Carrier List */}
                  <div className="flex gap-4 flex-1 overflow-hidden">
                     
                     <div className="flex-1 overflow-y-auto pr-2" style={{ scrollbarWidth: "thin" }}>
                        <div className="text-[10px] text-slate-500 font-rajdhani uppercase mb-2">Intercepted Carriers</div>
                        <div className="flex flex-col gap-1">
                           {carriers.length === 0 ? (
                              <div className="text-xs text-slate-600 font-mono italic">No carriers detected...</div>
                           ) : (
                              carriers.map(c => (
                                 <motion.div 
                                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                    key={c.id}
                                    className="flex items-center justify-between p-1.5 rounded bg-white/5 border border-white/5"
                                 >
                                    <div className="flex items-center gap-2">
                                       <div className="w-1.5 h-1.5 rounded-full" style={{ background: activeBand.color, boxShadow: `0 0 5px ${activeBand.color}` }} />
                                       <span className="font-mono text-[10px] text-slate-200">{c.id}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                       <span className="font-mono text-[9px] text-cyan-400">{c.freq}</span>
                                       <span className="font-mono text-[9px] text-slate-400 w-12 text-right">{c.power.toFixed(0)} dBm</span>
                                       <span className="font-mono text-[9px] text-slate-500 w-12 text-right">{c.type}</span>
                                    </div>
                                 </motion.div>
                              ))
                           )}
                        </div>
                     </div>

                     <div className="w-24 border-l border-white/5 pl-4 flex flex-col justify-end">
                         <div className="text-[10px] text-slate-500 font-rajdhani uppercase mb-2 text-right">Activity</div>
                         <div className="h-16 flex items-end gap-[1px]">
                            {activitySpark.map((val, i) => (
                               <div key={i} className="flex-1 bg-cyan-500/50 rounded-t-sm transition-all duration-300" style={{ height: `${val}%`, background: activeBand.color }} />
                            ))}
                         </div>
                     </div>
                  </div>
               </motion.div>
            </AnimatePresence>
         )}
      </div>
    </div>
  );
}

// Helper
function hexToRgb(hex: string) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "0,0,0";
}
