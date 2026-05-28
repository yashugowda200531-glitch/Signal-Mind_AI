"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { ChevronDown } from "lucide-react";

import { useSignal } from "@/context/SignalContext";

const Tip = ({ active, payload, label }: any) =>
  active && payload?.length ? (
    <div style={{
      background: "rgba(3,5,16,0.98)",
      border: "1px solid rgba(0,212,255,0.25)",
      borderRadius: 6,
      padding: "4px 8px",
      boxShadow: "0 8px 30px rgba(0,0,0,0.8), 0 0 12px rgba(0,212,255,0.15)",
    }}>
      <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 10, color: "#00d4ff", fontWeight: 500 }}>
        t = {label} s
      </div>
      <div style={{ fontFamily: "var(--font-rajdhani)", fontSize: 10, color: "#cbd5e1", fontWeight: 400 }}>
        A = {payload[0]?.value?.toFixed(4)}
      </div>
    </div>
  ) : null;

export default function SignalChart() {
  const { data } = useSignal();
  const chartData = useMemo(() => {
    if (!data?.waveform || data.waveform.length === 0) return [];
    
    // Backend normalizes waveform to [-1, 1], so we can just use the raw values
    const maxPts = 800;
    const step = Math.max(1, Math.floor(data.waveform.length / maxPts));
    const pts = [];
    for (let i = 0; i < data.waveform.length; i += step) {
      pts.push({ 
        t: +(i / data.sampleRate).toFixed(4), 
        value: data.waveform[i]
      });
    }
    return pts;
  }, [data?.waveform, data?.sampleRate]);

  return (
    <div className="relative overflow-hidden" style={{
      background: "rgba(4,7,20,0.85)",
      backdropFilter: "blur(30px) saturate(1.4)",
      border: "1px solid rgba(0,212,255,0.1)",
      borderRadius: 8,
      padding: "10px 12px 6px",
      boxShadow: "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02), inset 0 0 20px rgba(0,212,255,0.02)",
    }}>
      {/* Top glow line */}
      <div className="absolute top-0 left-[5%] right-[5%]" style={{
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)",
        boxShadow: "0 0 8px rgba(0,212,255,0.4)",
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
          Time Domain Signal
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
          ◀ Real-time <ChevronDown style={{ width: 10, height: 10 }} />
        </button>
      </div>

      <div className="w-full min-h-[300px] relative" style={{ height: 300, width: "100%" }}>
        {chartData.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <span style={{ fontFamily: "var(--font-rajdhani)", color: "#00d4ff", fontSize: 14, opacity: 0.6 }}>No signal data</span>
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 12 }}>
            <defs>
              <linearGradient id="cyanLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#00a8e8" stopOpacity={0.8} />
                <stop offset="30%"  stopColor="#00ffff" stopOpacity={1} />
                <stop offset="70%"  stopColor="#00d4ff" stopOpacity={1} />
                <stop offset="100%" stopColor="#00a8e8" stopOpacity={0.8} />
              </linearGradient>
              <filter id="cyanBloom" x="-20%" y="-50%" width="140%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b2" />
                <feMerge>
                  <feMergeNode in="b1" />
                  <feMergeNode in="b2" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid stroke="rgba(0,212,255,0.03)" strokeDasharray="3 4" />
            <XAxis
              dataKey="t" interval={24} tickFormatter={(v: number) => v.toFixed(1)}
              tick={{ fill: "#30405c", fontSize: 8.5, fontFamily: "var(--font-rajdhani)" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(0,212,255,0.05)" }}
              label={{ value: "Time (s)", position: "insideBottomRight", offset: -4, fill: "#30405c", fontSize: 8.5, fontFamily: "var(--font-rajdhani)" }}
            />
            <YAxis
              domain={[-1.1, 1.1]} tickCount={5}
              tick={{ fill: "#30405c", fontSize: 8.5, fontFamily: "var(--font-rajdhani)" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(0,212,255,0.05)" }}
              label={{ value: "Amplitude", angle: -90, position: "insideLeft", offset: 24, fill: "#30405c", fontSize: 8.5, fontFamily: "var(--font-rajdhani)" }}
            />
            <Tooltip content={<Tip />} cursor={{ stroke: "rgba(0,212,255,0.1)", strokeWidth: 1 }} />
            <ReferenceLine y={0} stroke="rgba(0,212,255,0.1)" strokeDasharray="2 4" />
            <Line
              type="monotone" dataKey="value"
              stroke="#00e5ff" strokeWidth={2}
              strokeOpacity={1}
              dot={false}
              isAnimationActive={true}
              activeDot={{ r: 4, fill: "#00ffff", stroke: "#005bea", strokeWidth: 1 }}
              style={{ filter: "drop-shadow(0 0 8px #00e5ff)" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
