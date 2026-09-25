import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Droplets, Wind, FlaskConical, Zap, ChevronRight, Mic, Volume2, VolumeX } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DecisionLevel = "nominal" | "advisory" | "action" | "critical";

interface Decision {
  id: string;
  parameter: string;
  condition: string;
  value: string;
  unit: string;
  recommendation: string;
  action: string;
  level: DecisionLevel;
  confidence: number;
  icon: React.FC<{ className?: string }>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const LEVEL_CFG: Record<DecisionLevel, { color: string; glow: string; label: string; priority: number }> = {
  nominal:  { color: "#22c55e", glow: "#22c55e66", label: "NOMINAL",   priority: 0 },
  advisory: { color: "#818cf8", glow: "#818cf866", label: "ADVISORY",  priority: 1 },
  action:   { color: "#eab308", glow: "#eab30866", label: "ACTION REQ", priority: 2 },
  critical: { color: "#ef4444", glow: "#ef444466", label: "CRITICAL",  priority: 3 },
};

const ETHM_LINES = [
  "All systems are functioning within normal parameters.",
  "Water treatment efficiency is holding at optimal levels.",
  "No anomalies detected in the filtration matrix.",
  "Sensor array calibration confirmed. Standing by.",
  "Running predictive analysis on incoming telemetry.",
  "Cross-referencing with baseline quality thresholds.",
  "Neural pathway scan complete. Awaiting next cycle.",
  "Threat assessment updated. Environmental factors stable.",
];

// ─── Decision builder ─────────────────────────────────────────────────────────

function buildDecisions(tds: number, turbidity: number, ph: number): Decision[] {
  const decisions: Decision[] = [];

  // TDS
  if (tds > 600) {
    decisions.push({ id: "tds", parameter: "TDS", condition: `${tds.toFixed(0)} ppm exceeds critical threshold`, value: tds.toFixed(0), unit: "ppm", recommendation: "Sir, dissolved solids have surpassed the critical ceiling of 600 ppm. I'm recommending immediate flushing protocol to dilute concentration before corrosive damage occurs.", action: "INITIATE FLUSHING PROTOCOL", level: "critical", confidence: 98, icon: Droplets });
  } else if (tds > 300) {
    decisions.push({ id: "tds", parameter: "TDS", condition: `${tds.toFixed(0)} ppm above advisory level`, value: tds.toFixed(0), unit: "ppm", recommendation: "TDS approaching the upper limit. I suggest increasing filtration cycle frequency by approximately 15% to prevent escalation.", action: "INCREASE FILTRATION RATE", level: "action", confidence: 87, icon: Droplets });
  } else {
    decisions.push({ id: "tds", parameter: "TDS", condition: `${tds.toFixed(0)} ppm — within parameters`, value: tds.toFixed(0), unit: "ppm", recommendation: "Dissolved solids remain within acceptable range. No corrective action is required at this time.", action: "MAINTAIN CURRENT OPERATION", level: "nominal", confidence: 99, icon: Droplets });
  }

  // Turbidity
  if (turbidity > 20) {
    decisions.push({ id: "turb", parameter: "TURBIDITY", condition: `${turbidity.toFixed(2)} NTU — critical particle load`, value: turbidity.toFixed(2), unit: "NTU", recommendation: "Sir, I'm detecting severe turbidity levels. Primary filter bypass risk is imminent. Secondary filtration must be activated immediately to prevent contamination breach.", action: "ACTIVATE SECONDARY FILTRATION", level: "critical", confidence: 97, icon: Wind });
  } else if (turbidity > 1) {
    decisions.push({ id: "turb", parameter: "TURBIDITY", condition: `${turbidity.toFixed(2)} NTU above nominal`, value: turbidity.toFixed(2), unit: "NTU", recommendation: "Suspended particle count has exceeded the 1.0 NTU baseline. A filter backwash cycle is advisable within the next operational window.", action: "BACKWASH FILTER MEDIA", level: "action", confidence: 82, icon: Wind });
  } else {
    decisions.push({ id: "turb", parameter: "TURBIDITY", condition: `${turbidity.toFixed(2)} NTU — nominal clarity`, value: turbidity.toFixed(2), unit: "NTU", recommendation: "Water clarity is excellent. Filtration is performing at optimal efficiency.", action: "MONITOR CONTINUOUSLY", level: "nominal", confidence: 99, icon: Wind });
  }

  // pH
  if (ph < 5.5 || ph > 9.5) {
    decisions.push({ id: "ph", parameter: "pH LEVEL", condition: `pH ${ph.toFixed(2)} — outside safe range`, value: ph.toFixed(2), unit: "pH", recommendation: ph < 5.5 ? "Critical acidity detected, sir. Alkaline dosing is required immediately. Prolonged exposure at this pH will cause irreversible pipe corrosion." : "Severe alkalinity alert. The chemical balance has been compromised. Neutralising agent deployment is required without delay.", action: ph < 5.5 ? "DOSE NaOH — ALKALINE INJECTION" : "DOSE HCl — ACID NEUTRALISATION", level: "critical", confidence: 96, icon: FlaskConical });
  } else if (ph < 6.5 || ph > 8.5) {
    decisions.push({ id: "ph", parameter: "pH LEVEL", condition: `pH ${ph.toFixed(2)} — outside optimal band`, value: ph.toFixed(2), unit: "pH", recommendation: ph < 6.5 ? "Minor pH deviation detected. A modest alkaline dosing adjustment will restore the balance within the 6.5–8.5 optimal window." : "pH trending slightly alkaline. A minor acid dosing correction is recommended.", action: ph < 6.5 ? "ADJUST ALKALINE DOSING" : "ADJUST ACID DOSING", level: "action", confidence: 84, icon: FlaskConical });
  } else {
    decisions.push({ id: "ph", parameter: "pH LEVEL", condition: `pH ${ph.toFixed(2)} — optimal balance`, value: ph.toFixed(2), unit: "pH", recommendation: "Chemical balance is optimal. The pH is well within the 6.5–8.5 safety band. No dosing adjustment is necessary.", action: "MAINTAIN CURRENT DOSING", level: "nominal", confidence: 99, icon: FlaskConical });
  }

  return decisions;
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

      {/* JARVIS recommendation */}
      <div className="rounded-lg p-3 mb-3" style={{ background: "oklch(0.08 0.01 145 / 0.8)", border: "1px solid oklch(0.2 0.03 145)" }}>
        <div className="text-[8px] font-bold tracking-[0.2em] text-muted-foreground mb-1.5">ETHM AI ANALYSIS</div>
        <p className="text-[10px] text-foreground/80 leading-relaxed tracking-wide italic">
          "{decision.recommendation}"
        </p>
      </div>

      {/* Action + confidence */}
      <div className="flex items-center gap-2">
        <motion.div
          className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-widest"
          style={{ color: cfg.color, background: `${cfg.color}15`, border: `1px solid ${cfg.color}44` }}
        >
          <ChevronRight className="w-3 h-3 shrink-0" />
          {decision.action}
        </motion.div>
        <div className="text-right shrink-0">
          <div className="text-[8px] text-muted-foreground tracking-widest">CONFIDENCE</div>
          <div className="font-mono text-xs font-bold" style={{ color: cfg.color }}>{decision.confidence}%</div>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="mt-2 h-0.5 rounded-full bg-muted/20 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${decision.confidence}%`, backgroundColor: cfg.color }}
          transition={{ duration: 0.6 }}
        />
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
            height: [`${8 + Math.random() * 16}px`, `${4 + Math.random() * 20}px`, `${8 + Math.random() * 16}px`],
            opacity: [0.4, 0.9, 0.4],
          } : { height: "3px", opacity: 0.2 }}
          transition={{ duration: 0.4 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.05 }}
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
  const [tds, setTds] = useState(245);
  const [turbidity, setTurbidity] = useState(0.8);
  const [ph, setPh] = useState(7.2);
  const [processing, setProcessing] = useState(false);
  const [decisions, setDecisions] = useState<Decision[]>(() => buildDecisions(245, 0.8, 7.2));
  const [cycleCount, setCycleCount] = useState(1);
  const [ethmLine, setEthmLine] = useState(ETHM_LINES[0]);
  const [speaking, setSpeaking] = useState(false);
  const [booted, setBooted] = useState(false);
  const [activeDecision, setActiveDecision] = useState<string | null>(null);
  const lineRef = useRef(0);

  const { voiceEnabled, toggleVoice, speak, isSpeaking } = useEthmVoice();

  // Boot animation
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 2200);
    return () => clearTimeout(t);
  }, []);

  // Live data simulation
  useEffect(() => {
    const interval = setInterval(() => {
      const newTds = Math.max(50, Math.min(900, tds + (Math.random() - 0.5) * 35));
      const newTurb = Math.max(0, Math.min(35, turbidity + (Math.random() - 0.48) * 2));
      const newPh = Math.max(4, Math.min(11, ph + (Math.random() - 0.5) * 0.18));

      setTds(newTds);
      setTurbidity(newTurb);
      setPh(newPh);
      setProcessing(true);

      setTimeout(() => {
        setDecisions(buildDecisions(newTds, newTurb, newPh));
        setProcessing(false);
        setCycleCount(c => c + 1);
        setSpeaking(true);
        lineRef.current = (lineRef.current + 1) % ETHM_LINES.length;
        setEthmLine(ETHM_LINES[lineRef.current]);
        setTimeout(() => setSpeaking(false), 2000);
      }, 700);
    }, 3000);
    return () => clearInterval(interval);
  }, [tds, turbidity, ph]);

  const criticalCount = decisions.filter(d => d.level === "critical").length;
  const actionCount = decisions.filter(d => d.level === "action").length;
  const overallLevel: DecisionLevel = criticalCount > 0 ? "critical" : actionCount > 0 ? "action" : "nominal";
  const overallCfg = LEVEL_CFG[overallLevel];

  // Build the verbal status report — brief, male British style
  const buildStatusReport = useCallback((lvl: DecisionLevel, d: Decision[]) => {
    if (lvl === "nominal") {
      return "All systems nominal. No action required.";
    }
    const flagged = d.filter(x => x.level !== "nominal");
    const items = flagged.map(x => `${x.parameter}: ${x.value} ${x.unit}`.trim()).join(". ");
    return `${flagged.length} parameter${flagged.length > 1 ? "s" : ""} flagged. ${items}. Review recommended.`;
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
              INTELLIGENT SAFETY & CONTROL ASSISTANT
            </div>
          </motion.div>
          <div className="space-y-1.5">
            {[
              "Initialising neural inference engine...",
              "Loading water quality decision matrix...",
              "Calibrating sensor fusion protocols...",
              "Connecting to filtration control bus...",
              "Running self-diagnostic... OK",
              "Ethm AI online. Good day, operator.",
            ].map((line, i) => (
              <BootLine key={i} text={line} delay={i * 300} />
            ))}
          </div>
          <div className="flex justify-center mt-6">
            <ArcReactor level="nominal" processing={true} />
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
              ETHM AI — WATER SYSTEMS AI
            </h2>
          </div>
          <div className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground mt-0.5">
            ANALYSIS ENGINE v4.1 · CYCLE #{cycleCount} · {new Date().toLocaleTimeString()}
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
              {criticalCount > 0 ? `${criticalCount} CRITICAL` : actionCount > 0 ? `${actionCount} ACTION REQ` : "NOMINAL"}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Central JARVIS panel */}
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
                    overallLevel === "nominal" ? "ALL PARAMETERS WITHIN SAFE OPERATING RANGE." :
                    overallLevel === "action" ? "CORRECTIVE MEASURES RECOMMENDED, SIR." :
                    "IMMEDIATE INTERVENTION REQUIRED. STANDING BY."}
                </motion.div>
              </motion.div>

              {/* Live metrics strip */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "TDS", value: tds.toFixed(0), unit: "ppm", ok: tds < 500 },
                  { label: "TURBIDITY", value: turbidity.toFixed(2), unit: "NTU", ok: turbidity < 20 },
                  { label: "pH LEVEL", value: ph.toFixed(2), unit: "", ok: ph >= 6.5 && ph <= 8.5 },
                ].map(m => {
                  const color = m.ok ? "#22c55e" : "#ef4444";
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
                <VoiceWave active={speaking || processing || isSpeaking} color={overallCfg.color} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[8px] tracking-[0.25em] text-muted-foreground mb-0.5">ETHM AI</div>
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
            { if: "Turbidity > 20.0 NTU", then: "Activate secondary filtration", level: "critical" as DecisionLevel },
            { if: "Turbidity > 1.0 NTU", then: "Backwash filter media", level: "action" as DecisionLevel },
            { if: "pH < 5.5 or pH > 9.5", then: "Emergency chemical dosing", level: "critical" as DecisionLevel },
            { if: "pH outside 6.5–8.5", then: "Adjust chemical dosing", level: "action" as DecisionLevel },
            { if: "TDS > 600 ppm", then: "Engage flushing protocol", level: "critical" as DecisionLevel },
            { if: "TDS 300–600 ppm", then: "Increase filtration rate", level: "action" as DecisionLevel },
            { if: "All parameters nominal", then: "Continue normal operation", level: "nominal" as DecisionLevel },
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
