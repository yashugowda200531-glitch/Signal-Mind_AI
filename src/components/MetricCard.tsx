"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface Props {
  label: string;
  value: string;
  unit: string;
  status: string;
  statusColor: string;
  icon: ReactNode;
  glowColor: string;
  index?: number;
}

export default function MetricCard({
  label, value, unit, status, statusColor, icon, glowColor, index = 0,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: "easeOut" }}
      whileHover={{
        y: -2,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${glowColor}15, inset 0 1px 0 rgba(255,255,255,0.06)`,
        transition: { duration: 0.2 },
      }}
      className="relative overflow-hidden group"
      style={{
        background: "rgba(4,7,20,0.85)",
        backdropFilter: "blur(30px) saturate(1.4)",
        border: "1px solid rgba(0,212,255,0.12)",
        borderRadius: 10,
        padding: "11px 13px 10px",
        boxShadow: "0 8px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03)",
        cursor: "default",
      }}
    >
      {/* Top gradient line */}
      <div className="absolute top-0 left-[15%] right-[15%]" style={{
        height: 1,
        background: `linear-gradient(90deg, transparent, ${glowColor}60, transparent)`,
      }} />

      {/* Hover radial glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500"
        style={{ background: `radial-gradient(ellipse at 50% 30%, ${glowColor}06 0%, transparent 65%)` }}
      />

      {/* Label + icon */}
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <span style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 10.5,
          fontWeight: 500,
          color: "#4a5f82",
          letterSpacing: "0.03em",
        }}>
          {label}
        </span>
        <div className="flex items-center justify-center rounded-lg" style={{
          width: 28, height: 28,
          background: `${glowColor}0c`,
          border: `1px solid ${glowColor}1a`,
          boxShadow: `0 0 8px ${glowColor}0a`,
        }}>
          {icon}
        </div>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1" style={{ marginBottom: 3 }}>
        <span style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 24,
          fontWeight: 700,
          color: glowColor,
          lineHeight: 1,
          letterSpacing: "-0.01em",
          textShadow: `0 0 18px ${glowColor}55, 0 0 40px ${glowColor}20`,
        }}>
          {value}
        </span>
        <span style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 13,
          fontWeight: 600,
          color: "#6b7f9e",
        }}>
          {unit}
        </span>
      </div>

      {/* Status */}
      <span style={{
        fontFamily: "var(--font-rajdhani)",
        fontSize: 10.5,
        fontWeight: 600,
        color: statusColor,
        letterSpacing: "0.02em",
        textShadow: `0 0 8px ${statusColor}40`,
      }}>
        {status}
      </span>
    </motion.div>
  );
}
