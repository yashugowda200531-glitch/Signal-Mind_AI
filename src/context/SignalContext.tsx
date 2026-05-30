"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import axios from "axios";
import { generateLiveFrame, resetIqEngine, initDsp, type IQPoint, type ModulationMetrics } from "@/lib/iqEngine";
import { analyzeSignal } from "@/lib/dsp";

export interface HistoryItem {
  file: string;
  type: string;
  dur: string;
  time: string;
  quality: string;
  status: string;
}

export interface PeakInfo {
  index: number;
  freq: number;
  mag: number;
  prominence: number;
  type: string;
}

export interface SignalData {
  fileName: string;
  waveform: number[];
  fft: number[];
  sampleRate: number;
  duration: number;
  dominantFreq: number;
  dominantMag: number;
  power: number;
  snr: number;
  bandwidth: number;
  quality: number;
  modulation: string;
  confidence: number;
  signalType: string;
  spectralFlatness: number;
  dataRate: number;
  peakCount: number;
  voiceConfidence: number;
  rawFft: number[];
  peaks: PeakInfo[];
  spectralCentroid: number;
  fundamentalFreq: number;
  rmsPower: number;
  spectralEntropy: number;
  zeroCrossingRate: number;
  spectralRolloff: number;
  crestFactor: number;
  noiseFloor: number;
  spectrogram: number[][];
  iqConstellation: IQPoint[];
  modMetrics: ModulationMetrics;
}

interface SignalContextProps {
  isProcessing: boolean;
  error: string | null;
  data: SignalData | null;
  history: HistoryItem[];
  uploadSignal: (file: File) => Promise<void>;
  resetError: () => void;
}

const SignalContext = createContext<SignalContextProps | undefined>(undefined);

export function SignalProvider({ children }: { children: ReactNode }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SignalData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const uploadSignal = async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post("http://127.0.0.1:8000/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const backendData = res.data;
      const sr = backendData.sampleRate || 44100;
      let rawWave: number[] = backendData.waveform || [];
      let rawFft: number[] = backendData.fft || [];

      // Safety: filter NaN, Infinity, undefined
      rawWave = rawWave.filter(
        (v: any) => typeof v === "number" && !isNaN(v) && isFinite(v)
      );
      rawFft = rawFft.filter(
        (v: any) => typeof v === "number" && !isNaN(v) && isFinite(v)
      );

      // ── Metrics from Backend (Only use for things we can't compute on frontend) ──
      const duration = backendData.duration || (rawWave.length / sr);
      const peakCount = backendData.peakCount || 0;
      const peaks: PeakInfo[] = backendData.peaks || [];
      const signalType = backendData.signalType || "Unclassified";
      const voiceConfidence = backendData.voiceConfidence || 0;
      const fundamentalFreq = backendData.fundamentalFreq || 0;
      const spectrogram = backendData.spectrogram || [];

      // ── Real Frontend DSP Analysis ──
      const f32Wave = new Float32Array(rawWave);
      const realFftMetrics = analyzeSignal(f32Wave, sr);
      
      const domFreq = realFftMetrics.peakFrequency;
      const snr = realFftMetrics.snrDb;
      const powerDb = realFftMetrics.signalPowerDb;
      const maxMag = realFftMetrics.peakMagnitude;

      initDsp(rawWave, sr, domFreq, snr);
      const iqFrame = generateLiveFrame("Unknown", snr);

      // Derived quality out of 100 based on EVM
      let quality = 100 - (iqFrame.metrics.evm * 0.8);
      quality = Math.max(0, Math.min(100, quality));

      const newAnalysis: SignalData = {
        fileName: file.name,
        waveform: rawWave,
        fft: rawFft,
        sampleRate: sr,
        duration,
        dominantFreq: +domFreq.toFixed(2),
        dominantMag: +maxMag.toFixed(1),
        power: +powerDb.toFixed(1),
        snr: +snr.toFixed(1),
        bandwidth: +realFftMetrics.occupiedBandwidth.toFixed(2),
        quality: +quality.toFixed(1),
        modulation: iqFrame.metrics.type,
        confidence: +iqFrame.metrics.confidence.toFixed(1),
        signalType,
        spectralFlatness: +realFftMetrics.spectralFlatness.toFixed(4),
        dataRate: +iqFrame.metrics.baudRate.toFixed(1),
        peakCount,
        voiceConfidence: +voiceConfidence.toFixed(1),
        rawFft: rawFft,
        peaks,
        spectralCentroid: +realFftMetrics.spectralCentroid.toFixed(2),
        fundamentalFreq: +fundamentalFreq.toFixed(2),
        rmsPower: +realFftMetrics.rms.toFixed(1),
        spectralEntropy: +realFftMetrics.spectralEntropy.toFixed(4),
        zeroCrossingRate: +realFftMetrics.zcr.toFixed(4),
        spectralRolloff: +realFftMetrics.spectralRolloff.toFixed(2),
        crestFactor: +realFftMetrics.crestFactor.toFixed(2),
        noiseFloor: +realFftMetrics.noiseFloor.toFixed(1),
        spectrogram,
        iqConstellation: iqFrame.points,
        modMetrics: iqFrame.metrics,
      };

      setData(newAnalysis);

      // Add to history
      const now = new Date();
      setHistory((prev) => [
        {
          file: file.name,
          type: iqFrame.metrics.type,
          dur: `${duration.toFixed(2)} s`,
          time:
            now.toLocaleDateString() +
            " " +
            now.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          quality: `${quality.toFixed(1)}%`,
          status: "Completed",
        },
        ...prev.slice(0, 4),
      ]);
    } catch (err: any) {
      console.error("[SignalMind] Upload error:", err?.message);
      setError(
        err?.response?.data?.detail ||
          err.message ||
          "Failed to analyze signal."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const resetError = () => setError(null);

  return (
    <SignalContext.Provider
      value={{ isProcessing, error, data, history, uploadSignal, resetError }}
    >
      {children}
    </SignalContext.Provider>
  );
}

export const useSignal = () => {
  const context = useContext(SignalContext);
  if (!context)
    throw new Error("useSignal must be used within a SignalProvider");
  return context;
};
