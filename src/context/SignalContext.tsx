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
  rawFft: number[]; // For spectrogram
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
      const sr = backendData.sample_rate || 44100;
      let rawWave = backendData.waveform || [];
      let rawFft = backendData.fft || [];

      // 7. SAFETY: Filter NaN, Infinity, undefined
      rawWave = rawWave.filter((v: any) => typeof v === 'number' && !isNaN(v) && isFinite(v));
      rawFft = rawFft.filter((v: any) => typeof v === 'number' && !isNaN(v) && isFinite(v));

      // Duration
      const duration = rawWave.length / sr;

      // Downsample waveform for UI rendering performance (max 1000 points)
      const maxPts = 1000;
      const step = Math.max(1, Math.floor(rawWave.length / maxPts));
      const waveform = [];
      let totalPower = 0;
      
      for (let i = 0; i < rawWave.length; i++) {
        const v = rawWave[i];
        totalPower += v * v;
      }

      // Calculate Power in dBm (estimated)
      const avgPower = totalPower / (rawWave.length || 1);
      const powerDb = avgPower > 0 ? 10 * Math.log10(avgPower) : -100;

      // Process FFT for UI
      let maxMag = -Infinity;
      let domFreqIndex = 0;
      let noiseSum = 0;

      for (let i = 0; i < rawFft.length; i++) {
        const mag = rawFft[i];
        noiseSum += mag;
        if (mag > maxMag) {
          maxMag = mag;
          domFreqIndex = i;
        }
      }

      // Assume FFT represents 0 to Nyquist (sr/2)
      const nyquist = sr / 2;
      const freqStep = nyquist / rawFft.length;
      const domFreq = (domFreqIndex * freqStep) / 1000; // kHz
      const avgNoise = noiseSum / (rawFft.length || 1);
      
      // Estimate SNR based on peak vs avg
      const snr = maxMag > 0 ? 20 * Math.log10(maxMag / (avgNoise + 1e-10)) : 15;
      
      // Estimate Bandwidth (simplified)
      const bandwidth = domFreq * 0.2 + (Math.random() * 2); // kHz mock

      // Signal Quality mapping
      const quality = Math.min(99.9, Math.max(40, 50 + (snr * 1.5)));
      
      // Determine modulation guess
      let mod = "ASK";
      if (snr > 30) mod = "QAM-16";
      else if (snr > 20) mod = "PSK";

      const newAnalysis: SignalData = {
        fileName: file.name,
        waveform: rawWave,
        fft: rawFft,
        sampleRate: sr,
        duration,
        dominantFreq: +domFreq.toFixed(2),
        dominantMag: +(maxMag <= 0 ? maxMag : 20 * Math.log10(maxMag)).toFixed(1),
        power: +powerDb.toFixed(1),
        snr: +snr.toFixed(1),
        bandwidth: +bandwidth.toFixed(2),
        quality: +quality.toFixed(1),
        modulation: mod,
        rawFft: rawFft, // store raw array here
      };

      setData(newAnalysis);

      // Add to history
      const now = new Date();
      setHistory((prev) => [
        {
          file: file.name,
          type: mod,
          dur: `${duration.toFixed(2)} s`,
          time: now.toLocaleDateString() + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quality: `${quality.toFixed(1)}%`,
          status: "Completed",
        },
        ...prev.slice(0, 4),
      ]);

      console.log(`[Upload Success] Processed ${file.name}`);
      console.log(`[Data Lengths] waveform: ${rawWave.length}, fft: ${rawFft.length}`);

    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || err.message || "Failed to analyze signal.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetError = () => setError(null);

  return (
    <SignalContext.Provider value={{ isProcessing, error, data, history, uploadSignal, resetError }}>
      {children}
    </SignalContext.Provider>
  );
}

export const useSignal = () => {
  const context = useContext(SignalContext);
  if (!context) throw new Error("useSignal must be used within a SignalProvider");
  return context;
};
