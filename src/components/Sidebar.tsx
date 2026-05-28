"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Activity, BarChart3, Layers, Radio,
  Filter, Bot, FileText, Database, Settings, Upload, Loader2,
} from "lucide-react";
import { useSignal } from "@/context/SignalContext";

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard",           href: "/"                },
  { icon: Activity,        label: "Signal Analysis",     href: "/signal-analysis" },
  { icon: BarChart3,       label: "FFT Analysis",        href: "/fft-analysis"    },
  { icon: Layers,          label: "Spectrogram",         href: "/spectrogram"     },
  { icon: Radio,           label: "Modulation Detection",href: "/modulation"      },
  { icon: Filter,          label: "Filters & Processing",href: "/filters"         },
  { icon: Bot,             label: "AI Assistant",        href: "/ai-assistant"    },
  { icon: FileText,        label: "Reports",             href: "/reports"         },
  { icon: Database,        label: "Data Logs",           href: "/data-logs"       },
  { icon: Settings,        label: "Settings",            href: "/settings"        },
];

const RES = [
  { label: "CPU Usage",    pct: 23, color: "#00d4ff" },
  { label: "Memory Usage", pct: 45, color: "#a855f7" },
  { label: "GPU Usage",    pct: 12, color: "#3b82f6" },
  { label: "Disk Usage",   pct: 62, color: "#f59e0b" },
];

