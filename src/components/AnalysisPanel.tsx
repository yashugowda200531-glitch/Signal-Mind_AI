"use client";

import { motion } from "framer-motion";
import { Info, Cpu, ChevronRight, Activity, Radio, Wifi } from "lucide-react";
import GaugeMeter from "./GaugeMeter";

import { useSignal } from "@/context/SignalContext";

const CARD = {
  background: "rgba(4,7,20,0.85)",
  backdropFilter: "blur(30px) saturate(1.4)",
  border: "1px solid rgba(0,212,255,0.12)",
  borderRadius: 8,
  padding: "10px 12px",
  position: "relative" as const,
  overflow: "hidden" as const,
  boxShadow: "0 8px 30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02)",
};

const TOP = <div className="absolute top-0 left-[12%] right-[12%]" style={{
  height: 1, background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)",
}} />;

const generateINFO = (data: any) => [
  { label: "Signal Type:",      val: data ? data.modulation : "--",                    col: "#00d4ff" },
  { label: "Modulation:",       val: data ? data.modulation : "--",                    col: "#00d4ff" },
  { label: "Center Frequency:", val: data ? `${data.dominantFreq.toFixed(2)} kHz` : "--", col: "#c8d4e4" },
  { label: "Sample Rate:",      val: data ? `${(data.sampleRate/1000).toFixed(1)} kHz` : "--", col: "#c8d4e4" },
  { label: "Duration:",         val: data ? `${data.duration.toFixed(2)} s` : "--",    col: "#c8d4e4" },
  { label: "Samples:",          val: data ? `${(data.duration * data.sampleRate).toLocaleString()}` : "--", col: "#c8d4e4" },
  { label: "Bit Rate:",         val: data ? (data.snr > 30 ? "256 kbps" : "128 kbps") : "--", col: "#c8d4e4" },
  { label: "Confidence:",       val: data ? `${data.quality.toFixed(1)}%` : "--",      col: "#22c55e" },
];

const generateAI = (data: any) => [
  { label: "Modulation Detected",       val: data ? data.modulation : "--",       col: "#00d4ff" },
  { label: "Signal Quality Assessment", val: data ? (data.quality > 80 ? "Excellent" : "Fair") : "--", col: "#22c55e" },
  { label: "Noise Level",              val: data ? (data.snr > 20 ? "Low" : "High") : "--",        col: "#22c55e" },
  { label: "Interference Detection",   val: "None",       col: "#22c55e" },
  { label: "Anomaly Detection",        val: "Normal",     col: "#22c55e" },
  { label: "Overall Confidence",       val: data ? `${data.quality.toFixed(1)}%` : "--",      col: "#22c55e" },
];

function Title({ icon: I, label, color }: { icon: any; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
      <div className="flex items-center justify-center rounded" style={{
        width: 20, height: 20,
        background: `${color}14`,
        border: `1px solid ${color}28`,
        boxShadow: `0 0 6px ${color}10`,
      }}>
        <I style={{ width: 11, height: 11, color }} strokeWidth={2} />
      </div>
      <span style={{
        fontFamily: "var(--font-rajdhani)",
        fontSize: 12.5, fontWeight: 600, color: "#d0dae8",
        letterSpacing: "0.02em",
      }}>
        {label}
      </span>
    </div>
  );
}

