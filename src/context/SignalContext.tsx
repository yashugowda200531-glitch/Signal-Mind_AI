"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import axios from "axios";
import { generateLiveFrame, resetIqEngine, initDsp, isolateAndClassifyCarrier, type IQPoint, type ModulationMetrics } from "@/lib/iqEngine";
import { analyzeSignal } from "@/lib/dsp";
import { generateSignalIntelligence, type AIAnalysisResult, type ThreatAssessment } from "@/lib/aiClassifier";
import { useForensic } from "./ForensicContext";

import { sdrClient } from "@/lib/sdrClient";

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

export interface TrackedCarrier {
  info: any; // CarrierInfo
  mod: ModulationMetrics;
  ai: AIAnalysisResult;
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
  aiAnalysis?: AIAnalysisResult;
  trackedCarriers?: TrackedCarrier[];
  globalThreat?: ThreatAssessment;
}

interface SignalContextType {
  isProcessing: boolean;
  error: string | null;
  data: SignalData | null;
  history: HistoryItem[];
  uploadSignal: (file: File) => Promise<void>;
  resetError: () => void;
  isLiveSdr: boolean;
  toggleLiveSDR: () => void;
}

const SignalContext = createContext<SignalContextType | undefined>(undefined);

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

      // AI Signal Intelligence
      const aiResult = generateSignalIntelligence(realFftMetrics, iqFrame.metrics, duration * 1000);

      // Derived quality out of 100 based on EVM
      let quality = aiResult.signalPurity;

      // ── Independent Multi-Carrier Processing ──
      const trackedCarriers: TrackedCarrier[] = [];
      if (realFftMetrics.carriers) {
        for (const carrier of realFftMetrics.carriers) {
          const mod = isolateAndClassifyCarrier(rawWave, sr, carrier.freq, carrier.bandwidth, carrier.snr);
          // Recreate FFT metrics stub for AI analysis of this specific carrier
          const carrierFftInfo: any = {
             snrDb: carrier.snr,
             occupiedBandwidth: carrier.bandwidth,
             spectralEntropy: 0.5, // placeholder since it's already filtered
             spectralFlatness: 0.5,
             crestFactor: 2.0,
             peakFrequency: carrier.freq
          };
          const ai = generateSignalIntelligence(carrierFftInfo, mod, duration * 1000);
          trackedCarriers.push({ info: carrier, mod, ai });
        }
      }

      // ── Global Threat Evaluation ──
      let globalThreat = aiResult.threatAssessment;
      const severityScores: Record<string, number> = { "SAFE": 0, "LOW": 1, "ELEVATED": 2, "HIGH": 3, "CRITICAL": 4 };
      
      for (const track of trackedCarriers) {
         if (severityScores[track.ai.threatAssessment.severity] > severityScores[globalThreat.severity]) {
            globalThreat = track.ai.threatAssessment;
         }
      }

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
        modulation: aiResult.modulationType,
        confidence: +aiResult.confidenceScore.toFixed(1),
        signalType: aiResult.signalCategory,
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
        aiAnalysis: aiResult,
        trackedCarriers,
        globalThreat,
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

  // Auto-load forensic data
  const forensic = useForensic();
  useEffect(() => {
     if (data) {
        forensic.actions.loadRecording(data);
     }
  }, [data]);

  // ── Live SDR Integration ──
  const [isLiveSdr, setIsLiveSdr] = useState(false);
  const lastProcessRef = useRef<number>(0);
  
  useEffect(() => {
    if (isLiveSdr) {
      sdrClient.connect();
      sdrClient.setStatusCallback((connected) => {
        if (!connected) setIsLiveSdr(false);
      });
      sdrClient.setCallback((iqData) => {
         const now = performance.now();
         if (now - lastProcessRef.current < 200) return; // Limit to 5 FPS to save CPU
         lastProcessRef.current = now;

         try {
             // In a real app we'd convert IQ to real waveform for analyzeSignal if needed, 
             // or run a specialized complex-FFT. Here we just take the real part (I) for our existing DSP pipeline.
             const realFftMetrics = analyzeSignal(iqData, 2.4e6); 
             
             // Quick mock to reuse existing format
             const domFreq = realFftMetrics.peakFrequency;
             const snr = realFftMetrics.snrDb;
             const powerDb = realFftMetrics.signalPowerDb;
             
             initDsp(Array.from(iqData).slice(0, 4096), 2.4e6, domFreq, snr);
             const iqFrame = generateLiveFrame("Unknown", snr);
             const aiResult = generateSignalIntelligence(realFftMetrics, iqFrame.metrics, 100);
             
             setData(prev => ({
                 fileName: "LIVE SDR STREAM",
                 waveform: Array.from(iqData).slice(0, 4096),
                 fft: [],
                 sampleRate: 2.4e6,
                 duration: 1,
                 dominantFreq: +domFreq.toFixed(2),
                 dominantMag: +realFftMetrics.peakMagnitude.toFixed(1),
                 power: +powerDb.toFixed(1),
                 snr: +snr.toFixed(1),
                 bandwidth: +realFftMetrics.occupiedBandwidth.toFixed(2),
                 quality: +aiResult.signalPurity.toFixed(1),
                 modulation: aiResult.modulationType,
                 confidence: +aiResult.confidenceScore.toFixed(1),
                 signalType: aiResult.signalCategory,
                 spectralFlatness: +realFftMetrics.spectralFlatness.toFixed(4),
                 dataRate: +iqFrame.metrics.baudRate.toFixed(1),
                 peakCount: 1,
                 voiceConfidence: 0,
                 rawFft: [],
                 peaks: [],
                 spectralCentroid: +realFftMetrics.spectralCentroid.toFixed(2),
                 fundamentalFreq: 0,
                 rmsPower: +realFftMetrics.rms.toFixed(1),
                 spectralEntropy: +realFftMetrics.spectralEntropy.toFixed(4),
                 zeroCrossingRate: +realFftMetrics.zcr.toFixed(4),
                 spectralRolloff: +realFftMetrics.spectralRolloff.toFixed(2),
                 crestFactor: +realFftMetrics.crestFactor.toFixed(2),
                 noiseFloor: +realFftMetrics.noiseFloor.toFixed(1),
                 spectrogram: prev ? [...prev.spectrogram.slice(-50), realFftMetrics.magnitudes] : [realFftMetrics.magnitudes], // rolling history
                 iqConstellation: iqFrame.points,
                 modMetrics: iqFrame.metrics,
                 aiAnalysis: aiResult,
                 trackedCarriers: [],
                 globalThreat: aiResult.threatAssessment,
             }));
         } catch (e) {
            console.error(e);
         }
      });
      sdrClient.startStreaming();
    } else {
      sdrClient.disconnect();
    }
    return () => {
      sdrClient.disconnect();
    };
  }, [isLiveSdr]);

  const toggleLiveSDR = () => setIsLiveSdr(!isLiveSdr);

  return (
    <SignalContext.Provider
      value={{ isProcessing, error, data, history, uploadSignal, resetError, isLiveSdr, toggleLiveSDR }}
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