export default function Sidebar() {
  const { uploadSignal, isProcessing } = useSignal();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  const handleUploadClick = () => {
    if (!isProcessing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadSignal(e.target.files[0]);
      e.target.value = ""; // Reset to allow same file re-upload
    }
  };

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col z-50"
      style={{
        width: 156,
        background: "linear-gradient(180deg, rgba(6,11,28,0.95) 0%, rgba(5,8,22,0.98) 50%, rgba(3,5,16,1) 100%)",
        backdropFilter: "blur(24px)",
        borderRight: "1px solid rgba(0,212,255,0.06)",
        boxShadow: "4px 0 40px rgba(0,0,0,0.8), 1px 0 0 rgba(0,212,255,0.03)",
        overflow: "hidden",
      }}
    >
      {/* ── Ambient sidebar glow ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "linear-gradient(180deg, rgba(0,212,255,0.02) 0%, transparent 40%, transparent 70%, rgba(168,85,247,0.015) 100%)",
      }} />

      {/* ── Logo ── */}
      <div
        className="relative flex items-center gap-2.5 px-3.5"
        style={{ height: 64, borderBottom: "1px solid rgba(0,212,255,0.05)" }}
      >
        <div className="relative flex-shrink-0">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 28, height: 28,
              background: "linear-gradient(135deg, #00d4ff 0%, #005bea 100%)",
              boxShadow: "0 0 20px rgba(0,212,255,0.4), 0 0 8px rgba(0,100,255,0.6)",
            }}
          >
            <Activity className="text-white" style={{ width: 14, height: 14 }} strokeWidth={2.2} />
          </div>
          <div className="absolute inset-0 rounded-lg" style={{
            boxShadow: "0 0 16px rgba(0,212,255,0.2)",
          }} />
        </div>
        <div className="min-w-0">
          <div style={{
            fontFamily: "var(--font-orbitron)",
            fontSize: 11, fontWeight: 600, color: "#ffffff",
            letterSpacing: "0.06em", lineHeight: 1.2,
            textShadow: "0 0 12px rgba(0,212,255,0.3)",
          }}>
            SignalMind AI
          </div>
          <div style={{
            fontFamily: "var(--font-rajdhani)",
            fontSize: 9.5, fontWeight: 400, color: "rgba(0,212,255,0.5)",
            letterSpacing: "0.08em", lineHeight: 1.2, marginTop: 2,
          }}>
            AI Signal Analyzer
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 py-3 overflow-y-auto scrollbar-hide flex flex-col gap-0.5">
        {NAV.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link key={item.label} href={item.href} style={{ textDecoration: "none" }}>
              <motion.div
                whileHover={{ x: 2, backgroundColor: "rgba(0,212,255,0.03)" }}
                transition={{ duration: 0.15 }}
                className={`w-full flex items-center gap-2.5 px-3.5 relative ${isActive ? "nav-active" : ""}`}
                style={{ height: 32, cursor: "pointer" }}
              >
                <item.icon
                  className="flex-shrink-0"
                  style={{
                    width: 13, height: 13,
                    color: isActive ? "#00d4ff" : "#2d3b54",
                    filter: isActive ? "drop-shadow(0 0 6px rgba(0,212,255,0.8))" : "none",
                    transition: "all 0.3s ease",
                  }}
                  strokeWidth={isActive ? 1.8 : 1.4}
                />
                <span
                  style={{
                    fontFamily: "var(--font-rajdhani)",
                    fontSize: 11.5, fontWeight: isActive ? 500 : 400,
                    color: isActive ? "#e2e8f0" : "#45597a",
                    letterSpacing: "0.04em", lineHeight: 1,
                    transition: "color 0.3s ease",
                    textShadow: isActive ? "0 0 12px rgba(0,212,255,0.3)" : "none",
                  }}
                >
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="navGlow"
                    className="absolute left-0 top-0 bottom-0"
                    style={{
                      width: 2,
                      background: "linear-gradient(180deg, transparent, #00d4ff, transparent)",
                      boxShadow: "2px 0 12px #00d4ff, 0 0 20px rgba(0,212,255,0.4)",
                    }}
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* ── System Resources ── */}
      <div className="px-3.5 pb-4 pt-3" style={{ borderTop: "1px solid rgba(0,212,255,0.04)" }}>
        <div style={{
          fontFamily: "var(--font-rajdhani)",
          fontSize: 9.5, fontWeight: 500, color: "#30405c",
          letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10,
        }}>
          System Resources
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {RES.map((r) => (
            <div key={r.label}>
              <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
                <span style={{
                  fontFamily: "var(--font-rajdhani)",
                  fontSize: 9.5, fontWeight: 500, color: "#45597a", letterSpacing: "0.04em",
                }}>
                  {r.label}
                </span>
                <span style={{
                  fontFamily: "var(--font-rajdhani)",
                  fontSize: 9.5, fontWeight: 500, color: "#5c7399",
                }}>
                  {r.pct}%
                </span>
              </div>
              <div style={{
                height: 2, background: "rgba(255,255,255,0.03)", borderRadius: 99, overflow: "hidden",
              }}>
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${r.pct}%` }}
                  transition={{ duration: 1.6, ease: "easeOut", delay: 0.4 }}
                  style={{
                    height: "100%", borderRadius: 99, background: r.color,
                    boxShadow: `0 0 10px ${r.color}80, 0 0 3px ${r.color}`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Upload Signal Button ── */}
      <div className="px-3.5 pb-4" style={{ borderTop: "1px solid rgba(0,212,255,0.04)", paddingTop: 12 }}>
        <input
          type="file"
          accept=".wav"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <motion.button
          onClick={handleUploadClick}
          disabled={isProcessing}
          whileHover={!isProcessing ? { scale: 1.02, boxShadow: "0 0 24px rgba(0,212,255,0.2), inset 0 0 12px rgba(0,212,255,0.08)" } : {}}
          whileTap={!isProcessing ? { scale: 0.98 } : {}}
          className="w-full flex items-center justify-center gap-2 rounded-md"
          style={{
            height: 34,
            fontFamily: "var(--font-rajdhani)",
            fontSize: 11, fontWeight: 500, letterSpacing: "0.06em",
            color: isProcessing ? "#cbd5e1" : "#00d4ff",
            background: isProcessing ? "rgba(0,212,255,0.15)" : "rgba(0,212,255,0.04)",
            border: isProcessing ? "1px solid rgba(0,212,255,0.4)" : "1px solid rgba(0,212,255,0.15)",
            boxShadow: isProcessing ? "0 0 20px rgba(0,212,255,0.3)" : "0 0 16px rgba(0,212,255,0.06), inset 0 0 8px rgba(0,212,255,0.02)",
            cursor: isProcessing ? "not-allowed" : "pointer",
            textShadow: isProcessing ? "none" : "0 0 8px rgba(0,212,255,0.4)",
            transition: "all 0.3s ease",
          }}
        >
          {isProcessing ? (
            <>
              <Loader2 className="animate-spin" style={{ width: 12, height: 12, color: "#00d4ff" }} strokeWidth={1.8} />
              Processing...
            </>
          ) : (
            <>
              <Upload style={{ width: 12, height: 12 }} strokeWidth={1.8} />
              Upload Signal
            </>
          )}
        </motion.button>
      </div>
    </aside>
  );
}
