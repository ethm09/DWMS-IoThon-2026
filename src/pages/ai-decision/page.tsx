import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Droplets, Wind, FlaskConical, Zap, ChevronRight, Mic, Volume2, VolumeX } from "lucide-react";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import { classifyPh, classifyTds, classifyTurbidity, THRESHOLDS, type SafetyLevel } from "@/lib/dwms-safety.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

type DecisionLevel = "unknown" | "nominal" | "advisory" | "action" | "critical";

interface Decision {
  id: string;
  parameter: string;
  condition: string;
  value: string;
  unit: string;
  recommendation: string;
  action: string;
  level: DecisionLevel;
  icon: React.FC<{ className?: string }>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const LEVEL_CFG: Record<DecisionLevel, { color: string; glow: string; label: string; priority: number }> = {
  unknown:  { color: "#6b7280", glow: "#6b728066", label: "NO DATA", priority: -1 },
  nominal:  { color: "#22c55e", glow: "#22c55e66", label: "NOMINAL",   priority: 0 },
  advisory: { color: "#eab308", glow: "#eab30866", label: "WARNING", priority: 1 },
  action:   { color: "#eab308", glow: "#eab30866", label: "ACTION REQ", priority: 2 },
  critical: { color: "#ef4444", glow: "#ef444466", label: "CRITICAL",  priority: 3 },
};

// ─── Decision builder ─────────────────────────────────────────────────────────

function buildDecision(
  id: string,
  parameter: string,
  value: number | null,
  unit: string,
  classify: (value: number) => SafetyLevel,
  icon: Decision["icon"],
): Decision {
  const level: DecisionLevel = value === null
    ? "unknown"
    : classify(value) === "critical" ? "critical" : classify(value) === "warning" ? "advisory" : "nominal";
  const formatted = value === null ? "—" : parameter === "pH" || parameter === "TURBIDITY" ? value.toFixed(2) : value.toFixed(0);
  const statusText = value === null ? "No current sensor reading" : `${formatted}${unit ? ` ${unit}` : ""} · ${LEVEL_CFG[level].label}`;

  return {
    id,
    parameter,
    condition: statusText,
    value: formatted,
    unit,
    level,
    icon,
    recommendation: level === "unknown"
      ? "No current reading is available. The system cannot assess this parameter."
      : level === "critical"
        ? "Reading is beyond a configured prototype critical threshold. Verify the sensor and follow approved site response procedures. This display does not prescribe treatment."
        : level === "advisory"
          ? "Reading is outside a configured prototype range. Verify the reading and review it under validated site procedures."
          : "Reading is within the configured prototype band. This does not certify water quality or equipment performance.",
    action: level === "unknown"
      ? "WAIT FOR SENSOR DATA"
      : level === "critical"
        ? "VERIFY READING · FOLLOW SITE PROCEDURES"
        : level === "advisory"
          ? "REVIEW WITH QUALIFIED OPERATOR"
          : "CONTINUE MONITORING UNDER SITE PROCEDURES",
  };
}

function buildDecisions(tds: number | null, turbidity: number | null, ph: number | null): Decision[] {
  return [
    buildDecision("tds", "TDS", tds, "ppm", classifyTds, Droplets),
    buildDecision("turbidity", "TURBIDITY", turbidity, "NTU", classifyTurbidity, Wind),
    buildDecision("ph", "pH", ph, "", classifyPh, FlaskConical),
  ];
}

// ─── Arc Reactor ──────────────────────────────────────────────────────────────

function ArcReactor({ level, processing }: { level: DecisionLevel; processing: boolean }) {
  const color = LEVEL_CFG[level].color;
  const glow = LEVEL_CFG[level].glow;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
      {/* Outer glow */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 200, height: 200, background: `radial-gradient(circle, ${glow} 0%, transparent 70%)` }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2.5, repeat: Infinity }}
      />

      {/* Rotating rings */}
      {[80, 100, 120, 150].map((r, i) => (
        <motion.div
          key={r}
          className="absolute rounded-full border"
          style={{
            width: r, height: r,
            borderColor: i % 2 === 0 ? `${color}55` : `${color}22`,
            borderWidth: i % 2 === 0 ? 1.5 : 1,
          }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 4 + i * 2, repeat: Infinity, ease: "linear" as const }}
        />
      ))}

      {/* Hex segments */}
      <svg className="absolute" width={170} height={170} viewBox="0 0 170 170">
        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const r = 68;
          const x = 85 + r * Math.cos(rad);
          const y = 85 + r * Math.sin(rad);
          return (
            <motion.circle
              key={i}
              cx={x} cy={y} r={7}
              fill={`${color}33`}
              stroke={color}
              strokeWidth={1}
              animate={{ opacity: processing ? [0.3, 1, 0.3] : [0.5, 0.8, 0.5] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          );
        })}
        {/* Inner triangle */}
        <motion.polygon
          points="85,58 108,97 62,97"
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          animate={{ opacity: [0.4, 0.9, 0.4], rotate: 360 }}
          style={{ transformOrigin: "85px 85px" }}
          transition={{ opacity: { duration: 2, repeat: Infinity }, rotate: { duration: 8, repeat: Infinity, ease: "linear" as const } }}
        />
      </svg>

      {/* Core */}
      <motion.div
        className="absolute rounded-full flex items-center justify-center"
        style={{ width: 56, height: 56 }}
        animate={{
          background: `radial-gradient(circle, ${color}44 0%, ${color}11 100%)`,
          boxShadow: `0 0 24px ${color}, 0 0 48px ${glow}, inset 0 0 16px ${color}33`,
        }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          animate={{ opacity: processing ? [1, 0.2, 1] : 1 }}
          transition={{ duration: 0.5, repeat: processing ? Infinity : 0 }}
        >
          <Zap style={{ color, width: 24, height: 24 }} />
        </motion.div>
      </motion.div>

      {/* Scanning line */}
      {processing && (
        <motion.div
          className="absolute rounded-full overflow-hidden"
          style={{ width: 160, height: 160 }}
        >
          <motion.div
            className="w-full h-0.5 absolute"
            style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
            animate={{ top: ["0%", "100%", "0%"] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" as const }}
          />
        </motion.div>
      )}
    </div>
  );
}

// ─── Hex Data Card ────────────────────────────────────────────────────────────

function HexCard({ decision, index, active }: { decision: Decision; index: number; active: boolean }) {
  const cfg = LEVEL_CFG[decision.level];
  const Icon = decision.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="relative rounded-xl border p-4 overflow-hidden"
      style={{
        borderColor: active ? cfg.color : `${cfg.color}44`,
        background: `linear-gradient(135deg, ${cfg.color}08 0%, oklch(0.12 0.02 145) 100%)`,
        boxShadow: active ? `0 0 20px ${cfg.color}22, inset 0 0 20px ${cfg.color}08` : "none",
      }}
    >
      {/* Corner accent */}
      <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden">
        <div className="absolute top-0 right-0 w-0 h-0"
          style={{ borderTop: `24px solid ${cfg.color}33`, borderLeft: "24px solid transparent" }} />
      </div>

      {/* Scan line effect */}
      {active && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(180deg, transparent 0%, ${cfg.color}08 50%, transparent 100%)` }}
          animate={{ y: ["-100%", "200%"] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" as const }}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <motion.div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          animate={{ borderColor: cfg.color, boxShadow: `0 0 10px ${cfg.color}44` }}
          style={{ border: `1px solid ${cfg.color}55`, background: `${cfg.color}15` }}
        >
          <div style={{ color: cfg.color }}><Icon className="w-4 h-4" /></div>
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-bold tracking-[0.2em]" style={{ color: cfg.color }}>
              {decision.parameter}
            </div>
            <motion.div
              className="text-[8px] font-bold tracking-widest px-1.5 py-0.5 rounded"
              style={{ color: cfg.color, background: `${cfg.color}22`, border: `1px solid ${cfg.color}44` }}
              animate={{ opacity: decision.level === "critical" ? [1, 0.4, 1] : 1 }}
              transition={{ duration: 0.6, repeat: decision.level === "critical" ? Infinity : 0 }}
            >
              {cfg.label}
            </motion.div>
          </div>
          <div className="text-[9px] text-muted-foreground font-mono tracking-wider">{decision.condition}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-xl font-bold" style={{ color: cfg.color }}>{decision.value}</div>
          <div className="text-[8px] text-muted-foreground">{decision.unit}</div>
        </div>
      </div>

      {/* Shared threshold note */}
      <div className="rounded-lg p-3 mb-3" style={{ background: "oklch(0.08 0.01 145 / 0.8)", border: "1px solid oklch(0.2 0.03 145)" }}>
        <div className="text-[8px] font-bold tracking-[0.2em] text-muted-foreground mb-1.5">DWMS RULE ASSESSMENT</div>
        <p className="text-[10px] text-foreground/80 leading-relaxed tracking-wide italic">
          "{decision.recommendation}"
        </p>
      </div>

      {/* Suggested review step */}
      <div className="flex items-center gap-2">
        <motion.div
          className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-widest"
          style={{ color: cfg.color, background: `${cfg.color}15`, border: `1px solid ${cfg.color}44` }}
        >
          <ChevronRight className="w-3 h-3 shrink-0" />
          {decision.action}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Voice waveform ───────────────────────────────────────────────────────────

function VoiceWave({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="flex items-center gap-0.5 h-6">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-0.5 rounded-full"
          style={{ background: color }}
          animate={active ? {
            height: [`${8 + (i % 5) * 3}px`, `${4 + ((i + 2) % 6) * 3}px`, `${8 + (i % 5) * 3}px`],
            opacity: [0.4, 0.9, 0.4],
          } : { height: "3px", opacity: 0.2 }}
          transition={{ duration: 0.4 + (i % 3) * 0.1, repeat: Infinity, delay: i * 0.05 }}
        />
      ))}
    </div>
  );
}

// ─── Ethm AI Speech Hook ────────────────────────────────────────────────────────

function useEthmVoice() {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const queueRef = useRef<string[]>([]);
  const busyRef = useRef(false);

  const pickVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices();
    // Prioritize a consistent, clear English voice across all devices/browsers.
    // Prefer male or neutral voices that sound the same everywhere for "Ethm AI" persona.
    return (
      voices.find(v => v.name === "Google UK English Male") ||
      voices.find(v => v.name === "Google US English") ||
      voices.find(v => v.name.toLowerCase().includes("daniel") && v.lang === "en-GB") ||
      voices.find(v => v.name.toLowerCase().includes("alex") && v.lang.startsWith("en")) ||
      voices.find(v => v.name.toLowerCase().includes("fred") && v.lang.startsWith("en")) ||
      voices.find(v => v.name.toLowerCase().includes("thomas") && v.lang.startsWith("en")) ||
      voices.find(v => v.name === "Google UK English Female") ||
      voices.find(v => v.lang === "en-GB" && !v.localService) ||
      voices.find(v => v.lang === "en-US" && !v.localService) ||
      voices.find(v => v.lang === "en-GB") ||
      voices.find(v => v.lang.startsWith("en")) ||
      voices[0] ||
      null
    );
  }, []);

  const speakNext = useCallback(() => {
    if (busyRef.current || queueRef.current.length === 0) return;
    const text = queueRef.current.shift()!;
    busyRef.current = true;
    setIsSpeaking(true);

    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = pickVoice();
    utter.rate = 0.92;
    utter.pitch = 0.95;
    utter.volume = 1.0;
    utter.onend = () => {
      busyRef.current = false;
      setIsSpeaking(false);
      speakNext();
    };
    utter.onerror = () => {
      busyRef.current = false;
      setIsSpeaking(false);
    };
    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [pickVoice]);

  const speak = useCallback((text: string, force?: boolean) => {
    if (!voiceEnabled && !force) return;
    queueRef.current.push(text);
    speakNext();
  }, [voiceEnabled, speakNext]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    queueRef.current = [];
    busyRef.current = false;
    setIsSpeaking(false);
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      if (prev) stop();
      return !prev;
    });
  }, [stop]);

  // Load voices on mount (Chrome loads async)
  useEffect(() => {
    window.speechSynthesis.getVoices();
    const handler = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      window.speechSynthesis.cancel();
    };
  }, []);

  return { voiceEnabled, toggleVoice, speak, stop, isSpeaking };
}

// ─── Boot sequence ────────────────────────────────────────────────────────────

function BootLine({ text, delay }: { text: string; delay: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return visible ? (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="font-mono text-[10px] text-emerald-400/70 tracking-widest">
      <span className="text-emerald-600 mr-2">›</span>{text}
    </motion.div>
  ) : null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIDecision() {
  const { readings, dataMode, lastUpdated } = useProcessMode();
  const [booted, setBooted] = useState(false);
  const [activeDecision, setActiveDecision] = useState<string | null>(null);
  const { voiceEnabled, toggleVoice, speak, isSpeaking } = useEthmVoice();
  const decisions = buildDecisions(readings.tds, readings.turbidity, readings.ph);
  const hasReadings = readings.tds !== null && readings.turbidity !== null && readings.ph !== null;
  const processing = false;
  const ethmLine = !hasReadings
    ? "No current sensor readings are available; no assessment can be made."
    : "Using shared DWMS prototype threshold rules. This is not an AI prediction or water-safety certification.";

  // Boot animation
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 2200);
    return () => clearTimeout(t);
  }, []);

  const criticalCount = decisions.filter(d => d.level === "critical").length;
  const cautionCount = decisions.filter(d => d.level === "action" || d.level === "advisory").length;
  const overallLevel: DecisionLevel = !hasReadings
    ? "unknown"
    : criticalCount > 0 ? "critical" : cautionCount > 0 ? "advisory" : "nominal";
  const overallCfg = LEVEL_CFG[overallLevel];

  // Voice output repeats the same bounded rule result shown on screen.
  const buildStatusReport = useCallback((lvl: DecisionLevel, d: Decision[]) => {
    if (lvl === "unknown") return "No current sensor readings are available. Status cannot be assessed.";
    if (lvl === "nominal") {
      return "Current readings are within the configured prototype thresholds. This is not a water-safety certification.";
    }
    const flagged = d.filter(x => x.level !== "nominal");
    const items = flagged.map(x => `${x.parameter}: ${x.value} ${x.unit}`.trim()).join(". ");
    return `${flagged.length} parameter${flagged.length > 1 ? "s" : ""} outside prototype thresholds. ${items}. Verify readings and follow approved site procedures.`;
  }, []);

  const handleCheckStatus = useCallback(() => {
    const report = buildStatusReport(overallLevel, decisions);
    // Force speak even if voice is toggled off — the button is an explicit user action.
    speak(report, true);
  }, [overallLevel, decisions, speak, buildStatusReport]);

  // Boot screen
  if (!booted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "oklch(0.08 0.015 145)" }}>
        <div className="w-full max-w-lg space-y-4">
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="font-mono text-2xl font-bold tracking-[0.4em]" style={{ color: "#22c55e" }}>ETHM AI</div>
            <div className="font-mono text-[10px] tracking-[0.3em] text-emerald-400/50 mt-1">
              DWMS PROTOTYPE THRESHOLD REVIEW
            </div>
          </motion.div>
          <div className="space-y-1.5">
            {[
              "Starting the DWMS rule assessment...",
              "Loading shared prototype threshold rules...",
              "Reading current application sensor state...",
              "No hardware controls are issued from this screen...",
              "Preparing the bounded status summary...",
              "Rule assessment ready.",
            ].map((line, i) => (
              <BootLine key={i} text={line} delay={i * 300} />
            ))}
          </div>
          <div className="flex justify-center mt-6">
            <ArcReactor level="unknown" processing={true} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6" style={{ background: "oklch(0.09 0.015 145)" }}>

      {/* HUD Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ background: overallCfg.color }}
              animate={{ opacity: [1, 0.3, 1], boxShadow: `0 0 8px ${overallCfg.color}` }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <h2 className="font-mono text-sm font-bold tracking-[0.3em]" style={{ color: overallCfg.color }}>
              ETHM — RULE-BASED SENSOR REVIEW
            </h2>
          </div>
          <div className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground mt-0.5">
            PROTOTYPE THRESHOLDS · {dataMode.toUpperCase()} · {lastUpdated && Date.parse(lastUpdated) > 0 ? new Date(lastUpdated).toLocaleTimeString() : "NO CURRENT UPDATE"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Voice toggle button */}
          <motion.button
            onClick={toggleVoice}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-[9px] font-bold tracking-widest cursor-pointer transition-all"
            style={voiceEnabled
              ? { color: "#22c55e", background: "#22c55e15", border: "1px solid #22c55e44", boxShadow: isSpeaking ? "0 0 12px #22c55e44" : "none" }
              : { color: "hsl(var(--muted-foreground))", background: "hsl(var(--muted)/0.2)", border: "1px solid hsl(var(--border))" }
            }
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {voiceEnabled ? "VOICE ON" : "VOICE OFF"}
          </motion.button>

          {/* Check System Status button */}
          <motion.button
            onClick={handleCheckStatus}
            whileTap={{ scale: 0.95 }}
            disabled={isSpeaking}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-[9px] font-bold tracking-widest cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              color: overallCfg.color,
              background: `${overallCfg.color}15`,
              border: `1px solid ${overallCfg.color}44`,
              boxShadow: isSpeaking ? `0 0 16px ${overallCfg.color}44` : "none",
            }}
            animate={isSpeaking ? { boxShadow: [`0 0 8px ${overallCfg.color}44`, `0 0 20px ${overallCfg.color}88`, `0 0 8px ${overallCfg.color}44`] } : {}}
            transition={{ duration: 1, repeat: isSpeaking ? Infinity : 0 }}
          >
            <Mic className="w-3.5 h-3.5" />
            {isSpeaking ? "SPEAKING..." : "CHECK SYSTEM STATUS"}
          </motion.button>

          <div className="text-right shrink-0">
            <div className="text-[8px] font-mono tracking-widest text-muted-foreground">STATUS</div>
            <motion.div className="text-[10px] font-bold font-mono tracking-widest" animate={{ color: overallCfg.color }}>
              {!hasReadings ? "NO DATA" : criticalCount > 0 ? `${criticalCount} CRITICAL` : cautionCount > 0 ? `${cautionCount} WARNING` : "PROTOTYPE NORMAL"}
            </motion.div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[10px] text-muted-foreground">
        <span className="font-bold text-amber-400">
          {dataMode === "hardware" ? "HARDWARE MODE" : "DEMO SIMULATION"}
        </span>
        <span className="mx-2">·</span>
        This screen applies shared prototype threshold rules to the current app readings. It is not an AI prediction service, does not control hardware, and does not certify water quality.
      </div>

      {/* Rule assessment panel */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ borderColor: `${overallCfg.color}33`, background: `linear-gradient(135deg, oklch(0.11 0.02 145), oklch(0.09 0.015 145))` }}>

        {/* Top scan bar */}
        <div className="h-0.5 w-full relative overflow-hidden" style={{ background: "oklch(0.2 0.03 145)" }}>
          <motion.div
            className="absolute inset-y-0 w-1/3"
            style={{ background: `linear-gradient(90deg, transparent, ${overallCfg.color}, transparent)` }}
            animate={{ x: ["-100%", "400%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" as const }}
          />
        </div>

        <div className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Arc reactor */}
            <div className="shrink-0">
              <ArcReactor level={overallLevel} processing={processing} />
            </div>

            {/* Right panel */}
            <div className="flex-1 space-y-4 w-full">
              {/* Verdict */}
              <motion.div
                className="rounded-xl p-4"
                animate={{
                  borderColor: overallCfg.color,
                  background: `${overallCfg.color}08`,
                }}
                style={{ border: `1px solid` }}
                transition={{ duration: 0.4 }}
              >
                <div className="font-mono text-[8px] tracking-[0.3em] text-muted-foreground mb-1">SYSTEM VERDICT</div>
                <motion.div
                  className="font-mono text-sm font-bold tracking-[0.15em]"
                  animate={{ color: overallCfg.color }}
                >
                  {processing ? "ANALYSING SENSOR DATA..." :
                    overallLevel === "unknown" ? "READINGS UNAVAILABLE — STATUS CANNOT BE ASSESSED." :
                    overallLevel === "nominal" ? "READINGS WITHIN PROTOTYPE BANDS — NOT A SAFETY CERTIFICATION." :
                    overallLevel === "advisory" ? "READING OUTSIDE PROTOTYPE BAND — VERIFY THE SENSOR." :
                    "CRITICAL PROTOTYPE THRESHOLD EXCEEDED — FOLLOW APPROVED SITE PROCEDURES."}
                </motion.div>
              </motion.div>

              {/* Current source metrics */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "TDS", value: readings.tds?.toFixed(0) ?? "—", unit: "ppm", level: readings.tds === null ? "unknown" : classifyTds(readings.tds) },
                  { label: "TURBIDITY", value: readings.turbidity?.toFixed(2) ?? "—", unit: "NTU", level: readings.turbidity === null ? "unknown" : classifyTurbidity(readings.turbidity) },
                  { label: "pH LEVEL", value: readings.ph?.toFixed(2) ?? "—", unit: "", level: readings.ph === null ? "unknown" : classifyPh(readings.ph) },
                ].map(m => {
                  const color = m.level === "unknown" ? "#6b7280" : m.level === "safe" ? "#22c55e" : m.level === "warning" ? "#eab308" : "#ef4444";
                  return (
                    <div key={m.label} className="rounded-lg p-2 text-center"
                      style={{ background: `${color}0d`, border: `1px solid ${color}33` }}>
                      <div className="font-mono text-[7px] tracking-[0.2em] text-muted-foreground">{m.label}</div>
                      <motion.div className="font-mono text-base font-bold" animate={{ color }} transition={{ duration: 0.3 }}>
                        {m.value}
                      </motion.div>
                      <div className="font-mono text-[8px] text-muted-foreground">{m.unit}</div>
                    </div>
                  );
                })}
              </div>

              {/* Ethm AI voice */}
              <div className="rounded-lg p-3 flex items-center gap-3"
                style={{ background: "oklch(0.08 0.01 145)", border: "1px solid oklch(0.18 0.025 145)" }}>
                  <VoiceWave active={processing || isSpeaking} color={overallCfg.color} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[8px] tracking-[0.25em] text-muted-foreground mb-0.5">DWMS RULE NOTE</div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={ethmLine}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="font-mono text-[10px] tracking-wide italic"
                      style={{ color: overallCfg.color }}
                    >
                      "{ethmLine}"
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom scan bar */}
        <div className="h-0.5 w-full relative overflow-hidden" style={{ background: "oklch(0.2 0.03 145)" }}>
          <motion.div
            className="absolute inset-y-0 w-1/3"
            style={{ background: `linear-gradient(90deg, transparent, ${overallCfg.color}, transparent)` }}
            animate={{ x: ["400%", "-100%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" as const }}
          />
        </div>
      </div>

      {/* Decision cards */}
      <div>
        <div className="font-mono text-[9px] tracking-[0.25em] text-muted-foreground mb-3 flex items-center gap-2">
          <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: overallCfg.color }}
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
          PARAMETER ANALYSIS — {decisions.length} SYSTEMS SCANNED
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {decisions.map((d, i) => (
            <div key={d.id} onClick={() => setActiveDecision(a => a === d.id ? null : d.id)}>
              <HexCard decision={d} index={i} active={activeDecision === d.id || d.level === "critical"} />
            </div>
          ))}
        </div>
      </div>

      {/* Logic table — HUD style */}
      <div className="rounded-xl border overflow-hidden"
        style={{ borderColor: "oklch(0.22 0.035 145)", background: "oklch(0.1 0.015 145)" }}>
        <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "oklch(0.22 0.035 145)" }}>
          <div className="font-mono text-[9px] tracking-[0.25em] text-emerald-400/70">DECISION MATRIX — RULE ENGINE</div>
          <div className="ml-auto font-mono text-[8px] text-muted-foreground">7 RULES LOADED</div>
        </div>
        <div className="divide-y" style={{ borderColor: "oklch(0.16 0.025 145)" }}>
          {[
            { if: `Turbidity > ${THRESHOLDS.turbidity.critical.above} NTU`, then: "Flag critical; verify reading and follow site procedures", level: "critical" as DecisionLevel },
            { if: `Turbidity ≥ ${THRESHOLDS.turbidity.safe.max} NTU`, then: "Flag warning; review under validated site procedures", level: "advisory" as DecisionLevel },
            { if: `pH < ${THRESHOLDS.ph.critical.below} or > ${THRESHOLDS.ph.critical.above}`, then: "Flag critical; verify reading and follow site procedures", level: "critical" as DecisionLevel },
            { if: `pH outside ${THRESHOLDS.ph.safe.min}–${THRESHOLDS.ph.safe.max}`, then: "Flag warning; review under validated site procedures", level: "advisory" as DecisionLevel },
            { if: `TDS > ${THRESHOLDS.tds.critical.above} ppm`, then: "Flag critical; verify reading and follow site procedures", level: "critical" as DecisionLevel },
            { if: `TDS ≥ ${THRESHOLDS.tds.safe.max} ppm`, then: "Flag warning; review under validated site procedures", level: "advisory" as DecisionLevel },
            { if: "All available parameters inside prototype safe bands", then: "Show prototype normal status; this is not a safety certification", level: "nominal" as DecisionLevel },
          ].map((rule, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
              <span className="font-mono text-[8px] text-muted-foreground/40 w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-mono text-[9px] text-emerald-400/80 flex-1">IF &nbsp;{rule.if}</span>
              <span className="font-mono text-[9px] text-muted-foreground/40 shrink-0">→</span>
              <span className="font-mono text-[9px] flex-1" style={{ color: LEVEL_CFG[rule.level].color }}>
                THEN &nbsp;{rule.then}
              </span>
              <span className="font-mono text-[8px] px-1.5 py-0.5 rounded shrink-0"
                style={{ color: LEVEL_CFG[rule.level].color, background: `${LEVEL_CFG[rule.level].color}15`, border: `1px solid ${LEVEL_CFG[rule.level].color}33` }}>
                {LEVEL_CFG[rule.level].label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