export default function AnalysisPanel() {
  const { data } = useSignal();
  const INFO = generateINFO(data);
  const AI = generateAI(data);

  return (
    <div className="flex flex-col gap-2.5 h-full">

      {/* Signal Information */}
      <motion.div
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={CARD}
      >
        {TOP}
        <Title icon={Info} label="Signal Information" color="#00d4ff" />
        <div className="flex justify-between items-end mt-3">
          <div>
            <div style={{
              fontFamily: "var(--font-orbitron)",
              fontSize: 16, fontWeight: 600, color: "#00d4ff",
              textShadow: "0 0 16px rgba(0,212,255,0.6)",
              lineHeight: 1,
            }}>
              {data ? data.quality.toFixed(1) : "--"} <span style={{ fontSize: 10, color: "#cbd5e1", textShadow: "none" }}>%</span>
            </div>
            <div style={{
              fontFamily: "var(--font-rajdhani)",
              fontSize: 10, color: "#00d4ff", letterSpacing: "0.06em", marginTop: 4,
            }}>
              {data ? "CONFIDENCE" : "AWAITING SIGNAL"}
            </div>
          </div>
          <div style={{ width: 64, height: 64, marginRight: -8, marginTop: -8 }}>
            <GaugeMeter value={data ? data.quality : 0} label="" status="" />
          </div>
        </div>
      </motion.div>

      {/* ── Metric 1 ── */}
      <div style={CARD}>
        {TOP}
        <div className="flex items-center gap-2 mb-1.5">
          <Activity style={{ width: 12, height: 12, color: "#22c55e" }} strokeWidth={2} />
          <span style={{
            fontFamily: "var(--font-rajdhani)",
            fontSize: 10, fontWeight: 500, color: "#cbd5e1", letterSpacing: "0.04em",
          }}>Signal-to-Noise Ratio</span>
        </div>
        <div style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 14, fontWeight: 600, color: "#22c55e",
          textShadow: "0 0 12px rgba(34,197,94,0.4)",
        }}>
          {data ? `+${data.snr.toFixed(1)} dB` : "--"}
        </div>
      </div>

      {/* ── Metric 2 ── */}
      <div style={CARD}>
        {TOP}
        <div className="flex items-center gap-2 mb-1.5">
          <Radio style={{ width: 12, height: 12, color: "#a855f7" }} strokeWidth={2} />
          <span style={{
            fontFamily: "var(--font-rajdhani)",
            fontSize: 10, fontWeight: 500, color: "#cbd5e1", letterSpacing: "0.04em",
          }}>Bandwidth Estimate</span>
        </div>
        <div style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 14, fontWeight: 600, color: "#a855f7",
          textShadow: "0 0 12px rgba(168,85,247,0.4)",
        }}>
          {data ? `${data.bandwidth.toFixed(2)} kHz` : "--"}
        </div>
      </div>

      {/* ── Metric 3 ── */}
      <div style={CARD}>
        {TOP}
        <div className="flex items-center gap-2 mb-1.5">
          <Wifi style={{ width: 12, height: 12, color: "#f59e0b" }} strokeWidth={2} />
          <span style={{
            fontFamily: "var(--font-rajdhani)",
            fontSize: 10, fontWeight: 500, color: "#cbd5e1", letterSpacing: "0.04em",
          }}>Carrier Frequency</span>
        </div>
        <div style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 14, fontWeight: 600, color: "#f59e0b",
          textShadow: "0 0 12px rgba(245,158,11,0.4)",
        }}>
          {data ? `${data.dominantFreq.toFixed(2)} kHz` : "--"}
        </div>
      </div>

      {/* AI Analysis Results */}
      <motion.div
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        style={{ ...CARD, flex: 1 }}
      >
        {TOP}
        <Title icon={Cpu} label="AI Analysis Results" color="#a855f7" />
        <div>
          {AI.map((r, i) => (
            <motion.div
              key={r.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.06 }}
              className="flex justify-between items-center"
              style={{
                padding: "5px 0",
                borderBottom: i < AI.length - 1 ? "1px solid rgba(255,255,255,0.035)" : "none",
              }}
            >
              <span style={{
                fontFamily: "var(--font-rajdhani)",
                fontSize: 10.5, fontWeight: 500, color: "#4a5f82",
              }}>{r.label}</span>
              <span style={{
                fontFamily: "var(--font-rajdhani)",
                fontSize: 10.5, fontWeight: 700, color: r.col,
                padding: "1px 7px", borderRadius: 4,
                background: `${r.col}0e`,
                textShadow: `0 0 6px ${r.col}30`,
              }}>{r.val}</span>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.button
          whileHover={{ scale: 1.015, boxShadow: "0 0 22px rgba(168,85,247,0.3), inset 0 0 12px rgba(168,85,247,0.05)" }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-between text-white font-semibold"
          style={{
            marginTop: 14,
            padding: "9px 14px",
            borderRadius: 8,
            fontFamily: "var(--font-rajdhani)",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.03em",
            background: "linear-gradient(90deg, rgba(168,85,247,0.18), rgba(0,212,255,0.08))",
            border: "1px solid rgba(168,85,247,0.35)",
            boxShadow: "0 0 14px rgba(168,85,247,0.12)",
            cursor: "pointer",
          }}
        >
          <span>View Detailed Analysis</span>
          <ChevronRight style={{ width: 14, height: 14, color: "#c084fc" }} />
        </motion.button>
      </motion.div>
    </div>
  );
}
