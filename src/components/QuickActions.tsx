"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Upload, Download, Play, AlertTriangle, CheckCircle } from "lucide-react";
import { useSignal } from "@/context/SignalContext";

export default function QuickActions() {
  const { data, uploadSignal, isProcessing } = useSignal();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    if (!isProcessing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadSignal(e.target.files[0]);
      e.target.value = "";
    }
  };

  const handleExport = () => {
    if (!data) return;
    const report = {
      generated: new Date().toISOString(),
      file: data.fileName,
      sampleRate: data.sampleRate,
      duration: data.duration,
      dominantFrequencyKHz: data.dominantFreq,
      bandwidthKHz: data.bandwidth,
      powerDbm: data.power,
      snrDb: data.snr,
      signalQualityPct: data.quality,
      modulation: data.modulation,
      confidence: data.confidence,
      signalType: data.signalType,
      spectralFlatness: data.spectralFlatness,
      dataRateKbps: data.dataRate,
      waveformSamples: data.waveform.length,
      fftBins: data.fft.length,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signal-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Dynamic warning/status message
  const hasInterference = data ? data.bandwidth > 15 : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.55 }}
      className="relative overflow-hidden"
      style={{
        background: "rgba(4,7,20,0.85)",
        backdropFilter: "blur(30px) saturate(1.4)",
        border: "1px solid rgba(0,212,255,0.1)",
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: "0 8px 30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02)",
      }}
    >
      <div className="absolute top-0 left-[12%] right-[12%]" style={{
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)",
        boxShadow: "0 0 8px rgba(0,212,255,0.3)",
      }} />

      <h3 style={{
        fontFamily: "var(--font-orbitron)",
        fontSize: 11, fontWeight: 500, color: "#cbd5e1", letterSpacing: "0.06em",
        marginBottom: 10,
        textShadow: "0 0 8px rgba(255,255,255,0.1)",
      }}>
        Actions
      </h3>

      <input
        type="file"
        accept=".wav"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      <div className="flex flex-col gap-2">
        <button
          onClick={handleUploadClick}
          disabled={isProcessing}
          className="flex items-center justify-between group"
          style={{
            background: "rgba(0,212,255,0.05)",
            border: "1px solid rgba(0,212,255,0.15)",
            borderRadius: 6,
            padding: "6px 10px",
            cursor: isProcessing ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            boxShadow: "inset 0 0 8px rgba(0,212,255,0.02)",
            opacity: isProcessing ? 0.6 : 1,
          }}
        >
          <div className="flex items-center gap-2">
            <Upload style={{ width: 13, height: 13, color: "#00d4ff" }} strokeWidth={1.8} />
            <span style={{
              fontFamily: "var(--font-rajdhani)",
              fontSize: 10.5, fontWeight: 500, color: "#00d4ff", letterSpacing: "0.04em",
              textShadow: "0 0 8px rgba(0,212,255,0.3)",
            }}>Import File</span>
          </div>
        </button>

        <button
          onClick={handleExport}
          disabled={!data}
          className="flex items-center justify-between group"
          style={{
            background: data ? "rgba(59,130,246,0.05)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${data ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.04)"}`,
            borderRadius: 6, padding: "6px 10px",
            cursor: data ? "pointer" : "not-allowed",
            transition: "all 0.2s ease",
            opacity: data ? 1 : 0.5,
          }}
        >
          <div className="flex items-center gap-2">
            <Download style={{ width: 13, height: 13, color: data ? "#3b82f6" : "#45597a" }} strokeWidth={1.8} />
            <span style={{
              fontFamily: "var(--font-rajdhani)",
              fontSize: 10.5, fontWeight: 500, color: data ? "#60a5fa" : "#5c7399", letterSpacing: "0.04em",
            }}>Export Report</span>
          </div>
        </button>

        <button className="flex items-center justify-between group" style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)",
          borderRadius: 6, padding: "6px 10px", cursor: "pointer", transition: "all 0.2s ease",
        }}>
          <div className="flex items-center gap-2">
            <Play style={{ width: 13, height: 13, color: "#22c55e" }} strokeWidth={1.8} />
            <span style={{
              fontFamily: "var(--font-rajdhani)",
              fontSize: 10.5, fontWeight: 500, color: "#22c55e", letterSpacing: "0.04em",
              textShadow: "0 0 8px rgba(34,197,94,0.3)",
            }}>Live Capture</span>
          </div>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        </button>
      </div>

      <div className="mt-3 p-2 rounded-md" style={{
        background: hasInterference ? "rgba(245,158,11,0.05)" : "rgba(34,197,94,0.05)",
        border: `1px solid ${hasInterference ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)"}`,
      }}>
        <div className="flex items-start gap-1.5">
          {hasInterference ? (
            <AlertTriangle style={{ width: 12, height: 12, color: "#f59e0b", marginTop: 1 }} strokeWidth={2} />
          ) : (
            <CheckCircle style={{ width: 12, height: 12, color: "#22c55e", marginTop: 1 }} strokeWidth={2} />
          )}
          <p style={{
            fontFamily: "var(--font-inter)",
            fontSize: 9, color: hasInterference ? "#d97706" : "#16a34a", lineHeight: 1.4,
          }}>
            {data
              ? hasInterference
                ? `Broadband interference detected (${data.bandwidth.toFixed(1)} kHz BW). Auto-filtering recommended.`
                : `Signal is clean — ${data.modulation} detected with ${data.confidence.toFixed(0)}% confidence.`
              : "Upload a WAV file to begin analysis."
            }
          </p>
        </div>
      </div>
    </motion.div>
  );
}
