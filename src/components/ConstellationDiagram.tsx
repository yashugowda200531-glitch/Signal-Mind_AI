"use client";

import { useEffect, useRef } from "react";
import { useSignal } from "@/context/SignalContext";
import { Activity } from "lucide-react";
import { generateLiveFrame, type ModulationMetrics } from "@/lib/iqEngine";

// ─────────────────────────────────────────────────────────────────────────────
// SDR Circular Constellation Scope — Vector Signal Analyzer Style
// ─────────────────────────────────────────────────────────────────────────────
// Renders a professional circular polar scope with:
//   - Concentric amplitude rings
//   - Radial phase guide lines
//   - Angular degree ticks
//   - Modulation-specific ideal symbol markers
//   - Phosphor persistence accumulation
//   - Live canvas telemetry overlay
// ─────────────────────────────────────────────────────────────────────────────

export default function ConstellationDiagram() {
  const { data } = useSignal();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animIdRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const W = Math.floor(rect.width);
    const H = Math.floor(rect.height);
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext("2d", { alpha: false })!;

    // Phosphor persistence buffer
    const pCvs = document.createElement("canvas");
    pCvs.width = W;
    pCvs.height = H;
    const pCtx = pCvs.getContext("2d")!;
    pCtx.fillStyle = "rgb(2,4,14)";
    pCtx.fillRect(0, 0, W, H);

    // Pre-render static scope graticule to avoid redrawing every frame
    const gratCvs = document.createElement("canvas");
    gratCvs.width = W;
    gratCvs.height = H;
    const gCtx = gratCvs.getContext("2d")!;

    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.42; // Main scope radius

    // ────────────────────────────────────────────────────────────
    // DRAW STATIC GRATICULE (once, then blit every frame)
    // ────────────────────────────────────────────────────────────

    // Background
    gCtx.fillStyle = "rgb(2,4,14)";
    gCtx.fillRect(0, 0, W, H);

    // Outer scope ring glow (subtle phosphor border)
    gCtx.beginPath();
    gCtx.arc(cx, cy, R + 1, 0, Math.PI * 2);
    gCtx.strokeStyle = "rgba(0,160,210,0.25)";
    gCtx.lineWidth = 2.0;
    gCtx.stroke();

    gCtx.beginPath();
    gCtx.arc(cx, cy, R + 3, 0, Math.PI * 2);
    gCtx.strokeStyle = "rgba(0,160,210,0.08)";
    gCtx.lineWidth = 1.5;
    gCtx.stroke();

    // Dark circular fill (scope interior)
    gCtx.beginPath();
    gCtx.arc(cx, cy, R, 0, Math.PI * 2);
    gCtx.fillStyle = "rgba(0,6,20,0.6)";
    gCtx.fill();

    // Concentric amplitude rings
    const ringCount = 5;
    for (let i = 1; i <= ringCount; i++) {
      const r = (i / ringCount) * R;
      gCtx.beginPath();
      gCtx.arc(cx, cy, r, 0, Math.PI * 2);
      gCtx.strokeStyle = i === ringCount
        ? "rgba(0,160,210,0.14)"   // outer ring slightly brighter
        : "rgba(0,160,210,0.06)";
      gCtx.lineWidth = i === ringCount ? 0.8 : 0.5;
      gCtx.stroke();

      // Amplitude label on right side
      const ampVal = (i / ringCount).toFixed(1);
      gCtx.fillStyle = "rgba(0,160,210,0.22)";
      gCtx.font = "8px monospace";
      gCtx.fillText(ampVal, cx + r + 3, cy - 2);
    }

    // Crosshair axes (I and Q)
    gCtx.strokeStyle = "rgba(0,160,210,0.10)";
    gCtx.lineWidth = 0.6;
    gCtx.beginPath();
    // I-axis (horizontal)
    gCtx.moveTo(cx - R, cy);
    gCtx.lineTo(cx + R, cy);
    // Q-axis (vertical)
    gCtx.moveTo(cx, cy - R);
    gCtx.lineTo(cx, cy + R);
    gCtx.stroke();

    // 45° diagonal phase guides
    gCtx.strokeStyle = "rgba(0,160,210,0.04)";
    gCtx.lineWidth = 0.4;
    gCtx.setLineDash([3, 5]);
    for (const angle of [45, 135, 225, 315]) {
      const rad = (angle * Math.PI) / 180;
      gCtx.beginPath();
      gCtx.moveTo(cx, cy);
      gCtx.lineTo(cx + Math.cos(rad) * R, cy - Math.sin(rad) * R);
      gCtx.stroke();
    }
    gCtx.setLineDash([]);

    // Angular degree ticks around outer ring
    gCtx.fillStyle = "rgba(0,160,210,0.20)";
    gCtx.font = "7px monospace";
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const innerR = R - 3;
      const outerR = R + 1;

      // Tick mark
      gCtx.beginPath();
      gCtx.moveTo(cx + Math.cos(rad) * innerR, cy - Math.sin(rad) * innerR);
      gCtx.lineTo(cx + Math.cos(rad) * outerR, cy - Math.sin(rad) * outerR);
      gCtx.strokeStyle = deg % 90 === 0
        ? "rgba(0,160,210,0.20)"
        : "rgba(0,160,210,0.08)";
      gCtx.lineWidth = deg % 90 === 0 ? 1.0 : 0.5;
      gCtx.stroke();

      // Degree label every 45°
      if (deg % 45 === 0) {
        const labelR = R + 10;
        const lx = cx + Math.cos(rad) * labelR;
        const ly = cy - Math.sin(rad) * labelR;
        gCtx.fillStyle = "rgba(0,160,210,0.22)";
        gCtx.textAlign = "center";
        gCtx.textBaseline = "middle";
        gCtx.fillText(`${deg}°`, lx, ly);
      }
    }
    gCtx.textAlign = "start";
    gCtx.textBaseline = "alphabetic";

    // Axis labels
    gCtx.font = "9px monospace";
    gCtx.fillStyle = "rgba(0,180,230,0.30)";
    gCtx.fillText("I (In-Phase)", cx + R - 50, cy + 14);
    gCtx.fillText("Q (Quad)", cx + 5, cy - R + 14);
    gCtx.fillText("-I", cx - R + 4, cy + 12);
    gCtx.fillText("-Q", cx + 5, cy + R - 6);

    // Center origin crosshair marker
    gCtx.strokeStyle = "rgba(0,180,230,0.18)";
    gCtx.lineWidth = 0.5;
    gCtx.beginPath();
    gCtx.moveTo(cx - 4, cy); gCtx.lineTo(cx + 4, cy);
    gCtx.moveTo(cx, cy - 4); gCtx.lineTo(cx, cy + 4);
    gCtx.stroke();

    // ────────────────────────────────────────────────────────────
    // RENDER LOOP
    // ────────────────────────────────────────────────────────────
    let lastDraw = 0;
    let latestMetrics: ModulationMetrics | null = null;

    const renderLoop = (time: number) => {
      if (time - lastDraw < 33) { // ~30fps
        animIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }
      lastDraw = time;

      const modType = data?.modulation || data?.modMetrics?.type || "QPSK";
      const snrDb = data?.snr ?? 20;

      const { points, metrics } = generateLiveFrame(modType, snrDb, 200);
      latestMetrics = metrics;

      // ── 1. Phosphor decay ──
      pCtx.globalCompositeOperation = "source-over";
      pCtx.fillStyle = "rgba(2,4,14,0.20)";
      pCtx.fillRect(0, 0, W, H);

      // ── 2. Stamp symbols ──
      pCtx.globalCompositeOperation = "lighter";

      // Clip to scope circle for symbol stamping
      pCtx.save();
      pCtx.beginPath();
      pCtx.arc(cx, cy, R - 1, 0, Math.PI * 2);
      pCtx.clip();

      // Pass A: Soft halo
      pCtx.fillStyle = "rgba(0,170,230,0.05)";
      for (const pt of points) {
        const px = cx + pt.i * R;
        const py = cy - pt.q * R;
        pCtx.beginPath();
        pCtx.arc(px, py, 2.0, 0, 6.283);
        pCtx.fill();
      }

      // Pass B: Bright core
      pCtx.fillStyle = "rgba(160,220,255,0.30)";
      for (const pt of points) {
        const px = cx + pt.i * R;
        const py = cy - pt.q * R;
        pCtx.beginPath();
        pCtx.arc(px, py, 0.8, 0, 6.283);
        pCtx.fill();
      }

      pCtx.restore(); // Remove clip
      pCtx.globalCompositeOperation = "source-over";

      // ── 3. Compose final frame ──
      // Blit graticule (static)
      ctx.drawImage(gratCvs, 0, 0);

      // Blit persistence layer (symbols)
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(pCvs, 0, 0);
      ctx.globalCompositeOperation = "source-over";

      // ── 4. Ideal symbol reference markers ──
      // Draw modulation-specific ideal points as dim crosshairs
      const drawIdealMarker = (iVal: number, qVal: number, size: number) => {
        const sx = cx + iVal * R;
        const sy = cy - qVal * R;
        ctx.beginPath();
        ctx.moveTo(sx - size, sy); ctx.lineTo(sx + size, sy);
        ctx.moveTo(sx, sy - size); ctx.lineTo(sx, sy + size);
        ctx.stroke();
      };

      ctx.strokeStyle = "rgba(0,200,255,0.12)";
      ctx.lineWidth = 0.5;

      const mKey = modType.toUpperCase();
      if (mKey.includes("QPSK") || mKey === "QPSK") {
        for (const si of [-0.707, 0.707]) {
          for (const sq of [-0.707, 0.707]) {
            drawIdealMarker(si, sq, 4);
          }
        }
      } else if (mKey.includes("BPSK") || mKey === "BPSK") {
        drawIdealMarker(-1, 0, 4);
        drawIdealMarker(1, 0, 4);
      } else if (mKey.includes("8PSK")) {
        for (let k = 0; k < 8; k++) {
          const angle = (k * Math.PI) / 4;
          drawIdealMarker(Math.cos(angle), Math.sin(angle), 3);
        }
      } else if (mKey.includes("16") && mKey.includes("QAM")) {
        const vals = [-0.948, -0.316, 0.316, 0.948];
        ctx.strokeStyle = "rgba(0,200,255,0.06)";
        for (const vi of vals) {
          for (const vq of vals) {
            drawIdealMarker(vi, vq, 2);
          }
        }
      } else if (mKey.includes("64") && mKey.includes("QAM")) {
        const vals = [-1.0, -0.714, -0.428, -0.142, 0.142, 0.428, 0.714, 1.0];
        ctx.strokeStyle = "rgba(0,200,255,0.04)";
        for (const vi of vals) {
          for (const vq of vals) {
            drawIdealMarker(vi, vq, 1.5);
          }
        }
      }

      // ── 5. Canvas-native telemetry panel ──
      if (latestMetrics) {
        const m = latestMetrics;
        const pad = 5;
        const lh = 11;
        const pW = 118;
        const rows = [
          { l: "MOD",   v: m.type,                           c: "#00b8e0" },
          { l: "EVM",   v: `${m.evm.toFixed(1)}%`,           c: "#a078d0" },
          { l: "CONF",  v: `${m.confidence.toFixed(0)}%`,    c: m.confidence > 75 ? "#40b870" : "#d0a040" },
          { l: "BAUD",  v: m.baudRate > 0 ? `${Math.round(m.baudRate)} Bd` : "—", c: "#608898" },
          { l: "Φ ERR", v: `${m.phaseError.toFixed(1)}°`,    c: "#c05050" },
          { l: "LOCK",  v: m.carrierLock ? "LOCKED" : "SEARCH", c: m.carrierLock ? "#40b870" : "#d0a040" },
        ];
        const pH = lh * rows.length + pad * 2;
        const panelX = pad + 2;
        const panelY = H - pH - pad - 2;

        ctx.fillStyle = "rgba(2,4,14,0.85)";
        ctx.strokeStyle = "rgba(0,140,200,0.10)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.roundRect(panelX, panelY, pW, pH, 3);
        ctx.fill();
        ctx.stroke();

        ctx.font = "8px monospace";
        rows.forEach((r, i) => {
          const ry = panelY + pad + i * lh + 8;
          ctx.fillStyle = "#2e4258";
          ctx.fillText(r.l, panelX + pad, ry);
          ctx.fillStyle = r.c;
          ctx.fillText(r.v, panelX + 46, ry);
        });
      }

      // ── 6. Scope corner labels ──
      ctx.font = "7px monospace";
      ctx.fillStyle = "rgba(0,160,210,0.16)";
      ctx.fillText("CARRIER LOCK", 6, 12);
      ctx.fillText(latestMetrics?.carrierLock ? "● LOCKED" : "○ SEARCH", 6, 22);
      ctx.fillText("DRIFT", W - 40, 12);
      ctx.fillText(`${(latestMetrics?.driftRate ?? 0).toFixed(3)}`, W - 40, 22);

      animIdRef.current = requestAnimationFrame(renderLoop);
    };

    animIdRef.current = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animIdRef.current);
  }, [data]);

  return (
    <div
      className="relative overflow-hidden flex flex-col"
      style={{
        background: "rgba(2,4,14,0.92)",
        backdropFilter: "blur(30px) saturate(1.4)",
        border: "1px solid rgba(0,160,210,0.12)",
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: "0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.02), inset 0 0 20px rgba(0,160,210,0.015)",
        height: "100%",
      }}
    >
      <div className="absolute top-0 left-[5%] right-[5%]" style={{
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(0,160,210,0.4), transparent)",
        boxShadow: "0 0 6px rgba(0,160,210,0.2)",
      }} />

      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <span style={{
          fontFamily: "var(--font-rajdhani)", fontSize: 12, fontWeight: 500,
          color: "#8a9ab4", letterSpacing: "0.04em",
        }}>
          Complex Baseband (I/Q)
        </span>
        {data?.modMetrics && (
          <div className="flex items-center gap-1" style={{
            fontFamily: "var(--font-rajdhani)", fontSize: 9, fontWeight: 600,
            color: "#00a0d0", background: "rgba(0,160,210,0.04)",
            border: "1px solid rgba(0,160,210,0.15)", borderRadius: 3, padding: "1px 5px",
          }}>
            <Activity style={{ width: 8, height: 8 }} />
            LIVE
          </div>
        )}
      </div>

      <div className="relative flex-1 w-full min-h-0 rounded" style={{
        background: "rgb(2,4,14)",
        border: "1px solid rgba(0,160,210,0.06)",
      }}>
        {!data && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
            <Activity className="w-5 h-5 text-[#3a4f6a] animate-pulse" />
            <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 11, color: "#3a4f6a" }}>
              Awaiting I/Q Stream
            </span>
          </div>
        )}
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>
    </div>
  );
}
