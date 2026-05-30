"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
// @ts-ignore
import { fft } from "fft-js";
import { analyzeSignal } from "../lib/dsp";
import { classifyConstellation, IQPoint } from "../lib/iqEngine";
import { generateSignalIntelligence, AIAnalysisResult } from "../lib/aiClassifier";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SdrState {
  isConnected: boolean;
  isStreaming: boolean;
  deviceType: string;
  centerFreq: number;
  sampleRate: number;
  rfGain: number;
  ifGain: number;
  agcEnabled: boolean;
  bandwidth: number;
  freqStep: number;
  squelch: number;
  fps: number;
  noiseFloor: number;
  peakFreq: number;
  peakPower: number;
  aiAnalysis: AIAnalysisResult | null;
}

export interface SdrActions {
  connect: (deviceType?: string) => Promise<void>;
  disconnect: () => void;
  startStream: () => void;
  stopStream: () => void;
  setCenterFreq: (hz: number) => void;
  setSampleRate: (hz: number) => void;
  setRfGain: (db: number) => void;
  setIfGain: (db: number) => void;
  setAgc: (enabled: boolean) => void;
  setBandwidth: (hz: number) => void;
  setFreqStep: (hz: number) => void;
  setSquelch: (db: number) => void;
}

export interface SdrDataRefs {
  fftRef: React.MutableRefObject<Float32Array | null>;
  iqRef: React.MutableRefObject<Float32Array | null>;
}

type SdrContextType = SdrState & SdrActions & SdrDataRefs;

const SdrContext = createContext<SdrContextType | undefined>(undefined);

const SDR_WS_URL = "ws://localhost:8001/ws/sdr";

