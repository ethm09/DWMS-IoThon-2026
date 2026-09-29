import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Info, AlertTriangle, ShieldAlert, Check, Wand2, ChevronDown } from "lucide-react";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import type { SafetyDecision } from "@/lib/dwms-safety.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Demo-only threshold pop-ups. Physical commands and acknowledgements are
// handled by the backend and device control panel.
//   Level 1 Advisory   → Keep Value / Auto Adjust
//   Level 2 Correction → shows old/new/reason/action (informational)
//   Level 3 Emergency  → Acknowledge / View Details
// ─────────────────────────────────────────────────────────────────────────────

// Pages that run their own isolated virtual data and should NOT show emergency popups.
const SUPPRESSED_ROUTES = ["/simulation"];

type PopupState = {
  decision: SafetyDecision;
  oldValue?: number;
} | null;

export default function EthmPopups() {
  const {
    decision, mode, manualOverride, emergencyShutdown,
    readings, applyReading, acknowledgeEmergency, logEvent, dataMode,
  } = useProcessMode();

  const location = useLocation();
  const isSuppressedRoute = SUPPRESSED_ROUTES.includes(location.pathname);

  const [popup, setPopup] = useState<PopupState>(null);
  const [showDetails, setShowDetails] = useState(false);
  const lastShownRef = useRef<string>("");

  // These pop-ups describe local demo state only. Hardware status is shown by
  // the device control panel, which reports pending and acknowledged commands.
  useEffect(() => {
    if (dataMode !== "demo" || isSuppressedRoute) {
      setPopup((current) => current ? null : current);
      return;
    }
    if (emergencyShutdown) {
      setPopup({ decision });
    } else if (popup?.decision.kind === "emergency") {
      setPopup(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emergencyShutdown, isSuppressedRoute, dataMode]);

  // Advisory popup: only in Manual mode (Auto auto-corrects silently) and only
  // when the operator hasn't already been shown this exact advisory.
  useEffect(() => {
    if (dataMode !== "demo" || isSuppressedRoute) return;
    if (emergencyShutdown) return;
    if (decision.kind !== "advisory") {
      if (popup?.decision.kind === "advisory") setPopup(null);
      return;
    }
    // Show advisory when in manual (operator-driven) so they can decide.
    if (mode !== "manual" && !manualOverride) return;
    const sig = `${decision.parameter}-${decision.reason}`;
    if (lastShownRef.current === sig) return;
    lastShownRef.current = sig;
    setPopup({ decision, oldValue: readings.flowRate ?? undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision, mode, manualOverride, emergencyShutdown, isSuppressedRoute, dataMode]);

  if (dataMode !== "demo" || !popup) return null;
  const d = popup.decision;

  const cfg =
    d.kind === "emergency"
      ? { color: "#ef4444", Icon: ShieldAlert, title: "Demo emergency state", tag: "SIMULATION — CRITICAL" }
      : d.kind === "correction"
        ? { color: "#eab308", Icon: AlertTriangle, title: "Demo rule correction", tag: "SIMULATION — CORRECTION" }
        : { color: "#4ade80", Icon: Info, title: "Demo threshold notice", tag: "SIMULATION — ADVISORY" };

  function close() {
    setPopup(null);
    setShowDetails(false);
  }

  function keepValue() {
    logEvent({ type: "Demo threshold notice", parameter: d.parameter, decision: d.reason, action: "Operator kept the simulated value" });
    close();
  }

  function autoAdjust() {
    if (d.correctedValue !== undefined) {
      const old = readings.flowRate ?? undefined;
      applyReading("flowRate", d.correctedValue);
      logEvent({
        type: "Auto Correction Applied",
        parameter: d.parameter,
        oldValue: old ?? null,
        newValue: d.correctedValue,
        decision: d.reason,
        action: `Demo state changed ${d.parameter} to ${d.correctedValue}`,
      });
    }
    close();
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ type: "spring", damping: 24, stiffness: 320 }}
          className="w-full max-w-md rounded-2xl border overflow-hidden"
          style={{ background: "oklch(0.12 0.018 145)", borderColor: cfg.color, boxShadow: `0 0 40px ${cfg.color}44` }}
        >
          {/* Header */}
          <div className="px-5 py-4 flex items-center gap-3 border-b" style={{ borderColor: `${cfg.color}33`, background: `${cfg.color}10` }}>
            <motion.div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border"
              style={{ borderColor: cfg.color, background: `${cfg.color}18` }}
              animate={d.kind === "emergency" ? { scale: [1, 1.12, 1] } : {}}
              transition={{ duration: 0.6, repeat: Infinity }}
            >
              <cfg.Icon className="w-5 h-5" style={{ color: cfg.color }} />
            </motion.div>
            <div className="min-w-0">
              <div className="font-mono text-[9px] tracking-[0.25em]" style={{ color: cfg.color }}>{cfg.tag}</div>
              <div className="font-bold text-sm tracking-wide mt-0.5" style={{ color: cfg.color }}>{cfg.title}</div>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-3">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground">LOCAL SIMULATION · {d.parameter}</div>
            <p className="text-sm text-foreground/90 leading-relaxed">{d.reason}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{d.recommendation}</p>

            {/* Correction details */}
            {d.kind === "correction" && d.correctedValue !== undefined && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-lg p-2.5 border" style={{ borderColor: "oklch(0.24 0.03 145)", background: "oklch(0.14 0.018 145)" }}>
                  <div className="text-[9px] tracking-widest text-muted-foreground">OLD VALUE</div>
                  <div className="font-mono font-bold text-sm mt-0.5">{popup.oldValue ?? readings.flowRate ?? "—"}</div>
                </div>
                <div className="rounded-lg p-2.5 border" style={{ borderColor: `${cfg.color}55`, background: `${cfg.color}12` }}>
                  <div className="text-[9px] tracking-widest text-muted-foreground">CORRECTED</div>
                  <div className="font-mono font-bold text-sm mt-0.5" style={{ color: cfg.color }}>{d.correctedValue}</div>
                </div>
              </div>
            )}

            {/* Emergency details (collapsible) */}
            {d.kind === "emergency" && showDetails && (
              <div className="rounded-lg p-3 border space-y-1 text-[11px] font-mono" style={{ borderColor: "#ef444444", background: "#ef44440d" }}>
                <div className="flex justify-between"><span className="text-muted-foreground">PARAMETER</span><span className="text-red-400">{d.parameter}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">RISK</span><span className="text-red-400">CRITICAL</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">DEMO PUMP MODEL</span><span className="text-red-400">SIMULATED STOP</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">pH</span><span>{readings.ph ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TDS</span><span>{readings.tds ?? "—"} ppm</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TURBIDITY</span><span>{readings.turbidity ?? "—"} NTU</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">FLOW</span><span>{readings.flowRate ?? "—"} L/min</span></div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 pb-5 flex items-center gap-2">
            {d.kind === "advisory" && (
              <>
                <button onClick={keepValue}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl cursor-pointer font-bold text-xs tracking-widest transition-opacity hover:opacity-80"
                  style={{ background: "oklch(0.18 0.02 145)", color: "oklch(0.8 0.02 145)", border: "1px solid oklch(0.26 0.03 145)" }}>
                  <Check className="w-3.5 h-3.5" /> KEEP VALUE
                </button>
                <button onClick={autoAdjust}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl cursor-pointer font-bold text-xs tracking-widest transition-opacity hover:opacity-80"
                  style={{ background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}` }}>
                  <Wand2 className="w-3.5 h-3.5" /> AUTO ADJUST
                </button>
              </>
            )}

            {d.kind === "correction" && (
              <button onClick={close}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl cursor-pointer font-bold text-xs tracking-widest transition-opacity hover:opacity-80"
                style={{ background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}` }}>
                <Check className="w-3.5 h-3.5" /> GOT IT
              </button>
            )}

            {d.kind === "emergency" && (
              <>
                <button onClick={() => setShowDetails((s) => !s)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl cursor-pointer font-bold text-xs tracking-widest transition-opacity hover:opacity-80"
                  style={{ background: "oklch(0.18 0.02 145)", color: "oklch(0.8 0.02 145)", border: "1px solid oklch(0.26 0.03 145)" }}>
                  VIEW DETAILS <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} />
                </button>
                <button onClick={() => { acknowledgeEmergency(); close(); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl cursor-pointer font-bold text-xs tracking-widest transition-opacity hover:opacity-80"
                  style={{ background: "#ef444422", color: "#ef4444", border: "1px solid #ef4444" }}>
                  <Check className="w-3.5 h-3.5" /> DISMISS SIMULATION NOTICE
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
