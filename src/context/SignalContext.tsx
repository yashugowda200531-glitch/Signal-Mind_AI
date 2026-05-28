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
  confidence: number;
  signalType: string;
  spectralFlatness: number;
  dataRate: number;
  rawFft: number[];
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

// ─── DSP helper: compute -10 dB occupied bandwidth ────────────────────────
function computeBandwidth(
  fftMags: number[],
  peakMag: number,
  freqStep: number
): number {
  const threshold = peakMag * 0.1; // -10 dB = 10% of peak power (voltage), or peakMag * 10^(-10/20)
  // Actually -10 dB in magnitude (not power) = peakMag * 10^(-10/20) ≈ peakMag * 0.316
  const thresholdDb10 = peakMag * 0.316;
  let loIdx = 0;
  let hiIdx = fftMags.length - 1;

  // Find the lowest frequency bin above threshold
  for (let i = 0; i < fftMags.length; i++) {
    if (fftMags[i] >= thresholdDb10) {
      loIdx = i;
      break;
    }
  }
  // Find the highest frequency bin above threshold
  for (let i = fftMags.length - 1; i >= 0; i--) {
    if (fftMags[i] >= thresholdDb10) {
      hiIdx = i;
      break;
    }
  }

  const bwHz = (hiIdx - loIdx) * freqStep;
  return Math.max(0, bwHz / 1000); // return in kHz
}

// ─── DSP helper: spectral flatness (Wiener entropy) ───────────────────────
function computeSpectralFlatness(fftMags: number[]): number {
  if (!fftMags.length) return 0;
  let logSum = 0;
  let linSum = 0;
  let count = 0;
  for (let i = 0; i < fftMags.length; i++) {
    const v = Math.max(fftMags[i], 1e-12);
    logSum += Math.log(v);
    linSum += v;
    count++;
  }
  if (count === 0 || linSum === 0) return 0;
  const geometricMean = Math.exp(logSum / count);
  const arithmeticMean = linSum / count;
  return Math.min(1, geometricMean / arithmeticMean);
}

// ─── DSP helper: count significant peaks ──────────────────────────────────
function countPeaks(fftMags: number[], peakMag: number): number {
  const threshold = peakMag * 0.1; // -20 dB relative to peak
  let peakCount = 0;
  let inPeak = false;

  for (let i = 1; i < fftMags.length - 1; i++) {
    if (fftMags[i] >= threshold) {
      if (
        !inPeak &&
        fftMags[i] >= fftMags[i - 1] &&
        fftMags[i] >= fftMags[i + 1]
      ) {
        peakCount++;
        inPeak = true;
      }
    } else {
      inPeak = false;
    }
  }
  return peakCount;
}

