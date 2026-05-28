"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from "recharts";
import { ChevronDown } from "lucide-react";

import { useSignal } from "@/context/SignalContext";

const Tip = ({ active, payload, label }: any) =>
  active && payload?.length ? (
    <div style={{
      background: "rgba(3,5,16,0.98)",
      border: "1px solid rgba(168,85,247,0.3)",
      borderRadius: 6, padding: "4px 8px",
      boxShadow: "0 8px 30px rgba(0,0,0,0.8), 0 0 16px rgba(168,85,247,0.2)",
    }}>
      <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 10, color: "#d8b4fe", fontWeight: 500 }}>
        {label} kHz
      </div>
      <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 10, color: "#e2e8f0", fontWeight: 400 }}>
        {payload[0]?.value?.toFixed(1)} dB
      </div>
    </div>
  ) : null;

export default function FFTChart() {
  const { data } = useSignal();
  const chartData = useMemo(() => {
    if (!data?.fft || data.fft.length === 0) return [];
    
    const maxFFT = Math.max(...data.fft) || 1;
    const maxPts = 500;
    const step = Math.max(1, Math.floor(data.fft.length / maxPts));
    const nyquist = data.sampleRate / 2;
    const freqStep = nyquist / data.fft.length;
    
    const pts = [];
    for (let i = 0; i < data.fft.length; i += step) {
      const mag = data.fft[i] / maxFFT;
      const db = +(20 * Math.log10(mag + 1e-12)).toFixed(1);
      pts.push({ freq: +((i * freqStep) / 1000).toFixed(2), magnitude: db });
    }
    return pts;
  }, [data?.fft, data?.sampleRate]);

  return (
    <div className="relative overflow-hidden" style={{
      background: "rgba(4,7,20,0.85)",
      backdropFilter: "blur(30px) saturate(1.4)",
      border: "1px solid rgba(168,85,247,0.12)",
      borderRadius: 8,
      padding: "10px 12px 6px",
      boxShadow: "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02), inset 0 0 20px rgba(168,85,247,0.02)",
    }}>
      {/* Top purple glow */}
      <div className="absolute top-0 left-[5%] right-[5%]" style={{
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.6), transparent)",
        boxShadow: "0 0 8px rgba(168,85,247,0.4)",
      }} />

      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <span style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 12,
          fontWeight: 500,
          color: "#cbd5e1",
          letterSpacing: "0.04em",
          textShadow: "0 0 8px rgba(255,255,255,0.1)",
        }}>
          Frequency Domain (FFT)
        </span>
        <button className="flex items-center gap-1" style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 9.5,
          fontWeight: 400,
          color: "#4a5f82",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.04)",
          borderRadius: 4,
          padding: "2px 6px",
          cursor: "pointer",
          letterSpacing: "0.04em",
        }}>
          Hanning Window <ChevronDown style={{ width: 10, height: 10 }} />
        </button>
      </div>

      {/* Peak annotation */}
      <div className="absolute z-10 pointer-events-none" style={{ top: 48, left: "24%" }}>
        <div style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 9.5,
          fontWeight: 600,
          color: "#d8b4fe",
          textShadow: "0 0 12px rgba(168,85,247,0.8)",
        }}>
          {data ? `${data.dominantFreq.toFixed(2)} kHz` : "Scanning"}
        </div>
        <div style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 8.5,
          fontWeight: 500,
          color: "#a78bfa",
        }}>
          {data ? `${data.dominantMag.toFixed(1)} dB` : ""}
        </div>
      </div>

      <div className="w-full min-h-[300px] relative" style={{ height: 300, width: "100%" }}>
        {chartData.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <span style={{ fontFamily: "var(--font-rajdhani)", color: "#a78bfa", fontSize: 14, opacity: 0.6 }}>No signal data</span>
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -22, bottom: 12 }}>
            <defs>
              <linearGradient id="fftBarPeak" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#e9d5ff" stopOpacity={0.8} />
                <stop offset="40%"  stopColor="#c084fc" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.1} />
              </linearGradient>
              <filter id="purpleGlow" x="-20%" y="-50%" width="140%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="b2" />
                <feMerge>
                  <feMergeNode in="b1" />
                  <feMergeNode in="b2" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid stroke="rgba(168,85,247,0.03)" strokeDasharray="3 4" vertical={false} />
            <XAxis
              dataKey="freq" interval="preserveStartEnd" minTickGap={30}
              tick={{ fill: "#30405c", fontSize: 8.5, fontFamily: "var(--font-rajdhani)" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(168,85,247,0.05)" }}
              label={{ value: "Frequency (kHz)", position: "insideBottomRight", offset: -4, fill: "#30405c", fontSize: 8.5, fontFamily: "var(--font-rajdhani)" }}
            />
            <YAxis
              domain={[-100, 0]} tickCount={6}
              tick={{ fill: "#30405c", fontSize: 8.5, fontFamily: "var(--font-rajdhani)" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(168,85,247,0.05)" }}
              label={{ value: "Magnitude (dB)", angle: -90, position: "insideLeft", offset: 20, fill: "#30405c", fontSize: 8.5, fontFamily: "var(--font-rajdhani)" }}
            />
            <Tooltip content={<Tip />} cursor={{ stroke: "rgba(168,85,247,0.2)", strokeWidth: 1 }} />
            <Area
              type="step"
              dataKey="magnitude"
              stroke="#d946ef"
              strokeWidth={1.5}
              fill="url(#fftBarPeak)"
              fillOpacity={0.4}
              isAnimationActive={true}
              filter="url(#purpleGlow)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
