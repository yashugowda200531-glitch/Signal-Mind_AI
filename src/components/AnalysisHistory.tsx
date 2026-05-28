"use client";

import { motion } from "framer-motion";
import { Clock, ChevronDown } from "lucide-react";
import { useSignal } from "@/context/SignalContext";

const COLS = ["File Name", "Type", "Duration", "Analysis Time", "Quality", "Status"];

export default function AnalysisHistory() {
  const { history } = useSignal();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="relative overflow-hidden"
      style={{
        background: "rgba(4,7,20,0.85)",
        backdropFilter: "blur(30px) saturate(1.4)",
        border: "1px solid rgba(0,212,255,0.1)",
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: "0 8px 30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02)",
      }}
    >
      <div className="absolute top-0 left-[12%] right-[12%]" style={{
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)",
        boxShadow: "0 0 8px rgba(0,212,255,0.3)",
      }} />

      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center rounded" style={{
            width: 20, height: 20,
            background: "rgba(0,212,255,0.10)",
            border: "1px solid rgba(0,212,255,0.22)",
          }}>
            <Clock style={{ width: 11, height: 11, color: "#00d4ff" }} strokeWidth={2} />
          </div>
          <span style={{
            fontFamily: "var(--font-rajdhani)",
            fontSize: 12.5, fontWeight: 600, color: "#d0dae8", letterSpacing: "0.02em",
          }}>
            Recent Analysis History
          </span>
        </div>
        <button className="flex items-center gap-1" style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 9.5, fontWeight: 400, color: "#4a5f82",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.04)",
          borderRadius: 4, padding: "2px 6px", cursor: "pointer",
        }}>
          Last 24 Hours <ChevronDown style={{ width: 10, height: 10 }} />
        </button>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse" style={{ whiteSpace: "nowrap" }}>
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c} style={{
                  fontFamily: "var(--font-rajdhani)",
                  fontSize: 10, fontWeight: 600, color: "#45597a",
                  letterSpacing: "0.04em", paddingBottom: 8,
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  paddingLeft: 4, paddingRight: 16,
                }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "16px 0", color: "#45597a", fontSize: 11, fontFamily: "var(--font-rajdhani)" }}>
                  No recent analyses.
                </td>
              </tr>
            ) : (
              history.map((row) => {
                const qualNum = parseFloat(row.quality) || 0;
                const qualColor = qualNum > 80 ? "#22c55e" : qualNum > 50 ? "#f59e0b" : "#ef4444";
                const statusColor = row.status === "Completed" ? "#22c55e" : row.status === "Failed" ? "#ef4444" : "#f59e0b";
                return (
                <tr key={`${row.file}-${row.time}`} className="group cursor-pointer transition-colors hover:bg-[rgba(0,212,255,0.03)]">
                  <td style={{
                    padding: "8px 4px", borderBottom: "1px solid rgba(255,255,255,0.02)",
                  }}>
                    <span style={{
                      fontFamily: "var(--font-inter)", fontSize: 11, fontWeight: 500, color: "#cbd5e1",
                    }}>{row.file}</span>
                  </td>
                  <td style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                    <span style={{
                      fontFamily: "var(--font-rajdhani)", fontSize: 10.5, fontWeight: 600,
                      color: "#00d4ff", padding: "2px 6px", background: "rgba(0,212,255,0.08)", borderRadius: 4,
                    }}>{row.type}</span>
                  </td>
                  <td style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                    <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 11, color: "#8a9ebf" }}>{row.dur}</span>
                  </td>
                  <td style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                    <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 11, color: "#8a9ebf" }}>{row.time}</span>
                  </td>
                  <td style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                    <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 11, fontWeight: 600, color: qualColor }}>
                      {row.quality}
                    </span>
                  </td>
                  <td style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center gap-1.5">
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
                      <span style={{ fontFamily: "var(--font-rajdhani)", fontSize: 10.5, fontWeight: 500, color: statusColor }}>
                        {row.status}
                      </span>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