// ─── DSP helper: modulation + signal type heuristic ───────────────────────
function classifySignal(
  fftMags: number[],
  peakMag: number,
  spectralFlatness: number,
  peakCount: number,
  bwKHz: number
): { modulation: string; confidence: number; signalType: string } {
  // Narrow single spike → Tone
  if (peakCount <= 2 && bwKHz < 0.5 && spectralFlatness < 0.15) {
    return {
      modulation: "CW / Tone",
      confidence: Math.min(98, 85 + (1 - spectralFlatness) * 15),
      signalType: "Continuous Wave",
    };
  }

  // Very flat spectrum → Noise
  if (spectralFlatness > 0.7) {
    return {
      modulation: "Noise",
      confidence: Math.min(95, 60 + spectralFlatness * 35),
      signalType: "Broadband Noise",
    };
  }

  // Wide smooth spectrum → FM-like
  if (bwKHz > 5 && peakCount <= 4 && spectralFlatness > 0.3) {
    return {
      modulation: "FM-like",
      confidence: Math.min(90, 65 + (bwKHz / 20) * 20),
      signalType: "Frequency Modulated",
    };
  }

  // Multiple sidebands → PSK-like
  if (peakCount >= 3 && peakCount <= 10 && spectralFlatness < 0.5) {
    return {
      modulation: "PSK-like",
      confidence: Math.min(88, 60 + peakCount * 3),
      signalType: "Phase Shift Keyed",
    };
  }

  // Many peaks, moderate flatness → QAM-like
  if (peakCount > 10 && spectralFlatness < 0.6) {
    return {
      modulation: "QAM-like",
      confidence: Math.min(82, 55 + peakCount * 1.5),
      signalType: "Quadrature Amplitude",
    };
  }

  // Moderate bandwidth, few peaks → AM/ASK-like
  if (peakCount <= 3 && bwKHz >= 0.5 && bwKHz <= 5) {
    return {
      modulation: "AM / ASK",
      confidence: Math.min(80, 60 + (1 - spectralFlatness) * 20),
      signalType: "Amplitude Modulated",
    };
  }

  // Fallback
  return {
    modulation: "Unknown",
    confidence: 40,
    signalType: "Unclassified",
  };
}

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
      let rawWave: number[] = backendData.waveform || [];
      let rawFft: number[] = backendData.fft || [];

      // Safety: filter NaN, Infinity, undefined
      rawWave = rawWave.filter(
        (v: any) => typeof v === "number" && !isNaN(v) && isFinite(v)
      );
      rawFft = rawFft.filter(
        (v: any) => typeof v === "number" && !isNaN(v) && isFinite(v)
      );

      // ── Duration ──
      const duration = rawWave.length / sr;

      // ── Signal Power: P = (1/N) * Σ(x[n]²) ──
      let totalPower = 0;
      for (let i = 0; i < rawWave.length; i++) {
        totalPower += rawWave[i] * rawWave[i];
      }
      const avgPower = totalPower / (rawWave.length || 1);
      const powerDb = avgPower > 0 ? 10 * Math.log10(avgPower) : -100;

      // ── FFT Analysis ──
      const nyquist = sr / 2;
      const freqStep = rawFft.length > 0 ? nyquist / rawFft.length : 1;

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

      const domFreq = (domFreqIndex * freqStep) / 1000; // kHz
      const avgNoise = noiseSum / (rawFft.length || 1);

      // ── SNR: 20 * log10(peak / avgNoise) ──
      const snrRaw =
        maxMag > 0 && avgNoise > 0
          ? 20 * Math.log10(maxMag / avgNoise)
          : 0;
      const snr = Math.max(0, Math.min(80, snrRaw));

      // ── Real Bandwidth: -10 dB occupied bandwidth ──
      const bandwidth = computeBandwidth(rawFft, maxMag, freqStep);

      // ── Spectral Flatness ──
      const spectralFlatness = computeSpectralFlatness(rawFft);

      // ── Peak Count ──
      const peakCount = countPeaks(rawFft, maxMag);

      // ── Modulation Classification (FFT shape heuristic) ──
      const classification = classifySignal(
        rawFft,
        maxMag,
        spectralFlatness,
        peakCount,
        bandwidth
      );

      // ── Signal Quality: derived from SNR + spectral flatness ──
      const qualityRaw = 50 + snr * 1.5 - spectralFlatness * 30;
      const quality = Math.min(99.9, Math.max(10, qualityRaw));

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
        dominantMag: +(maxMag <= 0 ? -100 : 20 * Math.log10(maxMag)).toFixed(1),
        power: +powerDb.toFixed(1),
        snr: +snr.toFixed(1),
        bandwidth: +bandwidth.toFixed(2),
        quality: +quality.toFixed(1),
        modulation: classification.modulation,
        confidence: +classification.confidence.toFixed(1),
        signalType: classification.signalType,
        spectralFlatness: +spectralFlatness.toFixed(4),
        dataRate: +dataRate.toFixed(1),
        rawFft: rawFft,
      };

      setData(newAnalysis);

      // Add to history
      const now = new Date();
      setHistory((prev) => [
        {
          file: file.name,
          type: classification.modulation,
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
