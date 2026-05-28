"use client";

import { useEffect, useRef } from "react";

interface Props { value?: number; label?: string; status?: string; }

export default function GaugeMeter({ value = 0, label = "0%", status = "--" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const W = c.offsetWidth, H = c.offsetHeight;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const cx = W / 2, cy = H * 0.6;
    const R = Math.min(W * 0.4, H * 0.65);
    const startA = (Math.PI * 5) / 4;
    const totalA = (Math.PI * 3) / 2;
    const fillA = startA + (value / 100) * totalA;

    ctx.clearRect(0, 0, W, H);

    // Outer ambient ring glow
    ctx.beginPath();
    ctx.arc(cx, cy, R + 6, startA, startA + totalA);
    ctx.strokeStyle = "rgba(34,197,94,0.06)";
    ctx.lineWidth = 18;
    ctx.lineCap = "round";
    ctx.stroke();

    // Track arc
    ctx.beginPath();
    ctx.arc(cx, cy, R, startA, startA + totalA);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.stroke();

    // Filled arc: amber → green gradient
    const g = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
    g.addColorStop(0, "#f59e0b");
    g.addColorStop(0.4, "#22c55e");
    g.addColorStop(1, "#10b981");

    ctx.beginPath();
    ctx.arc(cx, cy, R, startA, fillA);
    ctx.strokeStyle = g;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.shadowColor = "#22c55e";
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Tick marks + labels
    const ticks = [
      { p: 0, l: "0" }, { p: 0.25, l: "25" }, { p: 0.5, l: "50" },
      { p: 0.75, l: "75" }, { p: 1, l: "100" },
    ];
    ticks.forEach(({ p, l }) => {
      const a = startA + p * totalA;
      const r1 = R + 3, r2 = R + 9;
      ctx.beginPath();
      ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1.2;
      ctx.lineCap = "butt";
      ctx.stroke();

      const lr = R + 18;
      ctx.fillStyle = "rgba(100,120,155,0.85)";
      ctx.font = "bold 7.5px Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(l, cx + lr * Math.cos(a), cy + lr * Math.sin(a));
    });

    // Needle
    const nLen = R - 16;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + nLen * Math.cos(fillA), cy + nLen * Math.sin(fillA));
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 12;
    ctx.fill();
  }, [value]);

  return (
    <div className="relative flex flex-col items-center">
      <canvas ref={ref} style={{ width: "100%", height: 105 }} />
      <div className="absolute flex flex-col items-center" style={{ bottom: 10 }}>
        {label && (
          <span style={{
            fontFamily: "var(--font-rajdhani)",
            fontSize: 21, fontWeight: 700, color: "#22c55e", lineHeight: 1,
            textShadow: "0 0 18px rgba(34,197,94,0.65), 0 0 40px rgba(34,197,94,0.2)",
          }}>
            {label}
          </span>
        )}
        {status && (
          <span style={{
            fontFamily: "var(--font-rajdhani)",
            fontSize: 10, fontWeight: 600, color: "#22c55e", marginTop: 2,
            textShadow: "0 0 8px rgba(34,197,94,0.4)",
          }}>
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
