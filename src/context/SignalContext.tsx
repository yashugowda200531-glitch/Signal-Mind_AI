"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import axios from "axios";

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

      // ── Metrics from Backend ──
      const duration = backendData.duration || (rawWave.length / sr);
      const powerDb = backendData.signalPower || -100;
      const snr = backendData.snr || 0;
      const domFreq = backendData.dominantFreq || 0;
      const maxMag = backendData.dominantMagnitude || 0;
      const bandwidth = backendData.bandwidth || 0;
      const spectralFlatness = backendData.spectralFlatness || 0;
      const peakCount = backendData.peakCount || 0;
      const peaks: PeakInfo[] = backendData.peaks || [];
      const modulation = backendData.modulationType || "Unknown";
      const signalType = backendData.signalType || "Unclassified";
      const confidence = backendData.confidence || 0;
      const voiceConfidence = backendData.voiceConfidence || 0;

      // ── Signal Quality: from Backend ──
      const quality = backendData.signalQuality || 0;

      // ── Data Rate estimate: Shannon-Hartley C = BW * log2(1 + SNR_linear) ──
      const snrLinear = Math.pow(10, snr / 10);
      const dataRate = bandwidth > 0 ? bandwidth * Math.log2(1 + snrLinear) : 0; // kbps approx

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
        bandwidth: +bandwidth.toFixed(2),
        quality: +quality.toFixed(1),
        modulation,
        confidence: +confidence.toFixed(1),
        signalType,
        spectralFlatness: +spectralFlatness.toFixed(4),
        dataRate: +dataRate.toFixed(1),
        peakCount,
        voiceConfidence: +voiceConfidence.toFixed(1),
        rawFft: rawFft,
        peaks,
      };

      setData(newAnalysis);

      // Add to history
      const now = new Date();
      setHistory((prev) => [
        {
          file: file.name,
          type: modulation,
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
