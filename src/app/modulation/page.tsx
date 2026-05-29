"use client";

import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MetricCard from "@/components/MetricCard";
import { Activity, BarChart3, Wifi, Radio, Zap, TrendingUp } from "lucide-react";
import { useSignal } from "@/context/SignalContext";
import { useState, useEffect } from "react";

const ConstellationDiagram = dynamic(() => import("@/components/ConstellationDiagram"), { ssr: false });
const FFTChart = dynamic(() => import("@/components/FFTChart"), { ssr: false });

/* ── Diagnostics Panel (inline) ─────────────────────────────── */
function DiagnosticsPanel({ data }: { data: any }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 800);
    return () => clearInterval(id);
  }, []);

  // Read live metrics from the IQ engine (via data.modMetrics)
  const m = data?.modMetrics;
  const nudge = () => (Math.random() - 0.5) * 0.2;

  const snrVal = m ? +(data.snr + nudge()).toFixed(1) : "--";
  const bwVal = m ? +(data.bandwidth + nudge()).toFixed(1) : "--";
  const merVal = m ? +(m.mer + nudge()).toFixed(1) : "--";
  const iqImb = m ? +(m.iqImbalance + nudge() * 0.1).toFixed(2) : "--";
  const freqOff = m ? +(m.freqOffset + nudge()).toFixed(1) : "--";
  const agcVal = m ? +(m.agcGain + nudge() * 0.1).toFixed(2) : "--";
  const driftVal = m ? +(m.driftRate + nudge() * 0.01).toFixed(3) : "--";
  const carrierLocked = m?.carrierLock ?? false;

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-rajdhani)",
    fontSize: 10,
    color: "#4a5f82",
    lineHeight: 1.2,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  };

  const valueStyle = (color: string): React.CSSProperties => ({
    fontFamily: "var(--font-orbitron)",
    fontSize: 11,
    color,
    textShadow: `0 0 6px ${color}44`,
    lineHeight: 1.3,
  });

  const rowStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    padding: "5px 0",
  };

  return (
    <div
      style={{
        background: "rgba(4,7,20,0.85)",
        border: "1px solid rgba(0,212,255,0.1)",
        borderRadius: 8,
        padding: "12px 14px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-orbitron)",
          fontSize: 10,
          color: "#4a5f82",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 8,
          borderBottom: "1px solid rgba(0,212,255,0.06)",
          paddingBottom: 6,
        }}
      >
        RF Diagnostics
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "2px 18px",
          flex: 1,
        }}
      >
        {/* ── Left Column ── */}
        <div style={rowStyle}>
          <span style={labelStyle}>Carrier Lock</span>
          <span style={valueStyle(carrierLocked ? "#22c55e" : "#f59e0b")}>
            {carrierLocked ? "LOCKED" : "SEARCHING"}
          </span>
        </div>

        {/* ── Right Column ── */}
        <div style={rowStyle}>
          <span style={labelStyle}>SNR</span>
          <span style={valueStyle("#00d4ff")}>
            {snrVal} <span style={{ fontSize: 9, opacity: 0.7 }}>dB</span>
          </span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>IQ Imbalance</span>
          <span style={valueStyle("#00d4ff")}>
            {iqImb} <span style={{ fontSize: 9, opacity: 0.7 }}>dB</span>
          </span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Occ. Bandwidth</span>
          <span style={valueStyle("#00d4ff")}>
            {bwVal} <span style={{ fontSize: 9, opacity: 0.7 }}>kHz</span>
          </span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Freq Offset</span>
          <span style={valueStyle("#f59e0b")}>
            {freqOff} <span style={{ fontSize: 9, opacity: 0.7 }}>Hz</span>
          </span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Drift Rate</span>
          <span style={valueStyle("#00d4ff")}>
            {driftVal} <span style={{ fontSize: 9, opacity: 0.7 }}>Hz/s</span>
          </span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>AGC State</span>
          <span style={valueStyle("#a855f7")}>
            {agcVal} <span style={{ fontSize: 9, opacity: 0.7 }}>dB</span>
          </span>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>MER</span>
          <span style={valueStyle("#22c55e")}>
            {merVal} <span style={{ fontSize: 9, opacity: 0.7 }}>dB</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function ModulationPage() {
  const { data } = useSignal();

  const METRICS = [
    {
      label: "Modulation",
      value: data?.modMetrics?.type || "--",
      unit: "",
      status: data ? "Detected" : "Scanning...",
      statusColor: "#00d4ff",
      icon: <Radio style={{ width: 13, height: 13, color: "#00d4ff" }} strokeWidth={2} />,
      glowColor: "#00d4ff",
    },
    {
      label: "EVM",
      value: data?.modMetrics?.evm.toFixed(1) || "--",
      unit: "%",
      status: data ? "Error Vector" : "--",
      statusColor: "#a855f7",
      icon: <Activity style={{ width: 13, height: 13, color: "#a855f7" }} strokeWidth={2} />,
      glowColor: "#a855f7",
    },
    {
      label: "Confidence",
      value: data?.modMetrics?.confidence.toFixed(1) || "--",
      unit: "%",
      status: "Neural/Stat",
      statusColor: "#22c55e",
      icon: <BarChart3 style={{ width: 13, height: 13, color: "#22c55e" }} strokeWidth={2} />,
      glowColor: "#22c55e",
    },
    {
      label: "Symbol Rate",
      value: data?.modMetrics?.baudRate
        ? Math.round(data.modMetrics.baudRate).toString()
        : "--",
      unit: "Bd",
      status: "Estimated",
      statusColor: "#f59e0b",
      icon: <Zap style={{ width: 13, height: 13, color: "#f59e0b" }} strokeWidth={2} />,
      glowColor: "#f59e0b",
    },
    {
      label: "Phase Error",
      value: data?.modMetrics?.phaseError.toFixed(2) || "--",
      unit: "°",
      status: "RMS",
      statusColor: "#ef4444",
      icon: <TrendingUp style={{ width: 13, height: 13, color: "#ef4444" }} strokeWidth={2} />,
      glowColor: "#ef4444",
    },
    {
      label: "Carrier Freq",
      value: data ? data.dominantFreq.toFixed(2) : "--",
      unit: "kHz",
      status: "Locked",
      statusColor: "#4a5f82",
      icon: <Wifi style={{ width: 13, height: 13, color: "#4a5f82" }} strokeWidth={2} />,
      glowColor: "#4a5f82",
    },
  ];

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: "#030512", color: "#dfe6f0" }}
    >
      {/* ── Cinematic ambient depth lighting ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          style={{
            position: "absolute",
            top: -150,
            left: 100,
            width: 900,
            height: 900,
            background:
              "radial-gradient(ellipse at center, rgba(0,212,255,0.06) 0%, transparent 65%)",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "30%",
            right: "-10%",
            width: 800,
            height: 800,
            background:
              "radial-gradient(ellipse at center, rgba(168,85,247,0.05) 0%, transparent 65%)",
            borderRadius: "50%",
          }}
        />
      </div>

      <Sidebar />
      <Header />

      {/* ── Main content ── */}
      <main className="relative z-10" style={{ marginLeft: 156, paddingTop: 64 }}>
        <div
          style={{
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {/* ── Page title ── */}
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-5 h-5 text-[#00d4ff]" />
            <h1
              style={{
                fontFamily: "var(--font-orbitron)",
                fontSize: 18,
                color: "#fff",
                textShadow: "0 0 10px rgba(0,212,255,0.5)",
              }}
            >
              Modulation Detection
            </h1>
          </div>

          {/* ── Metric cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
            {METRICS.map((m, i) => (
              <MetricCard key={m.label} {...m} index={i} />
            ))}
          </div>

          {/* ── Main body grid ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr",
              gap: 12,
              height: "calc(100vh - 210px)",
            }}
          >
            {/* Left column — Constellation full height */}
            <div style={{ height: "100%" }}>
              <ConstellationDiagram />
            </div>

            {/* Right column — FFT top, Diagnostics bottom */}
            <div
              style={{
                display: "grid",
                gridTemplateRows: "1fr 1fr",
                gap: 12,
                height: "100%",
              }}
            >
              <div style={{ height: "100%", minHeight: 0 }}>
                <FFTChart />
              </div>
              <DiagnosticsPanel data={data} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
