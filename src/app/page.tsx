"use client";

import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MetricCard from "@/components/MetricCard";
import AnalysisPanel from "@/components/AnalysisPanel";
import AnalysisHistory from "@/components/AnalysisHistory";
import QuickActions from "@/components/QuickActions";
import { Activity, BarChart3, Wifi, Radio, Zap, TrendingUp } from "lucide-react";
import { useSignal } from "@/context/SignalContext";

const SignalChart         = dynamic(() => import("@/components/SignalChart"),         { ssr: false });
const FFTChart            = dynamic(() => import("@/components/FFTChart"),            { ssr: false });
const Spectrogram         = dynamic(() => import("@/components/Spectrogram"),         { ssr: false });
const ConstellationDiagram= dynamic(() => import("@/components/ConstellationDiagram"),{ ssr: false });

export default function DashboardPage() {
  const { data } = useSignal();

  const METRICS = [
    {
      label: "Spectral Centroid", value: data ? (data.spectralCentroid || data.dominantFreq).toFixed(2) : "--", unit: "kHz",
      status: data ? "Measured" : "Scanning...", statusColor: "#00d4ff",
      icon: <Wifi style={{ width: 13, height: 13, color: "#00d4ff" }} strokeWidth={2} />,
      glowColor: "#00d4ff",
    },
    {
      label: "SNR", value: data ? data.snr.toFixed(1) : "--", unit: "dB",
      status: data ? "Measured" : "--",
      statusColor: "#f59e0b",
      icon: <BarChart3 style={{ width: 13, height: 13, color: "#f59e0b" }} strokeWidth={2} />,
      glowColor: "#f59e0b",
    },
    {
      label: "RMS Power", value: data ? (data.rmsPower || data.power).toFixed(1) : "--", unit: "dBFS",
      status: "Measured", statusColor: "#22c55e",
      icon: <Zap style={{ width: 13, height: 13, color: "#22c55e" }} strokeWidth={2} />,
      glowColor: "#22c55e",
    },
    {
      label: "Occupied BW", value: data ? data.bandwidth.toFixed(2) : "--", unit: "kHz",
      status: "90% energy", statusColor: "#a855f7",
      icon: <Radio style={{ width: 13, height: 13, color: "#a855f7" }} strokeWidth={2} />,
      glowColor: "#a855f7",
    },
    {
      label: "Spectral Flatness", value: data ? data.spectralFlatness.toFixed(3) : "--", unit: "",
      status: data ? "Wiener entropy" : "--", statusColor: "#4a5f82",
      icon: <Activity style={{ width: 13, height: 13, color: "#22c55e" }} strokeWidth={2} />,
      glowColor: "#22c55e",
    },
    {
      label: "Crest Factor", value: data ? (data.crestFactor || 0).toFixed(1) : "--", unit: "dB",
      status: data ? "Peak/RMS" : "--", statusColor: "#4a5f82",
      icon: <TrendingUp style={{ width: 13, height: 13, color: "#f59e0b" }} strokeWidth={2} />,
      glowColor: "#f59e0b",
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#030512", color: "#dfe6f0" }}>

      {/* ── Cinematic ambient depth lighting ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Top-left cyan bloom */}
        <div style={{
          position: "absolute", top: -150, left: 100,
          width: 900, height: 900,
          background: "radial-gradient(ellipse at center, rgba(0,212,255,0.06) 0%, transparent 65%)",
          borderRadius: "50%",
        }} />
        {/* Mid-right purple bloom */}
        <div style={{
          position: "absolute", top: "30%", right: "-10%",
          width: 800, height: 800,
          background: "radial-gradient(ellipse at center, rgba(168,85,247,0.05) 0%, transparent 65%)",
          borderRadius: "50%",
        }} />
        {/* Bottom-center blue bloom */}
        <div style={{
          position: "absolute", bottom: -100, left: "20%",
          width: 600, height: 600,
          background: "radial-gradient(ellipse at center, rgba(59,130,246,0.04) 0%, transparent 60%)",
          borderRadius: "50%",
        }} />
      </div>

      <Sidebar />
      <Header />

      {/* ── Main content ── */}
      <main className="relative z-10" style={{ marginLeft: 156, paddingTop: 64 }}>
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ── Row 1: Metric cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
            {METRICS.map((m, i) => <MetricCard key={m.label} {...m} index={i} />)}
          </div>

          {/* ── Main grid ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 220px",
            gridTemplateRows: "auto auto auto",
            gap: 12,
            alignItems: "start",
          }}>
            <div style={{ gridColumn: 1, gridRow: 1 }}><SignalChart /></div>
            <div style={{ gridColumn: 2, gridRow: 1 }}><FFTChart /></div>
            <div style={{ gridColumn: 3, gridRow: "1 / 4", display: "flex", flexDirection: "column" }}>
              <AnalysisPanel />
            </div>
            <div style={{ gridColumn: 1, gridRow: 2 }}><Spectrogram /></div>
            <div style={{ gridColumn: 2, gridRow: 2 }}><ConstellationDiagram /></div>
            <div style={{
              gridColumn: "1 / 3", gridRow: 3,
              display: "grid", gridTemplateColumns: "1fr 210px", gap: 12,
            }}>
              <AnalysisHistory />
              <QuickActions />
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between" style={{
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.02)",
            paddingBottom: 8,
          }}>
            <div className="flex items-center gap-2">
              <span style={{
                fontFamily: "var(--font-rajdhani)",
                fontSize: 10, fontWeight: 500, color: "#2d3b54", letterSpacing: "0.04em",
              }}>SignalMind AI v1.0.0</span>
              <span style={{ color: "#161d2b" }}>|</span>
              <span style={{
                fontFamily: "var(--font-rajdhani)",
                fontSize: 10, fontWeight: 500, color: "#2d3b54", letterSpacing: "0.04em",
              }}>AI-Powered Signal Intelligence Platform</span>
            </div>
            <span style={{
              fontFamily: "var(--font-rajdhani)",
              fontSize: 10, fontWeight: 500, color: "#2d3b54", letterSpacing: "0.04em",
            }}>© 2026 SignalMind AI. All rights reserved.</span>
          </div>
        </div>
      </main>
    </div>
  );
}