export function SdrProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SdrState>({
    isConnected: false,
    isStreaming: false,
    deviceType: "simulated",
    centerFreq: 100e6,
    sampleRate: 2.4e6,
    rfGain: 30,
    ifGain: 20,
    agcEnabled: false,
    bandwidth: 2.4e6,
    freqStep: 100e3,
    squelch: -80,
    fps: 0,
    noiseFloor: -100,
    peakFreq: 0,
    peakPower: -100,
    aiAnalysis: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const fftRef = useRef<Float32Array | null>(null);
  const iqRef = useRef<Float32Array | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());

  const sendCmd = useCallback((cmd: string, value?: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const msg: any = { cmd };
      if (value !== undefined) msg.value = value;
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const processFrame = useCallback((data: ArrayBuffer) => {
    const iq = new Float32Array(data);
    iqRef.current = iq;
    frameCountRef.current++;

    const N = iq.length / 2;
    // Build complex input for fft-js
    const complexInput: [number, number][] = new Array(N);
    for (let i = 0; i < N; i++) {
      complexInput[i] = [iq[i * 2], iq[i * 2 + 1]];
    }

    try {
      const phasors = fft(complexInput);
      const magnitudes = new Float32Array(N);

      // FFT shift (move DC to center)
      for (let i = 0; i < N; i++) {
        const idx = (i + N / 2) % N;
        const re = phasors[i][0];
        const im = phasors[i][1];
        magnitudes[idx] = 20 * Math.log10(Math.sqrt(re * re + im * im) + 1e-12);
      }
      fftRef.current = magnitudes;

      // Update UI metrics at ~10Hz
      const now = performance.now();
      if (now - lastFpsTimeRef.current > 100) {
        const elapsed = (now - lastFpsTimeRef.current) / 1000;
        const fps = Math.round(frameCountRef.current / elapsed);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;

        const sorted = [...magnitudes].sort((a, b) => a - b);
        const noiseFloor = sorted[Math.floor(sorted.length * 0.1)] || -100;

        let peakPower = -Infinity;
        let peakIdx = 0;
        for (let i = 0; i < magnitudes.length; i++) {
          if (magnitudes[i] > peakPower) {
            peakPower = magnitudes[i];
            peakIdx = i;
          }
        }
        
        let newAiAnalysis: AIAnalysisResult | null = null;
        
        // Generate AI Analysis ~1Hz
        if (now - (window as any)._lastAiTime > 1000 || !(window as any)._lastAiTime) {
           (window as any)._lastAiTime = now;
           // We do a proper FFT analysis on the raw I channel for AI
           const iChannel = new Float32Array(N);
           for(let i=0; i<N; i++) iChannel[i] = iq[i*2];
           const fftMetrics = analyzeSignal(iChannel, state.sampleRate);
           
           // Create IQ points
           const points: IQPoint[] = [];
           for(let i=0; i<N; i+=4) points.push({i: iq[i*2], q: iq[i*2+1]});
           
           const iqMetrics = classifyConstellation(points, state.sampleRate, fftMetrics.snrDb);
           newAiAnalysis = generateSignalIntelligence(fftMetrics, iqMetrics, 1000);
        }

        setState(prev => ({
          ...prev,
          fps,
          noiseFloor: +noiseFloor.toFixed(1),
          peakPower: +peakPower.toFixed(1),
          peakFreq: prev.centerFreq + ((peakIdx - N / 2) / N) * prev.sampleRate,
          ...(newAiAnalysis ? { aiAnalysis: newAiAnalysis } : {})
        }));
      }
    } catch {
      // FFT requires power-of-2 length
    }
  }, []);

  const connect = useCallback(async (deviceType: string = "simulated") => {
    try {
      await fetch("http://localhost:8001/sdr/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_type: deviceType }),
      });
    } catch { /* server not running */ }

    const ws = new WebSocket(SDR_WS_URL);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => setState(prev => ({ ...prev, isConnected: true, deviceType }));
    ws.onmessage = (event) => { if (event.data instanceof ArrayBuffer) processFrame(event.data); };
    ws.onclose = () => setState(prev => ({ ...prev, isConnected: false, isStreaming: false }));
    ws.onerror = () => setState(prev => ({ ...prev, isConnected: false, isStreaming: false }));
    wsRef.current = ws;
  }, [processFrame]);

  const disconnect = useCallback(() => { sendCmd("stop"); wsRef.current?.close(); wsRef.current = null; setState(prev => ({ ...prev, isConnected: false, isStreaming: false })); }, [sendCmd]);
  const startStream = useCallback(() => { sendCmd("start"); setState(prev => ({ ...prev, isStreaming: true })); }, [sendCmd]);
  const stopStream = useCallback(() => { sendCmd("stop"); setState(prev => ({ ...prev, isStreaming: false })); }, [sendCmd]);
  const setCenterFreq = useCallback((hz: number) => { sendCmd("set_freq", hz); setState(prev => ({ ...prev, centerFreq: hz })); }, [sendCmd]);
  const setSampleRate = useCallback((hz: number) => { sendCmd("set_sample_rate", hz); setState(prev => ({ ...prev, sampleRate: hz, bandwidth: hz })); }, [sendCmd]);
  const setRfGain = useCallback((db: number) => { sendCmd("set_gain", db); setState(prev => ({ ...prev, rfGain: db })); }, [sendCmd]);
  const setIfGain = useCallback((db: number) => { setState(prev => ({ ...prev, ifGain: db })); }, []);
  const setAgc = useCallback((enabled: boolean) => { sendCmd("set_agc", enabled); setState(prev => ({ ...prev, agcEnabled: enabled })); }, [sendCmd]);
  const setBandwidth = useCallback((hz: number) => { setState(prev => ({ ...prev, bandwidth: hz })); }, []);
  const setFreqStep = useCallback((hz: number) => { setState(prev => ({ ...prev, freqStep: hz })); }, []);
  const setSquelch = useCallback((db: number) => { sendCmd("set_squelch", db); setState(prev => ({ ...prev, squelch: db })); }, [sendCmd]);

  useEffect(() => { return () => { wsRef.current?.close(); }; }, []);

  return <SdrContext.Provider value={{ ...state, connect, disconnect, startStream, stopStream, setCenterFreq, setSampleRate, setRfGain, setIfGain, setAgc, setBandwidth, setFreqStep, setSquelch, fftRef, iqRef }}>{children}</SdrContext.Provider>;
}

export const useSdr = () => { const ctx = useContext(SdrContext); if (!ctx) throw new Error("useSdr must be used within SdrProvider"); return ctx; };
