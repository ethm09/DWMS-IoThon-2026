import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, AlertCircle, CheckCircle, Info, Bell, BellOff, Trash2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AlertLevel = "critical" | "warning" | "info" | "ok";

type Alert = {
  id: number;
  level: AlertLevel;
  title: string;
  message: string;
  time: string;
  parameter?: string;
  value?: string;
  dismissed: boolean;
};

const LEVEL_CONFIG: Record<AlertLevel, { color: string; bg: string; border: string; iconClass: string }> = {
  critical: { color: "#ef4444", bg: "#ef444412", border: "#ef444455", iconClass: "text-red-500" },
  warning:  { color: "#eab308", bg: "#eab30812", border: "#eab30855", iconClass: "text-yellow-500" },
  info:     { color: "#06b6d4", bg: "#06b6d412", border: "#06b6d455", iconClass: "text-cyan-400" },
  ok:       { color: "#22c55e", bg: "#22c55e12", border: "#22c55e55", iconClass: "text-green-500" },
};

const LEVEL_ICONS: Record<AlertLevel, React.FC<{ className?: string }>> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  ok: CheckCircle,
};

function generateAlerts(tds: number, turbidity: number, ph: number, idBase: number): Omit<Alert, "id" | "dismissed">[] {
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}:${now.getSeconds().toString().padStart(2,"0")}`;
  const alerts: Omit<Alert, "id" | "dismissed">[] = [];

  if (tds > 600) {
    alerts.push({ level: "critical", title: "CRITICAL TDS LEVEL", message: "Total Dissolved Solids exceed safe limit. Flushing system recommended immediately.", time: timeStr, parameter: "TDS", value: `${tds.toFixed(0)} ppm` });
  } else if (tds > 300) {
    alerts.push({ level: "warning", title: "ELEVATED TDS DETECTED", message: "TDS approaching unsafe range. Monitor closely and prepare treatment protocol.", time: timeStr, parameter: "TDS", value: `${tds.toFixed(0)} ppm` });
  }

  if (turbidity > 4) {
    alerts.push({ level: "critical", title: "WATER UNSAFE — TREATMENT ACTIVATED", message: "High turbidity detected. Water quality unsafe. Filtration system has been automatically engaged.", time: timeStr, parameter: "Turbidity", value: `${turbidity.toFixed(2)} NTU` });
  } else if (turbidity > 1) {
    alerts.push({ level: "warning", title: "TURBIDITY WARNING", message: "Suspended particles detected above threshold. Increased filtration recommended.", time: timeStr, parameter: "Turbidity", value: `${turbidity.toFixed(2)} NTU` });
  }

  if (ph < 5.5 || ph > 9.5) {
    alerts.push({ level: "critical", title: "CRITICAL pH IMBALANCE", message: "pH outside safe range. Chemical adjustment required immediately to prevent equipment damage.", time: timeStr, parameter: "pH", value: ph.toFixed(2) });
  } else if (ph < 6.5 || ph > 8.5) {
    alerts.push({ level: "warning", title: "pH OUT OF OPTIMAL RANGE", message: "pH level deviating from target. Chemical dosing adjustment advised.", time: timeStr, parameter: "pH", value: ph.toFixed(2) });
  }

  if (alerts.length === 0) {
    alerts.push({ level: "ok", title: "ALL PARAMETERS NORMAL", message: "Water quality within safe limits. System operating normally.", time: timeStr });
  }

  return alerts;
}

let globalId = 100;

export default function Alerts() {
  const [tds, setTds] = useState(245);
  const [turbidity, setTurbidity] = useState(0.8);
  const [ph, setPh] = useState(7.2);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [muted, setMuted] = useState(false);
  const [filter, setFilter] = useState<AlertLevel | "all">("all");
  const mountRef = useRef(false);

  // Simulate sensor data
  useEffect(() => {
    const interval = setInterval(() => {
      setTds((v) => Math.max(50, Math.min(900, v + (Math.random() - 0.5) * 30)));
      setTurbidity((v) => Math.max(0, Math.min(10, v + (Math.random() - 0.5) * 0.5)));
      setPh((v) => Math.max(4, Math.min(11, v + (Math.random() - 0.5) * 0.15)));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Generate alerts when sensors change
  useEffect(() => {
    if (!mountRef.current) {
      mountRef.current = true;
      // Seed initial alerts
      const initial = generateAlerts(tds, turbidity, ph, 0).map((a) => ({ ...a, id: globalId++, dismissed: false }));
      setAlerts(initial);
      return;
    }
    const newOnes = generateAlerts(tds, turbidity, ph, globalId).map((a) => ({ ...a, id: globalId++, dismissed: false }));
    // Only add if level changed or critical/warning
    const latest = newOnes[0];
    if (latest && latest.level !== "ok") {
      setAlerts((prev) => [latest, ...prev.slice(0, 49)]);
    }
  }, [Math.round(tds / 50), Math.round(turbidity * 2), Math.round(ph * 2)]);

  const dismiss = (id: number) => setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, dismissed: true } : a));
  const clearAll = () => setAlerts([]);

  const visible = alerts.filter((a) => !a.dismissed && (filter === "all" || a.level === filter));
  const counts = { critical: alerts.filter((a) => !a.dismissed && a.level === "critical").length, warning: alerts.filter((a) => !a.dismissed && a.level === "warning").length, info: alerts.filter((a) => !a.dismissed && a.level === "info").length, ok: alerts.filter((a) => !a.dismissed && a.level === "ok").length };

  const systemLevel: AlertLevel = counts.critical > 0 ? "critical" : counts.warning > 0 ? "warning" : "ok";
  const sysConfig = LEVEL_CONFIG[systemLevel];

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-widest text-primary uppercase">Smart Alerts System</h2>
          <p className="text-xs text-muted-foreground tracking-wider">Real-time anomaly detection and automated warnings</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setMuted((v) => !v)}
            className="cursor-pointer text-xs font-bold tracking-widest"
            style={{ background: "transparent", border: "1px solid oklch(0.25 0.04 145)", color: "oklch(0.55 0.04 145)" }}
          >
            {muted ? <BellOff className="w-3.5 h-3.5 mr-1" /> : <Bell className="w-3.5 h-3.5 mr-1" />}
            {muted ? "UNMUTE" : "MUTE"}
          </Button>
          <Button
            onClick={clearAll}
            className="cursor-pointer text-xs font-bold tracking-widest"
            style={{ background: "transparent", border: "1px solid oklch(0.25 0.04 145)", color: "oklch(0.55 0.04 145)" }}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> CLEAR
          </Button>
        </div>
      </div>

      {/* System status banner */}
      <motion.div
        className="rounded-xl border-2 p-4 flex items-center gap-4"
        animate={{ borderColor: sysConfig.border, background: sysConfig.bg }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          className="w-12 h-12 rounded-full border-2 flex items-center justify-center shrink-0"
          animate={{ borderColor: sysConfig.color, boxShadow: `0 0 20px ${sysConfig.color}55` }}
        >
          {systemLevel === "ok"
            ? <ShieldCheck className="w-6 h-6" style={{ color: sysConfig.color }} />
            : <AlertCircle className="w-6 h-6" style={{ color: sysConfig.color }} />
          }
        </motion.div>
        <div className="flex-1">
          <motion.div className="font-bold tracking-widest" animate={{ color: sysConfig.color }}>
            {systemLevel === "ok" ? "SYSTEM HEALTHY — ALL PARAMETERS SAFE" : systemLevel === "warning" ? "SYSTEM WARNING — PARAMETERS APPROACHING LIMITS" : "SYSTEM CRITICAL — IMMEDIATE ACTION REQUIRED"}
          </motion.div>
          <div className="text-xs text-muted-foreground mt-1 font-mono">
            TDS: {tds.toFixed(0)} ppm &nbsp;|&nbsp; Turbidity: {turbidity.toFixed(2)} NTU &nbsp;|&nbsp; pH: {ph.toFixed(2)}
          </div>
        </div>
        {systemLevel !== "ok" && (
          <motion.div
            className="w-3 h-3 rounded-full shrink-0"
            animate={{ backgroundColor: sysConfig.color, opacity: [1, 0.2, 1], boxShadow: `0 0 10px ${sysConfig.color}` }}
            transition={{ opacity: { duration: 0.8, repeat: Infinity } }}
          />
        )}
      </motion.div>

      {/* Count badges */}
      <div className="flex flex-wrap gap-2">
        {([["all", "ALL", "#6b7280"], ["critical", "CRITICAL", "#ef4444"], ["warning", "WARNING", "#eab308"], ["ok", "NORMAL", "#22c55e"]] as const).map(([key, label, color]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest border cursor-pointer transition-all"
            style={{
              color: filter === key ? "#0f172a" : color,
              background: filter === key ? color : `${color}15`,
              borderColor: color,
            }}
          >
            {label} {key !== "all" && <span className="ml-1">{counts[key as AlertLevel] ?? 0}</span>}
          </button>
        ))}
      </div>

      {/* Alert feed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
            <Bell className="w-4 h-4" /> ALERT FEED
            {counts.critical > 0 && (
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#ef444422", color: "#ef4444", border: "1px solid #ef444455" }}
              >
                {counts.critical} CRITICAL
              </motion.span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {visible.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm tracking-wider">
                  No alerts to display
                </div>
              )}
              {visible.map((alert) => {
                const cfg = LEVEL_CONFIG[alert.level];
                const Icon = LEVEL_ICONS[alert.level];
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -16, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    exit={{ opacity: 0, x: 16, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="rounded-lg border p-3 flex items-start gap-3"
                    style={{ borderColor: cfg.border, background: cfg.bg }}
                  >
                    <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${cfg.iconClass}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold tracking-widest" style={{ color: cfg.color }}>{alert.title}</span>
                        {alert.parameter && (
                          <span
                            className="text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded-full"
                            style={{ background: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.border}` }}
                          >
                            {alert.parameter}: {alert.value}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{alert.message}</p>
                      <div className="text-[9px] font-mono text-muted-foreground/60 mt-1">{alert.time}</div>
                    </div>
                    <button
                      onClick={() => dismiss(alert.id)}
                      className="text-muted-foreground/40 hover:text-muted-foreground transition-colors cursor-pointer shrink-0 mt-0.5"
                    >
                      ✕
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Quick reference thresholds */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary">SAFETY THRESHOLDS REFERENCE</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { param: "TDS", unit: "ppm", ranges: [{ label: "Safe", range: "< 300", color: "#22c55e" }, { label: "Warning", range: "300 – 600", color: "#eab308" }, { label: "Critical", range: "> 600", color: "#ef4444" }], current: tds.toFixed(0) },
              { param: "Turbidity", unit: "NTU", ranges: [{ label: "Safe", range: "< 1.0", color: "#22c55e" }, { label: "Warning", range: "1.0 – 4.0", color: "#eab308" }, { label: "Critical", range: "> 4.0", color: "#ef4444" }], current: turbidity.toFixed(2) },
              { param: "pH", unit: "", ranges: [{ label: "Safe", range: "6.5 – 8.5", color: "#22c55e" }, { label: "Warning", range: "5.5 – 9.5", color: "#eab308" }, { label: "Critical", range: "< 5.5 or > 9.5", color: "#ef4444" }], current: ph.toFixed(2) },
            ].map((p) => (
              <div key={p.param} className="space-y-1.5">
                <div className="text-[10px] font-bold tracking-widest text-foreground">{p.param} {p.unit && `(${p.unit})`} — <span className="text-primary font-mono">{p.current}{p.unit ? ` ${p.unit}` : ""}</span></div>
                {p.ranges.map((r) => (
                  <div key={r.label} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                    <span className="text-[10px] tracking-wider" style={{ color: r.color }}>{r.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-auto">{r.range}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
