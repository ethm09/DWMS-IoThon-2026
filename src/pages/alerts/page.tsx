import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, AlertCircle, CheckCircle, Info, Bell, Trash2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth.ts";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import { classifyPh, classifyTds, classifyTurbidity, THRESHOLDS } from "@/lib/dwms-safety.ts";

type AlertLevel = "critical" | "warning" | "info" | "ok";

type Alert = {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  time: string;
  parameter?: string;
  value?: string;
  notificationId?: Id<"notifications">;
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

function buildSnapshotAlerts(
  tds: number,
  turbidity: number,
  ph: number,
  timestamp: string,
): Alert[] {
  const time = new Date(timestamp).toLocaleString();
  const parameters = [
    { id: "tds", name: "TDS", text: `${tds.toFixed(0)} ppm`, level: classifyTds(tds) },
    { id: "turbidity", name: "Turbidity", text: `${turbidity.toFixed(2)} NTU`, level: classifyTurbidity(turbidity) },
    { id: "ph", name: "pH", text: ph.toFixed(2), level: classifyPh(ph) },
  ];
  const flagged = parameters.filter((parameter) => parameter.level !== "safe");
  if (flagged.length === 0) {
    return [{
      id: "demo-current-ok",
      level: "ok",
      title: "NO CURRENT THRESHOLD ALERTS",
      message: "This demo snapshot falls inside the shared prototype thresholds; it is not a water-safety certification.",
      time,
    }];
  }
  return flagged.map((parameter) => ({
    id: `demo-${parameter.id}-${parameter.level}`,
    level: parameter.level === "critical" ? "critical" : "warning",
    title: `${parameter.name.toUpperCase()} ${parameter.level.toUpperCase()} THRESHOLD`,
    message: `${parameter.name} is outside the prototype safe band. Verify the reading and follow validated site procedures; this notice does not prescribe treatment.`,
    time,
    parameter: parameter.name,
    value: parameter.text,
  }));
}

export default function Alerts() {
  const [filter, setFilter] = useState<AlertLevel | "all">("all");
  const [dismissedDemoIds, setDismissedDemoIds] = useState<string[]>([]);
  const { isAuthenticated } = useAuth();
  const { dataMode, selectedDeviceId, readings: demoReadings, lastUpdated } = useProcessMode();
  const notifications = useQuery(
    api.notifications.list,
    dataMode === "hardware" && isAuthenticated ? { limit: 50 } : "skip",
  );
  const latestHardwareReading = useQuery(
    api.devices.getLatestReading,
    dataMode === "hardware" && isAuthenticated && selectedDeviceId
      ? { deviceId: selectedDeviceId }
      : "skip",
  );
  const dismissNotification = useMutation(api.notifications.dismiss);
  const dismissAllNotifications = useMutation(api.notifications.dismissAll);

  const isLoadingHardwareReading =
    dataMode === "hardware" && isAuthenticated && Boolean(selectedDeviceId) && latestHardwareReading === undefined;
  const isLoadingHardwareNotifications =
    dataMode === "hardware" && isAuthenticated && notifications === undefined;
  const currentValues = dataMode === "hardware"
    ? latestHardwareReading ?? null
    : demoReadings.ph !== null && demoReadings.tds !== null && demoReadings.turbidity !== null
      ? { ph: demoReadings.ph, tds: demoReadings.tds, turbidity: demoReadings.turbidity }
      : null;
  const hasSensorData = currentValues !== null;
  const currentQuality: AlertLevel = !currentValues
    ? "info"
    : [classifyPh(currentValues.ph), classifyTds(currentValues.tds), classifyTurbidity(currentValues.turbidity)].includes("critical")
      ? "critical"
      : [classifyPh(currentValues.ph), classifyTds(currentValues.tds), classifyTurbidity(currentValues.turbidity)].includes("warning")
        ? "warning"
        : "ok";
  const demoAlerts = currentValues && dataMode === "demo"
    ? buildSnapshotAlerts(currentValues.tds, currentValues.turbidity, currentValues.ph, lastUpdated)
    : [];
  const storedAlerts: Alert[] = (notifications ?? []).map((notification) => ({
    id: notification._id,
    notificationId: notification._id,
    level: notification.level,
    title: notification.title,
    message: notification.message,
    time: new Date(notification.createdAt).toLocaleString(),
    parameter: notification.parameter,
    value: notification.value,
  }));
  const alerts = dataMode === "hardware" ? storedAlerts : demoAlerts;
  const visible = alerts.filter((alert) =>
    (dataMode === "hardware" || !dismissedDemoIds.includes(alert.id)) &&
    (filter === "all" || alert.level === filter),
  );
  const count = (level: AlertLevel) => alerts.filter((alert) =>
    (dataMode === "hardware" || !dismissedDemoIds.includes(alert.id)) && alert.level === level,
  ).length;
  const counts = { critical: count("critical"), warning: count("warning"), info: count("info"), ok: count("ok") };
  const statusMessage = dataMode === "hardware"
    ? !isAuthenticated
      ? "SIGN IN TO VIEW SAVED DEVICE ALERTS"
      : !selectedDeviceId
        ? "SELECT A DEVICE TO VIEW ITS CURRENT SENSOR STATUS"
        : isLoadingHardwareReading
          ? "LOADING DEVICE SENSOR STATUS…"
          : !hasSensorData
            ? "NO SAVED SENSOR READING AVAILABLE"
            : currentQuality === "critical"
              ? "CURRENT DEVICE READING EXCEEDS A CRITICAL PROTOTYPE THRESHOLD"
              : currentQuality === "warning"
                ? "CURRENT DEVICE READING IS OUTSIDE A PROTOTYPE SAFE BAND"
                : "CURRENT DEVICE READING IS WITHIN PROTOTYPE SAFE BANDS"
    : !hasSensorData
      ? "NO DEMO SENSOR SNAPSHOT AVAILABLE"
      : currentQuality === "critical"
        ? "DEMO SNAPSHOT EXCEEDS A CRITICAL PROTOTYPE THRESHOLD"
        : currentQuality === "warning"
          ? "DEMO SNAPSHOT IS OUTSIDE A PROTOTYPE SAFE BAND"
          : "DEMO SNAPSHOT IS WITHIN PROTOTYPE SAFE BANDS";
  const systemLevel = currentQuality;
  const sysConfig = LEVEL_CONFIG[systemLevel];

  const dismiss = async (alert: Alert) => {
    if (alert.notificationId) {
      try {
        await dismissNotification({ notificationId: alert.notificationId });
      } catch {
        toast.error("Could not dismiss this saved notification");
      }
      return;
    }
    setDismissedDemoIds((previous) => [...new Set([...previous, alert.id])]);
  };

  const dismissAll = async () => {
    if (dataMode === "hardware") {
      try {
        const dismissedCount = await dismissAllNotifications({});
        toast.success(`${dismissedCount} saved notifications dismissed`);
      } catch {
        toast.error("Could not dismiss saved notifications");
      }
      return;
    }
    setDismissedDemoIds(alerts.map((alert) => alert.id));
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-widest text-primary uppercase">Sensor Alerts</h2>
          <p className="text-xs text-muted-foreground tracking-wider">
            {dataMode === "hardware" ? "Saved device notifications and latest sensor status" : "Current demo snapshot alerts"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => void dismissAll()}
            disabled={alerts.length === 0 || (dataMode === "hardware" && isLoadingHardwareNotifications)}
            className="cursor-pointer text-xs font-bold tracking-widest"
            style={{ background: "transparent", border: "1px solid oklch(0.25 0.04 145)", color: "oklch(0.55 0.04 145)" }}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> DISMISS ALL
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[10px] text-muted-foreground">
        <span className="font-bold text-amber-400">
          {dataMode === "hardware" ? `HARDWARE · ${selectedDeviceId || "NO DEVICE SELECTED"}` : "DEMO SIMULATION"}
        </span>
        <span className="mx-2">·</span>
        {dataMode === "hardware"
          ? "The feed shows saved Convex notifications. Current status uses pH, TDS, and turbidity readings only."
          : "The feed shows only the current local snapshot, not a stored alert history."}
        {" "}Thresholds are prototype rules, not a safety certification or treatment instruction.
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
            {statusMessage}
          </motion.div>
          <div className="text-xs text-muted-foreground mt-1 font-mono">
            TDS: {currentValues?.tds.toFixed(0) ?? "—"} ppm &nbsp;|&nbsp; Turbidity: {currentValues?.turbidity.toFixed(2) ?? "—"} NTU &nbsp;|&nbsp; pH: {currentValues?.ph.toFixed(2) ?? "—"}
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
        {([["all", "ALL", "#6b7280"], ["critical", "CRITICAL", "#ef4444"], ["warning", "WARNING", "#eab308"], ["info", "INFO", "#06b6d4"], ["ok", "NO ALERT", "#22c55e"]] as const).map(([key, label, color]) => (
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
                  {isLoadingHardwareNotifications
                    ? "Loading saved notifications…"
                    : dataMode === "hardware" && !isAuthenticated
                      ? "Sign in to view saved device notifications."
                      : "No notifications to display for this source."}
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
                      onClick={() => void dismiss(alert)}
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
          <CardTitle className="text-sm font-bold tracking-widest text-primary">PROTOTYPE SOFTWARE THRESHOLDS</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { param: "TDS", unit: "ppm", ranges: [{ label: "Prototype safe", range: `< ${THRESHOLDS.tds.safe.max}`, color: "#22c55e" }, { label: "Warning", range: `${THRESHOLDS.tds.warning.min}–${THRESHOLDS.tds.critical.above}`, color: "#eab308" }, { label: "Critical", range: `> ${THRESHOLDS.tds.critical.above}`, color: "#ef4444" }], current: currentValues?.tds.toFixed(0) ?? "—" },
              { param: "Turbidity", unit: "NTU", ranges: [{ label: "Prototype safe", range: `< ${THRESHOLDS.turbidity.safe.max}`, color: "#22c55e" }, { label: "Warning", range: `${THRESHOLDS.turbidity.warning.min}–${THRESHOLDS.turbidity.critical.above}`, color: "#eab308" }, { label: "Critical", range: `> ${THRESHOLDS.turbidity.critical.above}`, color: "#ef4444" }], current: currentValues?.turbidity.toFixed(2) ?? "—" },
              { param: "pH", unit: "", ranges: [{ label: "Prototype safe", range: `${THRESHOLDS.ph.safe.min}–${THRESHOLDS.ph.safe.max}`, color: "#22c55e" }, { label: "Warning", range: "5.5–6.5 or 8.5–10", color: "#eab308" }, { label: "Critical", range: `< ${THRESHOLDS.ph.critical.below} or > ${THRESHOLDS.ph.critical.above}`, color: "#ef4444" }], current: currentValues?.ph.toFixed(2) ?? "—" },
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
