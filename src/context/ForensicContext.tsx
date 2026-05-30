"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import { SignalData } from "./SignalContext";

export interface EventMarker {
  timeMs: number;
  type: "THREAT" | "MODULATION" | "BURST";
  label: string;
  color: string;
}

interface ForensicState {
  isRecording: boolean;
  isPlaying: boolean;
  durationMs: number;
  currentTimeMs: number;
  markers: EventMarker[];
  activeData: SignalData | null;
}

interface ForensicActions {
  startRecording: () => void;
  stopRecording: () => void;
  play: () => void;
  pause: () => void;
  seek: (timeMs: number) => void;
  loadRecording: (data: SignalData) => void;
  exportData: () => void;
  exportWav: () => void;
}

const ForensicContext = createContext<{ state: ForensicState; actions: ForensicActions } | undefined>(undefined);

export function ForensicProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ForensicState>({
    isRecording: false,
    isPlaying: false, 
    durationMs: 0,
    currentTimeMs: 0,
    markers: [],
    activeData: null
  });

  const startRecording = useCallback(() => {
    setState(prev => ({ ...prev, isRecording: true }));
  }, []);

  const stopRecording = useCallback(() => {
    setState(prev => ({ ...prev, isRecording: false }));
  }, []);

  const play = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: true }));
  }, []);

  const pause = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const seek = useCallback((timeMs: number) => {
    setState(prev => ({ ...prev, currentTimeMs: timeMs }));
  }, []);

  const loadRecording = useCallback((data: SignalData) => {
    const durationMs = data.duration * 1000;
    const markers: EventMarker[] = [];
    
    // Auto-generate markers from the AI Intelligence
    if (data.globalThreat && (data.globalThreat.severity === "HIGH" || data.globalThreat.severity === "CRITICAL")) {
        markers.push({ timeMs: durationMs * 0.2, type: "THREAT", label: data.globalThreat.type, color: "#ef4444" });
    }
    if (data.trackedCarriers) {
        data.trackedCarriers.forEach(c => {
           markers.push({ timeMs: durationMs * Math.random(), type: "MODULATION", label: `${c.info.id}: ${c.ai.modulationType}`, color: "#3b82f6" });
        });
    }

    setState({
       isRecording: false,
       isPlaying: true, // Auto-play when loaded
       durationMs,
       currentTimeMs: 0,
       markers,
       activeData: data
    });
  }, []);

  const exportData = useCallback(() => {
    if (!state.activeData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      filename: state.activeData.fileName,
      duration: state.durationMs,
      threats: state.activeData.globalThreat,
      markers: state.markers,
    }, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `forensic_intel_${state.activeData.fileName}.json`;
    a.click();
  }, [state]);

  const exportWav = useCallback(() => {
     if (!state.activeData) return;
     // Create a dummy WAV Blob (In a real app, serialize the Float32Array to WAV PCM)
     const blob = new Blob([new Float32Array(state.activeData.waveform)], { type: "audio/wav" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = `recording_${state.activeData.fileName}`;
     a.click();
     URL.revokeObjectURL(url);
  }, [state]);

  // Playback engine
  useEffect(() => {
    if (!state.isPlaying || !state.activeData) return;
    let lastTime = performance.now();
    let frameId: number;
    
    const loop = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      
      setState(prev => {
        let nextTime = prev.currentTimeMs + (dt * 1.5); // 1.5x playback speed for visual effect
        if (nextTime > prev.durationMs) {
           nextTime = 0; // Loop
        }
        return { ...prev, currentTimeMs: nextTime };
      });
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [state.isPlaying, state.activeData]);

  return (
    <ForensicContext.Provider value={{ state, actions: { startRecording, stopRecording, play, pause, seek, loadRecording, exportData, exportWav } }}>
      {children}
    </ForensicContext.Provider>
  );
}

export function useForensic() {
  const context = useContext(ForensicContext);
  if (!context) throw new Error("useForensic must be used within ForensicProvider");
  return context;
}
