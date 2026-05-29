"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  LineChart,
  Line,
} from "recharts";
import {
  Activity,
  BarChart3,
  Download,
  Cpu,
  Wifi,
  Zap,
  Radio,
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useSignal } from "@/context/SignalContext";

// ─── helpers ───────────────────────────────────────────────────────────────

function formatHz(khz: number) {
  if (khz >= 1000) return `${(khz / 1000).toFixed(2)} MHz`;
  return `${khz.toFixed(2)} kHz`;
}

function fmt(v: number | undefined, decimals = 1, unit = "") {
  if (v === undefined || v === null) return "—";
  return `${v.toFixed(decimals)}${unit}`;
}

// ─── subcomponents ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  unit,
  icon,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div
      style={{
        background: "rgba(4,7,20,0.85)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${color}22`,
        borderRadius: 8,
        padding: "10px 14px",
        boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px ${color}11`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* top glow line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "10%",
          right: "10%",
          height: 1,
          background: `linear-gradient(90deg, transparent, ${color}80, transparent)`,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <div style={{ color }}>{icon}</div>
        <span
          style={{
            fontFamily: "var(--font-rajdhani)",
            fontSize: 10,
            fontWeight: 500,
            color: "#4a5f82",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          style={{
            fontFamily: "var(--font-orbitron)",
            fontSize: 18,
            fontWeight: 700,
            color: value === "—" ? "#2d3b54" : color,
            textShadow: value !== "—" ? `0 0 16px ${color}80` : "none",
            letterSpacing: "0.04em",
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontFamily: "var(--font-rajdhani)",
              fontSize: 11,
              color: "#4a5f82",
              fontWeight: 500,
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <span
        style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 12,
          fontWeight: 600,
          color: "#cbd5e1",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </span>
      {subtitle && (
        <span
          style={{
            fontFamily: "var(--font-rajdhani)",
            fontSize: 10,
            color: "#3e4f6a",
            marginLeft: 8,
            letterSpacing: "0.04em",
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}

function PanelCard({
  children,
  style,
  borderColor = "rgba(0,212,255,0.1)",
  glowColor = "rgba(0,212,255,0.02)",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  borderColor?: string;
  glowColor?: string;
}) {
  return (
    <div
      style={{
        background: "rgba(4,7,20,0.85)",
        backdropFilter: "blur(30px) saturate(1.4)",
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        padding: "12px 14px",
        boxShadow: `0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02), inset 0 0 20px ${glowColor}`,
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Waveform chart with zoom/pan ──────────────────────────────────────────
function WaveformPanel() {
  const { data } = useSignal();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(0); // 0..1 fraction

  const MAX_PTS = 1200;

  const allPts = useMemo(() => {
    if (!data?.waveform?.length) return [];
    const maxAmp = Math.max(...data.waveform.map((v) => Math.abs(v))) || 1;
    const step = Math.max(1, Math.floor(data.waveform.length / MAX_PTS));
    const pts: { t: number; v: number }[] = [];
    for (let i = 0; i < data.waveform.length; i += step) {
      pts.push({
        t: +(i / data.sampleRate).toFixed(5),
        v: +(data.waveform[i] / maxAmp).toFixed(4),
      });
    }
    return pts;
  }, [data]);

  const chartData = useMemo(() => {
    if (!allPts.length) return [];
    const windowSize = Math.max(1, Math.floor(allPts.length / zoom));
    const maxOffset = allPts.length - windowSize;
    const start = Math.round(offset * maxOffset);
    return allPts.slice(start, start + windowSize);
  }, [allPts, zoom, offset]);

  const handleZoomIn = () => setZoom((z) => Math.min(z * 2, 64));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 2, 1));
  const handleReset = () => { setZoom(1); setOffset(0); };

  const WaveTip = ({ active, payload }: any) =>
    active && payload?.length ? (
      <div
        style={{
          background: "rgba(3,5,16,0.98)",
          border: "1px solid rgba(0,229,255,0.25)",
          borderRadius: 6,
          padding: "5px 10px",
        }}
      >
        <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 11, color: "#00e5ff" }}>
          t = {payload[0]?.payload?.t} s
        </div>
        <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 11, color: "#cbd5e1" }}>
          A = {payload[0]?.value?.toFixed(4)}
        </div>
      </div>
    ) : null;

  return (
    <PanelCard>
      {/* top glow */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "5%",
          right: "5%",
          height: 1,
          background: "linear-gradient(90deg,transparent,rgba(0,229,255,0.7),transparent)",
          boxShadow: "0 0 8px rgba(0,229,255,0.4)",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <SectionHeader title="Time Domain Waveform" subtitle={data ? `${data.waveform.length.toLocaleString()} samples · SR ${(data.sampleRate / 1000).toFixed(1)} kHz` : "Upload a WAV file"} />
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { icon: <ZoomIn size={12} />, fn: handleZoomIn, label: "Zoom In" },
            { icon: <ZoomOut size={12} />, fn: handleZoomOut, label: "Zoom Out" },
            { icon: <RotateCcw size={12} />, fn: handleReset, label: "Reset" },
          ].map(({ icon, fn, label }) => (
            <button
              key={label}
              onClick={fn}
              title={label}
              style={{
                background: "rgba(0,229,255,0.05)",
                border: "1px solid rgba(0,229,255,0.15)",
                borderRadius: 4,
                padding: "3px 7px",
                color: "#00e5ff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Zoom scrubber */}
      {zoom > 1 && (
        <div style={{ marginBottom: 8 }}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={offset}
            onChange={(e) => setOffset(+e.target.value)}
            style={{ width: "100%", accentColor: "#00e5ff", height: 2 }}
          />
          <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 9, color: "#3e4f6a", textAlign: "center" }}>
            Pan — {(offset * 100).toFixed(0)}%
          </div>
        </div>
      )}

      {chartData.length === 0 ? (
        <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-rajdhani)", color: "#2d3b54", fontSize: 13 }}>
            No signal data — upload a WAV file
          </span>
        </div>
      ) : (
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 6, right: 4, left: -28, bottom: 10 }}>
              <defs>
                <filter id="waveGlow" x="-20%" y="-50%" width="140%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b1" />
                  <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="b2" />
                  <feMerge>
                    <feMergeNode in="b1" />
                    <feMergeNode in="b2" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid stroke="rgba(0,229,255,0.03)" strokeDasharray="3 4" />
              <XAxis
                dataKey="t"
                interval="preserveStartEnd"
                minTickGap={60}
                tick={{ fill: "#2d3b54", fontSize: 8.5, fontFamily: "var(--font-rajdhani)" }}
                tickLine={false}
                axisLine={{ stroke: "rgba(0,229,255,0.05)" }}
                label={{ value: "Time (s)", position: "insideBottomRight", offset: -4, fill: "#2d3b54", fontSize: 8.5 }}
              />
              <YAxis
                domain={[-1.1, 1.1]}
                tickCount={5}
                tick={{ fill: "#2d3b54", fontSize: 8.5, fontFamily: "var(--font-rajdhani)" }}
                tickLine={false}
                axisLine={{ stroke: "rgba(0,229,255,0.05)" }}
                label={{ value: "Amplitude", angle: -90, position: "insideLeft", offset: 28, fill: "#2d3b54", fontSize: 8.5 }}
              />
              <Tooltip content={<WaveTip />} cursor={{ stroke: "rgba(0,229,255,0.12)", strokeWidth: 1 }} />
              <ReferenceLine y={0} stroke="rgba(0,229,255,0.08)" strokeDasharray="2 4" />
              <Line
                type="monotone"
                dataKey="v"
                stroke="#00e5ff"
                strokeWidth={1.8}
                dot={false}
                isAnimationActive={false}
                style={{ filter: "drop-shadow(0 0 6px #00e5ff)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </PanelCard>
  );
}

// ─── FFT chart with peaks & bandwidth markers ─────────────────────────────
function FFTPanel() {
  const { data } = useSignal();

  const { chartData, peakDb, bwLeft, bwRight } = useMemo(() => {
    if (!data?.fft?.length) return { chartData: [], peakDb: 0, bwLeft: 0, bwRight: 0 };
    const maxFFT = Math.max(...data.fft) || 1;
    const nyquist = data.sampleRate / 2;
    const freqStep = nyquist / data.fft.length;
    const MAX_PTS = 600;
    const step = Math.max(1, Math.floor(data.fft.length / MAX_PTS));
    const pts: { freq: number; magnitude: number }[] = [];
    for (let i = 0; i < data.fft.length; i += step) {
      const mag = data.fft[i] / maxFFT;
      const db = +(20 * Math.log10(mag + 1e-12)).toFixed(2);
      pts.push({ freq: +((i * freqStep) / 1000).toFixed(3), magnitude: db });
    }
    const peak3db = data.dominantFreq;
    const bwL = Math.max(0, peak3db - data.bandwidth / 2);
    const bwR = peak3db + data.bandwidth / 2;
    return { chartData: pts, peakDb: data.dominantMag, bwLeft: bwL, bwRight: bwR };
  }, [data]);

  const FftTip = ({ active, payload }: any) =>
    active && payload?.length ? (
      <div
        style={{
          background: "rgba(3,5,16,0.98)",
          border: "1px solid rgba(168,85,247,0.3)",
          borderRadius: 6,
          padding: "5px 10px",
        }}
      >
        <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 11, color: "#d8b4fe" }}>
          {payload[0]?.payload?.freq} kHz
        </div>
        <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 11, color: "#e2e8f0" }}>
          {payload[0]?.value} dB
        </div>
      </div>
    ) : null;

  return (
    <PanelCard borderColor="rgba(168,85,247,0.12)" glowColor="rgba(168,85,247,0.02)">
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "5%",
          right: "5%",
          height: 1,
          background: "linear-gradient(90deg,transparent,rgba(168,85,247,0.7),transparent)",
          boxShadow: "0 0 8px rgba(168,85,247,0.4)",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <SectionHeader
          title="Frequency Domain (FFT)"
          subtitle={data ? `Peak: ${formatHz(data.dominantFreq)} · BW: ${fmt(data.bandwidth, 2)} kHz` : "Upload a WAV file"}
        />
        {data && (
          <div
            style={{
              fontFamily: "var(--font-orbitron)",
              fontSize: 10,
              color: "#d8b4fe",
              textShadow: "0 0 12px rgba(168,85,247,0.8)",
              background: "rgba(168,85,247,0.08)",
              border: "1px solid rgba(168,85,247,0.2)",
              borderRadius: 4,
              padding: "2px 8px",
            }}
          >
            {fmt(peakDb, 1)} dBm peak
          </div>
        )}
      </div>

      {chartData.length === 0 ? (
        <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-rajdhani)", color: "#2d3b54", fontSize: 13 }}>
            No signal data — upload a WAV file
          </span>
        </div>
      ) : (
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 6, right: 4, left: -20, bottom: 10 }}>
              <defs>
                <linearGradient id="fftGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d946ef" stopOpacity={0.7} />
                  <stop offset="40%" stopColor="#a855f7" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.05} />
                </linearGradient>
                <filter id="fftGlow" x="-20%" y="-50%" width="140%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid stroke="rgba(168,85,247,0.04)" strokeDasharray="3 4" vertical={false} />
              <XAxis
                dataKey="freq"
                interval="preserveStartEnd"
                minTickGap={40}
                tick={{ fill: "#2d3b54", fontSize: 8.5, fontFamily: "var(--font-rajdhani)" }}
                tickLine={false}
                axisLine={{ stroke: "rgba(168,85,247,0.06)" }}
                label={{ value: "Frequency (kHz)", position: "insideBottomRight", offset: -4, fill: "#2d3b54", fontSize: 8.5 }}
              />
              <YAxis
                domain={[-100, 0]}
                tickCount={6}
                tick={{ fill: "#2d3b54", fontSize: 8.5, fontFamily: "var(--font-rajdhani)" }}
                tickLine={false}
                axisLine={{ stroke: "rgba(168,85,247,0.06)" }}
                label={{ value: "dB", angle: -90, position: "insideLeft", offset: 22, fill: "#2d3b54", fontSize: 8.5 }}
              />
              <Tooltip content={<FftTip />} cursor={{ stroke: "rgba(168,85,247,0.25)", strokeWidth: 1 }} />
              {/* Bandwidth markers */}
              {data && (
                <>
                  <ReferenceLine x={bwLeft} stroke="rgba(245,158,11,0.5)" strokeDasharray="4 3" strokeWidth={1} />
                  <ReferenceLine x={bwRight} stroke="rgba(245,158,11,0.5)" strokeDasharray="4 3" strokeWidth={1} />
                  <ReferenceLine x={data.dominantFreq} stroke="rgba(0,229,255,0.6)" strokeWidth={1.5} label={{ value: `${fmt(data.dominantFreq, 2)} kHz`, fill: "#00e5ff", fontSize: 9, fontFamily: "var(--font-rajdhani)", position: "top" }} />
                </>
              )}
              <Area
                type="step"
                dataKey="magnitude"
                stroke="#d946ef"
                strokeWidth={1.5}
                fill="url(#fftGrad)"
                fillOpacity={1}
                isAnimationActive={false}
                filter="url(#fftGlow)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </PanelCard>
  );
}

// ─── Radial gauge ─────────────────────────────────────────────────────────
function RadialGauge({
  value,
  max,
  label,
  color,
  unit,
  size = 90,
}: {
  value: number;
  max: number;
  label: string;
  color: string;
  unit: string;
  size?: number;
}) {
  const pct = Math.min(1, Math.max(0, value / max));
  const R = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = -220;
  const sweep = 260;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (start: number, end: number) => {
    const s = toRad(start);
    const e = toRad(end);
    const x1 = cx + R * Math.cos(s);
    const y1 = cy + R * Math.sin(s);
    const x2 = cx + R * Math.cos(e);
    const y2 = cy + R * Math.sin(e);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        {/* Track */}
        <path
          d={arcPath(startAngle, startAngle + sweep)}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={5}
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={arcPath(startAngle, startAngle + sweep * pct)}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
        {/* Value text */}
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fill={color}
          fontSize={13}
          fontFamily="var(--font-orbitron)"
          fontWeight={700}
          style={{ textShadow: `0 0 12px ${color}` }}
        >
          {value.toFixed(0)}
        </text>
        <text x={cx} y={cy + 17} textAnchor="middle" fill="#3e4f6a" fontSize={8} fontFamily="var(--font-rajdhani)">
          {unit}
        </text>
      </svg>
      <span
        style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 10,
          color: "#4a5f82",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── AI Analysis panel ────────────────────────────────────────────────────
function AIAnalysisPanel() {
  const { data } = useSignal();

  const rows = data
    ? [
        {
          label: "Signal Type",
          value: data.signalType,
          color: "#00e5ff",
          status: data.modulation,
        },
        {
          label: "Signal Quality",
          value: `${data.quality.toFixed(1)}%`,
          color: data.quality > 80 ? "#22c55e" : data.quality > 50 ? "#f59e0b" : "#ef4444",
          status: data.quality > 80 ? "Excellent" : data.quality > 50 ? "Good" : "Poor",
        },
        {
          label: "Noise Level",
          value: data.snr < 10 ? "High" : data.snr < 20 ? "Moderate" : "Low",
          color: data.snr < 10 ? "#ef4444" : data.snr < 20 ? "#f59e0b" : "#22c55e",
          status: `SNR ${data.snr.toFixed(1)} dB`,
        },
        {
          label: "Interference",
          value: data.bandwidth > 15 ? "Detected" : "None",
          color: data.bandwidth > 15 ? "#f59e0b" : "#22c55e",
          status: data.bandwidth > 15 ? "broadband" : "clean",
        },
        {
          label: "Anomaly Detection",
          value: data.spectralFlatness > 0.8 ? "Anomalous" : "Normal",
          color: data.spectralFlatness > 0.8 ? "#ef4444" : "#22c55e",
          status: `flatness ${data.spectralFlatness.toFixed(3)}`,
        },
        {
          label: "Overall Confidence",
          value: `${data.confidence.toFixed(1)}%`,
          color: "#a855f7",
          status: "AI estimate",
        },
      ]
    : [];

  return (
    <PanelCard borderColor="rgba(168,85,247,0.12)" glowColor="rgba(168,85,247,0.02)">
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "5%",
          right: "5%",
          height: 1,
          background: "linear-gradient(90deg,transparent,rgba(168,85,247,0.7),transparent)",
          boxShadow: "0 0 8px rgba(168,85,247,0.4)",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Cpu size={13} style={{ color: "#a855f7" }} />
        <SectionHeader title="AI Analysis Results" />
      </div>

      {!data ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "center",
            justifyContent: "center",
            minHeight: 160,
          }}
        >
          <AlertTriangle size={20} style={{ color: "#2d3b54" }} />
          <span style={{ fontFamily: "var(--font-rajdhani)", color: "#2d3b54", fontSize: 12 }}>
            Upload a WAV file to run AI analysis
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {rows.map((r) => (
            <div
              key={r.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                background: "rgba(255,255,255,0.015)",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.03)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-rajdhani)",
                  fontSize: 11,
                  color: "#8494b0",
                  fontWeight: 500,
                }}
              >
                {r.label}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    fontFamily: "var(--font-rajdhani)",
                    fontSize: 10,
                    color: "#3e4f6a",
                  }}
                >
                  {r.status}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-orbitron)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: r.color,
                    textShadow: `0 0 10px ${r.color}80`,
                    minWidth: 80,
                    textAlign: "right",
                  }}
                >
                  {r.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}

// ─── Signal Health gauges ─────────────────────────────────────────────────
function SignalHealthPanel() {
  const { data } = useSignal();

  const gauges = data
    ? [
        { label: "Quality", value: data.quality, max: 100, color: data.quality > 80 ? "#22c55e" : "#f59e0b", unit: "%" },
        { label: "SNR", value: Math.max(0, data.snr), max: 50, color: "#00e5ff", unit: "dB" },
        { label: "Power", value: Math.max(0, data.power + 100), max: 100, color: "#a855f7", unit: "dBm+" },
        { label: "Bandwidth", value: Math.min(data.bandwidth, 50), max: 50, color: "#f59e0b", unit: "kHz" },
      ]
    : [
        { label: "Quality", value: 0, max: 100, color: "#2d3b54", unit: "%" },
        { label: "SNR", value: 0, max: 50, color: "#2d3b54", unit: "dB" },
        { label: "Power", value: 0, max: 100, color: "#2d3b54", unit: "dBm+" },
        { label: "Bandwidth", value: 0, max: 50, color: "#2d3b54", unit: "kHz" },
      ];

  return (
    <PanelCard>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "5%",
          right: "5%",
          height: 1,
          background: "linear-gradient(90deg,transparent,rgba(0,229,255,0.6),transparent)",
          boxShadow: "0 0 8px rgba(0,229,255,0.3)",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Activity size={13} style={{ color: "#00e5ff" }} />
        <SectionHeader title="Signal Health Gauges" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 12 }}>
        {gauges.map((g) => (
          <RadialGauge key={g.label} {...g} size={96} />
        ))}
      </div>

      {/* Health status bar */}
      {data && (
        <div
          style={{
            marginTop: 14,
            padding: "8px 12px",
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.15)",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CheckCircle size={12} style={{ color: "#22c55e" }} />
          <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 11, color: "#6ee7a0", fontWeight: 500 }}>
            Signal is {data.quality > 80 ? "healthy and strong" : data.quality > 50 ? "acceptable quality" : "degraded — check source"}
          </span>
        </div>
      )}
    </PanelCard>
  );
}

// ─── Signal info panel ────────────────────────────────────────────────────
function SignalInfoPanel() {
  const { data } = useSignal();

  const rows = data
    ? [
        { label: "File Name", value: data.fileName, mono: false },
        { label: "Sample Rate", value: `${(data.sampleRate / 1000).toFixed(1)} kHz`, mono: true },
        { label: "Duration", value: `${data.duration.toFixed(3)} s`, mono: true },
        { label: "Total Samples", value: data.waveform.length.toLocaleString(), mono: true },
        { label: "FFT Bins", value: data.fft.length.toLocaleString(), mono: true },
        { label: "Dominant Freq", value: formatHz(data.dominantFreq), mono: true },
        { label: "Bandwidth", value: `${data.bandwidth.toFixed(2)} kHz`, mono: true },
        { label: "Signal Power", value: `${data.power.toFixed(1)} dBm`, mono: true },
        { label: "SNR", value: `${data.snr.toFixed(1)} dB`, mono: true },
        { label: "Modulation", value: data.modulation, mono: false },
      ]
    : [];

  return (
    <PanelCard>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "5%",
          right: "5%",
          height: 1,
          background: "linear-gradient(90deg,transparent,rgba(0,229,255,0.6),transparent)",
          boxShadow: "0 0 8px rgba(0,229,255,0.3)",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Info size={13} style={{ color: "#00e5ff" }} />
        <SectionHeader title="Signal Parameters" />
      </div>

      {!data ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120 }}>
          <span style={{ fontFamily: "var(--font-rajdhani)", color: "#2d3b54", fontSize: 12 }}>No data yet</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.map((r) => (
            <div
              key={r.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "4px 0",
                borderBottom: "1px solid rgba(255,255,255,0.025)",
              }}
            >
              <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 10.5, color: "#4a5f82", fontWeight: 500 }}>
                {r.label}
              </span>
              <span
                style={{
                  fontFamily: r.mono ? "var(--font-orbitron)" : "var(--font-rajdhani)",
                  fontSize: r.mono ? 10 : 11,
                  color: "#00e5ff",
                  fontWeight: 600,
                  textShadow: "0 0 8px rgba(0,229,255,0.5)",
                  maxWidth: 140,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}

// ─── Export button ────────────────────────────────────────────────────────
function ExportButton() {
  const { data } = useSignal();

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
      waveformSamples: data.waveform.length,
      fftBins: data.fft.length,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signalmind-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      disabled={!data}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 18px",
        background: data ? "rgba(0,229,255,0.07)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${data ? "rgba(0,229,255,0.3)" : "rgba(255,255,255,0.05)"}`,
        borderRadius: 6,
        color: data ? "#00e5ff" : "#2d3b54",
        fontFamily: "var(--font-rajdhani)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        cursor: data ? "pointer" : "not-allowed",
        textShadow: data ? "0 0 10px rgba(0,229,255,0.5)" : "none",
        boxShadow: data ? "0 0 16px rgba(0,229,255,0.08)" : "none",
        transition: "all 0.2s ease",
      }}
    >
      <Download size={12} />
      Export Report
    </button>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function SignalAnalysisPage() {
  const { data } = useSignal();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const metrics = data
    ? [
        {
          label: "File",
          value: data.fileName.length > 14 ? data.fileName.slice(0, 12) + "…" : data.fileName,
          icon: <Eye size={12} />,
          color: "#00e5ff",
        },
        {
          label: "Sample Rate",
          value: `${(data.sampleRate / 1000).toFixed(0)}`,
          unit: "kHz",
          icon: <Activity size={12} />,
          color: "#00e5ff",
        },
        {
          label: "Duration",
          value: data.duration.toFixed(2),
          unit: "s",
          icon: <TrendingUp size={12} />,
          color: "#22c55e",
        },
        {
          label: "Signal Power",
          value: data.power.toFixed(1),
          unit: "dBm",
          icon: <Zap size={12} />,
          color: "#22c55e",
        },
        {
          label: "SNR",
          value: data.snr.toFixed(1),
          unit: "dB",
          icon: <BarChart3 size={12} />,
          color: "#f59e0b",
        },
        {
          label: "Dominant Freq",
          value: data.dominantFreq.toFixed(2),
          unit: "kHz",
          icon: <Wifi size={12} />,
          color: "#a855f7",
        },
      ]
    : [
        { label: "File", value: "—", icon: <Eye size={12} />, color: "#2d3b54" },
        { label: "Sample Rate", value: "—", unit: "kHz", icon: <Activity size={12} />, color: "#2d3b54" },
        { label: "Duration", value: "—", unit: "s", icon: <TrendingUp size={12} />, color: "#2d3b54" },
        { label: "Signal Power", value: "—", unit: "dBm", icon: <Zap size={12} />, color: "#2d3b54" },
        { label: "SNR", value: "—", unit: "dB", icon: <BarChart3 size={12} />, color: "#2d3b54" },
        { label: "Dominant Freq", value: "—", unit: "kHz", icon: <Wifi size={12} />, color: "#2d3b54" },
      ];

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#030512", color: "#dfe6f0" }}>
      {/* Ambient blooms */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          style={{
            position: "absolute",
            top: -150,
            left: 80,
            width: 900,
            height: 900,
            background: "radial-gradient(ellipse at center, rgba(0,212,255,0.05) 0%, transparent 65%)",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "30%",
            right: "-10%",
            width: 700,
            height: 700,
            background: "radial-gradient(ellipse at center, rgba(168,85,247,0.045) 0%, transparent 65%)",
            borderRadius: "50%",
          }}
        />
      </div>

      <Sidebar />
      <Header />

      <main className="relative z-10" style={{ marginLeft: 156, paddingTop: 64 }}>
        {!isMounted ? (
           <div style={{ height: "100vh" }} />
        ) : (
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ── Page header ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-orbitron)",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#ffffff",
                  letterSpacing: "0.06em",
                  textShadow: "0 0 20px rgba(0,229,255,0.3)",
                }}
              >
                Signal Analysis Workspace
              </div>
              <div
                style={{
                  fontFamily: "var(--font-rajdhani)",
                  fontSize: 11,
                  color: "#3e4f6a",
                  marginTop: 3,
                  letterSpacing: "0.04em",
                }}
              >
                Advanced SDR signal inspection · real-time data from FastAPI backend
              </div>
            </div>
            <ExportButton />
          </div>

          {/* ── Metric cards row ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
            {metrics.map((m) => (
              <StatCard key={m.label} {...m} />
            ))}
          </div>

          {/* ── Charts row ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <WaveformPanel />
            <FFTPanel />
          </div>

          {/* ── Bottom row ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 280px", gap: 14 }}>
            <SignalHealthPanel />
            <AIAnalysisPanel />
            <SignalInfoPanel />
          </div>
          </div>
        )}
      </main>
    </div>
  );
}
