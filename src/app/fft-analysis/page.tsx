"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import {
  BarChart3,
  Activity,
  Wifi,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  TrendingUp,
  Radio,
  Layers,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useSignal } from "@/context/SignalContext";

/* ── helpers ─────────────────────────────────────────────────────────────── */
function formatHz(khz: number) {
  if (khz >= 1000) return `${(khz / 1000).toFixed(2)} MHz`;
  return `${khz.toFixed(2)} kHz`;
}

/* ── Shared UI atoms ─────────────────────────────────────────────────────── */
function StatCard({ label, value, unit, icon, color }: {
  label: string; value: string; unit?: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div style={{
      background: "rgba(4,7,20,0.85)", backdropFilter: "blur(20px)",
      border: `1px solid ${color}22`, borderRadius: 8,
      padding: "10px 14px", position: "relative", overflow: "hidden",
      boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px ${color}11`,
    }}>
      <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1,
        background: `linear-gradient(90deg, transparent, ${color}80, transparent)` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ color }}>{icon}</div>
        <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 10, fontWeight: 500,
          color: "#4a5f82", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontFamily: "var(--font-orbitron)", fontSize: 18, fontWeight: 700,
          color: value === "—" ? "#2d3b54" : color,
          textShadow: value !== "—" ? `0 0 16px ${color}80` : "none", letterSpacing: "0.04em" }}>{value}</span>
        {unit && <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 11, color: "#4a5f82", fontWeight: 500 }}>{unit}</span>}
      </div>
    </div>
  );
}

function PanelCard({ children, bc = "rgba(168,85,247,0.12)", gc = "rgba(168,85,247,0.02)" }: {
  children: React.ReactNode; bc?: string; gc?: string;
}) {
  return (
    <div style={{
      background: "rgba(4,7,20,0.85)", backdropFilter: "blur(30px) saturate(1.4)",
      border: `1px solid ${bc}`, borderRadius: 8, padding: "12px 14px",
      boxShadow: `0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02), inset 0 0 20px ${gc}`,
      position: "relative", overflow: "hidden",
    }}>{children}</div>
  );
}

/* ── Main FFT spectrum chart with zoom ───────────────────────────────────── */
function FFTSpectrumPanel() {
  const { data } = useSignal();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(0);

  const MAX_PTS = 800;

  const allPts = useMemo(() => {
    if (!data?.fft?.length) return [];
    const maxFFT = Math.max(...data.fft) || 1;
    const nyquist = data.sampleRate / 2;
    const freqStep = nyquist / data.fft.length;
    const step = Math.max(1, Math.floor(data.fft.length / MAX_PTS));
    const pts: { freq: number; magnitude: number }[] = [];
    for (let i = 0; i < data.fft.length; i += step) {
      const mag = data.fft[i] / maxFFT;
      const db = +(20 * Math.log10(mag + 1e-12)).toFixed(1);
      pts.push({ freq: +((i * freqStep) / 1000).toFixed(3), magnitude: db });
    }
    return pts;
  }, [data]);

  const chartData = useMemo(() => {
    if (!allPts.length) return [];
    const windowSize = Math.max(1, Math.floor(allPts.length / zoom));
    const maxOff = allPts.length - windowSize;
    const start = Math.round(offset * maxOff);
    return allPts.slice(start, start + windowSize);
  }, [allPts, zoom, offset]);

  const handleZoomIn = () => setZoom(z => Math.min(z * 2, 64));
  const handleZoomOut = () => setZoom(z => Math.max(z / 2, 1));
  const handleReset = () => { setZoom(1); setOffset(0); };

  const Tip = ({ active, payload }: any) =>
    active && payload?.length ? (
      <div style={{ background: "rgba(3,5,16,0.98)", border: "1px solid rgba(168,85,247,0.3)",
        borderRadius: 6, padding: "5px 10px" }}>
        <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 11, color: "#d8b4fe" }}>
          {payload[0]?.payload?.freq} kHz
        </div>
        <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 11, color: "#e2e8f0" }}>
          {payload[0]?.value?.toFixed(1)} dB
        </div>
      </div>
    ) : null;

  return (
    <PanelCard>
      <div style={{ position: "absolute", top: 0, left: "5%", right: "5%", height: 1,
        background: "linear-gradient(90deg,transparent,rgba(168,85,247,0.7),transparent)",
        boxShadow: "0 0 8px rgba(168,85,247,0.4)" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 12, fontWeight: 600,
            color: "#cbd5e1", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Full Frequency Spectrum
          </span>
          {data && (
            <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 10, color: "#3e4f6a",
              marginLeft: 8, letterSpacing: "0.04em" }}>
              {data.fft.length.toLocaleString()} bins · Nyquist {(data.sampleRate / 2000).toFixed(1)} kHz
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { icon: <ZoomIn size={12} />, fn: handleZoomIn, l: "Zoom In" },
            { icon: <ZoomOut size={12} />, fn: handleZoomOut, l: "Zoom Out" },
            { icon: <RotateCcw size={12} />, fn: handleReset, l: "Reset" },
          ].map(({ icon, fn, l }) => (
            <button key={l} onClick={fn} title={l} style={{
              background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.15)",
              borderRadius: 4, padding: "3px 7px", color: "#d8b4fe", cursor: "pointer",
              display: "flex", alignItems: "center",
            }}>{icon}</button>
          ))}
        </div>
      </div>

      {zoom > 1 && (
        <div style={{ marginBottom: 8 }}>
          <input type="range" min={0} max={1} step={0.001} value={offset}
            onChange={e => setOffset(+e.target.value)}
            style={{ width: "100%", accentColor: "#d8b4fe", height: 2 }} />
          <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 9, color: "#3e4f6a", textAlign: "center" }}>
            Pan — {(offset * 100).toFixed(0)}%
          </div>
        </div>
      )}

      {chartData.length === 0 ? (
        <div style={{ height: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-rajdhani)", color: "#2d3b54", fontSize: 13 }}>
            No signal data — upload a WAV file
          </span>
        </div>
      ) : (
        <div style={{ height: 340 }}>
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={chartData} margin={{ top: 6, right: 4, left: -20, bottom: 10 }}>
              <defs>
                <linearGradient id="fftGradFull" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d946ef" stopOpacity={0.7} />
                  <stop offset="40%" stopColor="#a855f7" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.05} />
                </linearGradient>
                <filter id="fftGlowFull" x="-20%" y="-50%" width="140%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <CartesianGrid stroke="rgba(168,85,247,0.04)" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="freq" interval="preserveStartEnd" minTickGap={40}
                tick={{ fill: "#2d3b54", fontSize: 8.5, fontFamily: "var(--font-rajdhani)" }}
                tickLine={false} axisLine={{ stroke: "rgba(168,85,247,0.06)" }}
                label={{ value: "Frequency (kHz)", position: "insideBottomRight", offset: -4, fill: "#2d3b54", fontSize: 8.5 }} />
              <YAxis domain={[-100, 0]} tickCount={6}
                tick={{ fill: "#2d3b54", fontSize: 8.5, fontFamily: "var(--font-rajdhani)" }}
                tickLine={false} axisLine={{ stroke: "rgba(168,85,247,0.06)" }}
                label={{ value: "dB", angle: -90, position: "insideLeft", offset: 22, fill: "#2d3b54", fontSize: 8.5 }} />
              <Tooltip content={<Tip />} cursor={{ stroke: "rgba(168,85,247,0.25)", strokeWidth: 1 }} />
              {data && (
                <>
                  <ReferenceLine x={Math.max(0, data.dominantFreq - data.bandwidth / 2)}
                    stroke="rgba(245,158,11,0.5)" strokeDasharray="4 3" strokeWidth={1} />
                  <ReferenceLine x={data.dominantFreq + data.bandwidth / 2}
                    stroke="rgba(245,158,11,0.5)" strokeDasharray="4 3" strokeWidth={1} />
                  <ReferenceLine x={data.dominantFreq} stroke="rgba(0,229,255,0.6)" strokeWidth={1.5}
                    label={{ value: `${data.dominantFreq.toFixed(2)} kHz`, fill: "#00e5ff", fontSize: 9, position: "top" }} />
                </>
              )}
              <Area type="step" dataKey="magnitude" stroke="#d946ef" strokeWidth={1.5}
                fill="url(#fftGradFull)" fillOpacity={1} isAnimationActive={false} filter="url(#fftGlowFull)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </PanelCard>
  );
}

/* ── Spectral Peak Table ─────────────────────────────────────────────────── */
function PeakTable() {
  const { data } = useSignal();

  const peaks = useMemo(() => {
    if (!data?.fft?.length) return [];
    const maxFFT = Math.max(...data.fft) || 1;
    const nyquist = data.sampleRate / 2;
    const freqStep = nyquist / data.fft.length;
    const threshold = maxFFT * 0.05;

    const rawPeaks: { freq: number; mag: number; db: number }[] = [];
    for (let i = 1; i < data.fft.length - 1; i++) {
      if (data.fft[i] >= threshold && data.fft[i] >= data.fft[i - 1] && data.fft[i] >= data.fft[i + 1]) {
        const freqKHz = (i * freqStep) / 1000;
        const db = +(20 * Math.log10(data.fft[i] / maxFFT + 1e-12)).toFixed(1);
        rawPeaks.push({ freq: freqKHz, mag: data.fft[i], db });
      }
    }
    rawPeaks.sort((a, b) => b.mag - a.mag);
    return rawPeaks.slice(0, 8).map((p, idx) => {
      let cls = "Sideband";
      if (idx === 0) cls = "Primary";
      else if (data.dominantFreq > 0) {
        const ratio = p.freq / data.dominantFreq;
        if (Math.abs(ratio - Math.round(ratio)) < 0.08 && Math.round(ratio) >= 2) cls = "Harmonic";
      }
      return { rank: idx + 1, freq: p.freq.toFixed(2), db: p.db, classification: cls };
    });
  }, [data]);

  const clsColor: Record<string, string> = { Primary: "#00e5ff", Harmonic: "#f59e0b", Sideband: "#a855f7" };

  return (
    <PanelCard bc="rgba(0,212,255,0.1)" gc="rgba(0,212,255,0.02)">
      <div style={{ position: "absolute", top: 0, left: "5%", right: "5%", height: 1,
        background: "linear-gradient(90deg,transparent,rgba(0,229,255,0.6),transparent)",
        boxShadow: "0 0 8px rgba(0,229,255,0.3)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <TrendingUp size={13} style={{ color: "#00e5ff" }} />
        <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 12, fontWeight: 600,
          color: "#cbd5e1", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Spectral Peaks
        </span>
      </div>

      {peaks.length === 0 ? (
        <div style={{ minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-rajdhani)", color: "#2d3b54", fontSize: 12 }}>No data</span>
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["#", "Freq (kHz)", "Mag (dB)", "Type"].map(h => (
                <th key={h} style={{ fontFamily: "var(--font-rajdhani)", fontSize: 9.5, fontWeight: 600,
                  color: "#45597a", letterSpacing: "0.04em", paddingBottom: 6,
                  borderBottom: "1px solid rgba(255,255,255,0.04)", textAlign: "left", paddingRight: 8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {peaks.map(p => (
              <tr key={p.rank}>
                <td style={{ fontFamily: "var(--font-rajdhani)", fontSize: 10.5, color: "#4a5f82",
                  padding: "5px 8px 5px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>{p.rank}</td>
                <td style={{ fontFamily: "var(--font-orbitron)", fontSize: 10, color: "#00e5ff",
                  padding: "5px 8px 5px 0", borderBottom: "1px solid rgba(255,255,255,0.02)",
                  textShadow: "0 0 8px rgba(0,229,255,0.5)" }}>{p.freq}</td>
                <td style={{ fontFamily: "var(--font-rajdhani)", fontSize: 10.5, color: "#cbd5e1",
                  padding: "5px 8px 5px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>{p.db}</td>
                <td style={{ padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                  <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 9.5, fontWeight: 600,
                    color: clsColor[p.classification] || "#a855f7", padding: "1px 6px",
                    background: `${clsColor[p.classification] || "#a855f7"}12`, borderRadius: 4 }}>
                    {p.classification}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PanelCard>
  );
}

/* ── Bandwidth Analysis Panel ────────────────────────────────────────────── */
function BandwidthPanel() {
  const { data } = useSignal();

  const rows = data ? [
    { label: "Occupied BW (-10 dB)", value: `${data.bandwidth.toFixed(2)} kHz`, color: "#d8b4fe" },
    { label: "Dominant Frequency", value: formatHz(data.dominantFreq), color: "#00e5ff" },
    { label: "Peak Magnitude", value: `${data.dominantMag.toFixed(1)} dBm`, color: "#f59e0b" },
    { label: "Spectral Flatness", value: data.spectralFlatness.toFixed(4), color: "#22c55e" },
    { label: "Data Rate (Shannon)", value: `${data.dataRate.toFixed(1)} kbps`, color: "#00e5ff" },
    { label: "Signal Type", value: data.signalType, color: "#d8b4fe" },
    { label: "Modulation", value: data.modulation, color: "#00e5ff" },
    { label: "Confidence", value: `${data.confidence.toFixed(1)}%`, color: "#22c55e" },
  ] : [];

  return (
    <PanelCard>
      <div style={{ position: "absolute", top: 0, left: "5%", right: "5%", height: 1,
        background: "linear-gradient(90deg,transparent,rgba(168,85,247,0.7),transparent)",
        boxShadow: "0 0 8px rgba(168,85,247,0.4)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Layers size={13} style={{ color: "#a855f7" }} />
        <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 12, fontWeight: 600,
          color: "#cbd5e1", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Bandwidth & Classification
        </span>
      </div>

      {!data ? (
        <div style={{ minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-rajdhani)", color: "#2d3b54", fontSize: 12 }}>No data</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.025)" }}>
              <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 10.5, color: "#4a5f82", fontWeight: 500 }}>{r.label}</span>
              <span style={{ fontFamily: "var(--font-orbitron)", fontSize: 10, color: r.color, fontWeight: 600,
                textShadow: `0 0 8px ${r.color}60` }}>{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}

/* ── Export button ────────────────────────────────────────────────────────── */
function ExportFFTButton() {
  const { data } = useSignal();
  const handleExport = () => {
    if (!data) return;
    const report = {
      generated: new Date().toISOString(),
      type: "FFT Analysis Report",
      file: data.fileName,
      sampleRate: data.sampleRate,
      fftBins: data.fft.length,
      dominantFrequencyKHz: data.dominantFreq,
      peakMagnitudeDbm: data.dominantMag,
      bandwidthKHz: data.bandwidth,
      spectralFlatness: data.spectralFlatness,
      modulation: data.modulation,
      signalType: data.signalType,
      confidence: data.confidence,
      dataRateKbps: data.dataRate,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `fft-report-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button onClick={handleExport} disabled={!data} style={{
      display: "flex", alignItems: "center", gap: 6, padding: "8px 18px",
      background: data ? "rgba(168,85,247,0.07)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${data ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.05)"}`,
      borderRadius: 6, color: data ? "#d8b4fe" : "#2d3b54",
      fontFamily: "var(--font-rajdhani)", fontSize: 11, fontWeight: 600,
      letterSpacing: "0.08em", cursor: data ? "pointer" : "not-allowed",
      textShadow: data ? "0 0 10px rgba(168,85,247,0.5)" : "none",
      boxShadow: data ? "0 0 16px rgba(168,85,247,0.08)" : "none",
    }}>
      <Download size={12} /> Export FFT Report
    </button>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function FFTAnalysisPage() {
  const { data } = useSignal();

  const metrics = data ? [
    { label: "Dominant Freq", value: data.dominantFreq.toFixed(2), unit: "kHz",
      icon: <Wifi size={12} />, color: "#00e5ff" },
    { label: "Peak Magnitude", value: data.dominantMag.toFixed(1), unit: "dBm",
      icon: <BarChart3 size={12} />, color: "#d8b4fe" },
    { label: "Bandwidth", value: data.bandwidth.toFixed(2), unit: "kHz",
      icon: <Radio size={12} />, color: "#f59e0b" },
    { label: "Spectral Flatness", value: data.spectralFlatness.toFixed(3), unit: "",
      icon: <Layers size={12} />, color: "#22c55e" },
    { label: "Sample Rate", value: `${(data.sampleRate / 1000).toFixed(0)}`, unit: "kHz",
      icon: <Activity size={12} />, color: "#00e5ff" },
    { label: "FFT Bins", value: data.fft.length.toLocaleString(), unit: "",
      icon: <TrendingUp size={12} />, color: "#a855f7" },
  ] : [
    { label: "Dominant Freq", value: "—", unit: "kHz", icon: <Wifi size={12} />, color: "#2d3b54" },
    { label: "Peak Magnitude", value: "—", unit: "dBm", icon: <BarChart3 size={12} />, color: "#2d3b54" },
    { label: "Bandwidth", value: "—", unit: "kHz", icon: <Radio size={12} />, color: "#2d3b54" },
    { label: "Spectral Flatness", value: "—", icon: <Layers size={12} />, color: "#2d3b54" },
    { label: "Sample Rate", value: "—", unit: "kHz", icon: <Activity size={12} />, color: "#2d3b54" },
    { label: "FFT Bins", value: "—", icon: <TrendingUp size={12} />, color: "#2d3b54" },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "#030512", color: "#dfe6f0" }}>
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div style={{ position: "absolute", top: -150, left: 80, width: 900, height: 900,
          background: "radial-gradient(ellipse at center, rgba(168,85,247,0.05) 0%, transparent 65%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", top: "40%", right: "-8%", width: 700, height: 700,
          background: "radial-gradient(ellipse at center, rgba(0,212,255,0.04) 0%, transparent 65%)", borderRadius: "50%" }} />
      </div>

      <Sidebar />
      <Header />

      <main className="relative z-10" style={{ marginLeft: 156, paddingTop: 64 }}>
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Page header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--font-orbitron)", fontSize: 16, fontWeight: 700,
                color: "#ffffff", letterSpacing: "0.06em", textShadow: "0 0 20px rgba(168,85,247,0.3)" }}>
                FFT Analysis Workspace
              </div>
              <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 11, color: "#3e4f6a",
                marginTop: 3, letterSpacing: "0.04em" }}>
                Frequency domain spectral analysis · peak detection · bandwidth measurement
              </div>
            </div>
            <ExportFFTButton />
          </div>

          {/* Metric cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
            {metrics.map(m => <StatCard key={m.label} {...m} />)}
          </div>

          {/* Main FFT spectrum */}
          <FFTSpectrumPanel />

          {/* Bottom: Peak Table + Bandwidth Analysis */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <PeakTable />
            <BandwidthPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
