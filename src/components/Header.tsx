"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Menu, Search, Bell, Settings, User } from "lucide-react";

export default function Header() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const pathname = usePathname();

  const TITLES: Record<string, { title: string; subtitle: string }> = {
    "/": { title: "Dashboard", subtitle: "Real-time Signal Intelligence Overview" },
    "/signal-analysis": { title: "Signal Analysis", subtitle: "Advanced SDR Waveform Inspection" },
    "/fft-analysis": { title: "FFT Analysis", subtitle: "Frequency Domain Spectral Workspace" },
    "/spectrogram": { title: "Spectrogram", subtitle: "Time-Frequency Visualization" },
    "/modulation": { title: "Modulation Detection", subtitle: "Automatic Signal Classification" },
    "/filters": { title: "Filters & Processing", subtitle: "DSP Filter Configuration" },
    "/ai-assistant": { title: "AI Assistant", subtitle: "Intelligent Signal Analysis" },
    "/reports": { title: "Reports", subtitle: "Signal Analysis Reports" },
    "/data-logs": { title: "Data Logs", subtitle: "Analysis History & Logs" },
    "/settings": { title: "Settings", subtitle: "System Configuration" },
  };
  const { title: pageTitle, subtitle: pageSubtitle } = TITLES[pathname] || TITLES["/"];

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDate(now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      className="fixed top-0 right-0 z-40 flex items-center justify-between"
      style={{
        left: 156,
        height: 56,
        paddingLeft: 16,
        paddingRight: 14,
        background: "linear-gradient(180deg, rgba(5,8,24,0.97) 0%, rgba(5,8,24,0.92) 100%)",
        backdropFilter: "blur(24px) saturate(1.2)",
        borderBottom: "1px solid rgba(0,212,255,0.08)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(0,212,255,0.04)",
      }}
    >
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        <button style={{ color: "#3a4d6e", cursor: "pointer", background: "none", border: "none" }}>
          <Menu style={{ width: 17, height: 17 }} strokeWidth={1.6} />
        </button>
        <div>
          <h1 style={{
            fontFamily: "var(--font-orbitron)",
            fontSize: 17,
            fontWeight: 700,
            color: "#e2e8f0",
            letterSpacing: "0.035em",
            lineHeight: 1.2,
            textShadow: "0 0 24px rgba(0,212,255,0.12)",
          }}>
            {pageTitle}
          </h1>
          <p style={{
            fontFamily: "var(--font-rajdhani)",
            fontSize: 11,
            fontWeight: 500,
            color: "#00d4ff",
            letterSpacing: "0.04em",
            marginTop: 1,
            lineHeight: 1,
            textShadow: "0 0 12px rgba(0,212,255,0.3)",
          }}>
            {pageSubtitle}
          </p>
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        {/* System status pill */}
        <div
          className="flex items-center gap-3 rounded-lg"
          style={{
            padding: "6px 12px",
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="text-center">
            <div style={{
              fontFamily: "var(--font-rajdhani)",
              fontSize: 9.5,
              fontWeight: 500,
              color: "#4a5f82",
              letterSpacing: "0.04em",
            }}>
              System Status
            </div>
            <div className="flex items-center justify-center gap-1.5" style={{ marginTop: 2 }}>
              <div className="pulse-dot rounded-full" style={{
                width: 5, height: 5,
                background: "#22c55e",
              }} />
              <span style={{
                fontFamily: "var(--font-orbitron)",
                fontSize: 8.5,
                fontWeight: 700,
                color: "#22c55e",
                letterSpacing: "0.12em",
                textShadow: "0 0 8px rgba(34,197,94,0.6)",
              }}>
                ONLINE
              </span>
            </div>
          </div>
        </div>

        {/* Time */}
        <div className="text-right">
          <div style={{
            fontFamily: "var(--font-orbitron)",
            fontSize: 12.5,
            fontWeight: 600,
            color: "#c8d4e4",
            letterSpacing: "0.06em",
            lineHeight: 1.2,
            textShadow: "0 0 10px rgba(0,212,255,0.1)",
          }}>
            {time}
          </div>
          <div style={{
            fontFamily: "var(--font-rajdhani)",
            fontSize: 10,
            fontWeight: 500,
            color: "#4a5f82",
            marginTop: 1,
            letterSpacing: "0.03em",
          }}>
            {date}
          </div>
        </div>

        {/* Icon buttons */}
        <div className="flex items-center gap-1.5">
          {[Search, Bell, Settings].map((Icon, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.08, backgroundColor: "rgba(0,212,255,0.06)" }}
              whileTap={{ scale: 0.92 }}
              className="relative flex items-center justify-center rounded-lg"
              style={{
                width: 32, height: 32,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#3e5272",
                cursor: "pointer",
              }}
            >
              <Icon style={{ width: 13, height: 13 }} strokeWidth={1.7} />
              {Icon === Bell && (
                <span className="absolute rounded-full" style={{
                  top: 5, right: 6,
                  width: 5, height: 5,
                  background: "#00d4ff",
                  boxShadow: "0 0 6px #00d4ff",
                }} />
              )}
            </motion.button>
          ))}

          {/* AI avatar */}
          <motion.button
            whileHover={{ scale: 1.06, boxShadow: "0 0 16px rgba(0,212,255,0.4)" }}
            className="flex items-center justify-center rounded-lg text-white"
            style={{
              width: 32, height: 32,
              background: "linear-gradient(135deg, #00c6fb 0%, #005bea 100%)",
              boxShadow: "0 0 12px rgba(0,212,255,0.35)",
              cursor: "pointer",
              border: "none",
            }}
          >
            <span style={{
              fontFamily: "var(--font-orbitron)",
              fontSize: 10,
              fontWeight: 700,
            }}>
              AI
            </span>
          </motion.button>
        </div>
      </div>
    </header>
  );
}
