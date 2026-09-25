import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { motion } from "motion/react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import {
  Droplets, Wind, FlaskConical, Activity, Wifi, WifiOff, AlertTriangle,
  Cpu, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  classifyTds, classifyTurbidity, classifyPh,
  LEVEL_COLOR, LEVEL_LABEL, type SafetyLevel,
} from "@/lib/dwms-safety.ts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";

type DataPoint = { time: string; tds: number; turbidity: number; ph: number };

type GaugeProps = {
  value: number; min: number; max: number; label: string;
  unit: string; status: SafetyLevel; icon: React.ReactNode;
};

function RadialGauge({ value, min, max, label, unit, status, icon }: GaugeProps) {
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const angle = pct * 240 - 120;
  const color = LEVEL_COLOR[status];
  const cx = 80, cy = 80, r = 60;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcX = (deg: number) => cx + r * Math.cos(toRad(deg - 90));
  const arcY = (deg: number) => cy + r * Math.sin(toRad(deg - 90));
  const bgStart = -120, bgEnd = 120;
  const fgEnd = bgStart + pct * 240;
  const bgPath = `M ${arcX(bgStart)} ${arcY(bgStart)} A ${r} ${r} 0 1 1 ${arcX(bgEnd)} ${arcY(bgEnd)}`;
  const fgPath = pct > 0
    ? `M ${arcX(bgStart)} ${arcY(bgStart)} A ${r} ${r} 0 ${pct > 0.75 ? 1 : 0} 1 ${arcX(fgEnd)} ${arcY(fgEnd)}`
    : "";
  const nx = cx + 50 * Math.cos(toRad(angle - 90));
  const ny = cy + 50 * Math.sin(toRad(angle - 90));

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="160" height="130" viewBox="0 0 160 130">
        <path d={bgPath} fill="none" stroke="#1e2a3a" strokeWidth="10" strokeLinecap="round" />
        {fgPath && (
          <motion.path
            d={fgPath} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeOut" as const }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        )}
        <motion.line
          x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="2.5" strokeLinecap="round"
          animate={{ x2: nx, y2: ny }} transition={{ type: "spring", stiffness: 80, damping: 15 }}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
        <circle cx={cx} cy={cy} r="5" fill={color} />
        <foreignObject x="66" y="92" width="28" height="28">
          <div className="flex items-center justify-center w-7 h-7 opacity-60">{icon}</div>
        </foreignObject>
      </svg>
      <div className="text-center">
        <div className="font-mono text-2xl font-bold" style={{ color }}>
          {value.toFixed(1)}<span className="text-sm ml-1 opacity-70">{unit}</span>
        </div>
        <div className="text-xs font-semibold tracking-widest text-muted-foreground mt-0.5">{label}</div>
        <div className="text-xs font-bold tracking-widest mt-1 px-2 py-0.5 rounded-full"
          style={{ color, border: `1px solid ${color}`, background: `${color}18` }}>
          {LEVEL_LABEL[status]}
        </div>
      </div>
    </div>
  );
}

/** Flow diagram showing the one-way sensor data pipeline */
function SensorFlowDiagram({ isOnline }: { isOnline: boolean }) {
  const nodes = [
    { label: "Sensors", icon: "📡" },
    { label: "Arduino", icon: "⚡" },
    { label: "Serial", icon: "🔌" },
    { label: "Python", icon: "🐍" },
    { label: "Cloud", icon: "☁️" },
    { label: "Dashboard", icon: "📊" },
  ];
  return (
    <div className="flex items-center justify-between flex-wrap gap-2 py-2">
      {nodes.map((node, i) => (
        <div key={node.label} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl border-2"
              style={{
                borderColor: isOnline ? "oklch(0.6 0.17 145)" : "#6b7280",
                background: "oklch(0.12 0.02 145)",
                boxShadow: isOnline ? `0 0 10px oklch(0.6 0.17 145 / 0.4)` : "none",
              }}>
              {node.icon}
            </div>
            <span className="text-[10px] text-muted-foreground font-semibold tracking-wider text-center w-14">{node.label}</span>
          </div>
          {i < nodes.length - 1 && (
            <div className="flex items-center mb-4">
              <motion.div className="w-6 h-0.5 rounded-full" style={{ background: "oklch(0.6 0.17 145)" }}
                animate={{ opacity: isOnline ? [0.3, 1, 0.3] : 0.2 }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }} />
              <div className="w-0 h-0 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent"
                style={{ borderLeftColor: "oklch(0.6 0.17 145)" }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DashboardInner() {
  const devices = useQuery(api.devices.listDevices, {});
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // Auto-select first device
  useEffect(() => {
    if (devices && devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].deviceId);
    }
  }, [devices, selectedDeviceId]);

  const latestReading = useQuery(
    api.devices.getLatestReading,
    selectedDeviceId ? { deviceId: selectedDeviceId } : "skip"
  );
  const recentReadings = useQuery(
    api.devices.getRecentReadings,
    selectedDeviceId ? { deviceId: selectedDeviceId, limit: 30 } : "skip"
  );

  const selectedDevice = devices?.find((d) => d.deviceId === selectedDeviceId);
  const isOnline = selectedDevice?.status === "online";

  // Build chart data from recent readings (reversed to show oldest first)
  const history: DataPoint[] = (recentReadings ?? [])
    .slice()
    .reverse()
    .map((r) => ({
      time: new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      tds: r.tds,
      turbidity: r.turbidity,
      ph: r.ph,
    }));

  // Current values
  const ph = latestReading?.ph ?? 7;
  const tds = latestReading?.tds ?? 0;
  const turbidity = latestReading?.turbidity ?? 0;

  // Classify safety levels
  const tdsStatus = classifyTds(tds);
  const turbStatus = classifyTurbidity(turbidity);
  const phStatus = classifyPh(ph);

  // Overall water quality
  const levels: SafetyLevel[] = [phStatus, tdsStatus, turbStatus];
  const quality: SafetyLevel = levels.includes("critical") ? "critical" : levels.includes("warning") ? "warning" : "safe";

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-widest text-primary uppercase">Live Dashboard</h2>
          <p className="text-xs text-muted-foreground tracking-wider">DWMS — Real-time water quality monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.div animate={{ opacity: isOnline ? [1, 0.3, 1] : 0.3 }} transition={{ duration: 1.5, repeat: Infinity }}
            className="w-2 h-2 rounded-full" style={{ background: isOnline ? LEVEL_COLOR[quality] : "#6b7280" }} />
          <span className="text-xs font-bold tracking-widest" style={{ color: isOnline ? LEVEL_COLOR[quality] : "#6b7280" }}>
            {isOnline ? `WATER ${LEVEL_LABEL[quality]}` : "OFFLINE"}
          </span>
        </div>
      </div>

      {/* Device selector */}
      {devices && devices.length > 1 && (
        <Card className="p-4">
          <div className="text-[10px] font-semibold tracking-widest text-muted-foreground mb-2">SELECT DEVICE</div>
          <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
            <SelectTrigger className="w-full cursor-pointer">
              <SelectValue placeholder="Choose a device..." />
            </SelectTrigger>
            <SelectContent>
              {devices.map((d) => (
                <SelectItem key={d.deviceId} value={d.deviceId} className="cursor-pointer">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: d.status === "online" ? "#22c55e" : "#6b7280" }} />
                    {d.name}
                    <span className="text-muted-foreground text-xs">({d.deviceId})</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>
      )}

      {/* Status indicator cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusCard icon={isOnline ? Wifi : WifiOff} label="DEVICE STATUS" value={isOnline ? "ONLINE" : "OFFLINE"} color={isOnline ? "#22c55e" : "#6b7280"} />
        <StatusCard icon={Droplets} label="WATER QUALITY" value={latestReading ? LEVEL_LABEL[quality] : "—"} color={latestReading ? LEVEL_COLOR[quality] : "#6b7280"} />
        <StatusCard icon={Clock} label="LAST READING" value={latestReading ? new Date(latestReading.timestamp).toLocaleTimeString() : "—"} color="#3b82f6" />
        <StatusCard icon={Cpu} label="DEVICE" value={selectedDevice?.name ?? "None"} color="#00f5d4" />
      </div>

      {/* Gauges */}
      {latestReading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "TDS", value: tds, min: 0, max: 2000, unit: "ppm", status: tdsStatus, icon: <Droplets className="w-4 h-4 text-emerald-400" /> },
            { label: "TURBIDITY", value: turbidity, min: 0, max: 100, unit: "NTU", status: turbStatus, icon: <Wind className="w-4 h-4 text-yellow-400" /> },
            { label: "pH LEVEL", value: ph, min: 0, max: 14, unit: "pH", status: phStatus, icon: <FlaskConical className="w-4 h-4 text-green-400" /> },
          ].map((g) => (
            <Card key={g.label} className="border-border flex items-center justify-center py-4">
              <RadialGauge value={g.value} min={g.min} max={g.max} label={g.label} unit={g.unit} status={g.status} icon={g.icon} />
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center space-y-3">
          <Cpu className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-bold tracking-widest text-muted-foreground">NO SENSOR DATA</p>
          <p className="text-xs text-muted-foreground">Connect your Arduino and run the Python Serial Bridge to start receiving data</p>
        </Card>
      )}

      {/* Live Graph */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
              <Activity className="w-4 h-4" /> LIVE SENSOR GRAPH
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.04 145)" />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "oklch(0.55 0.04 145)" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "oklch(0.55 0.04 145)" }} />
                <Tooltip contentStyle={{ background: "oklch(0.14 0.02 145)", border: "1px solid oklch(0.25 0.04 145)", borderRadius: 6 }}
                  labelStyle={{ color: "oklch(0.92 0.02 145)", fontSize: 10 }} itemStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="tds" stroke="#22c55e" strokeWidth={2} dot={false} name="TDS (ppm)" />
                <Line type="monotone" dataKey="turbidity" stroke="#eab308" strokeWidth={2} dot={false} name="Turbidity (NTU)" />
                <Line type="monotone" dataKey="ph" stroke="#a855f7" strokeWidth={2} dot={false} name="pH" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* System Flow Diagram */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
            <Wifi className="w-4 h-4" /> DATA FLOW
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SensorFlowDiagram isOnline={isOnline} />
        </CardContent>
      </Card>

      {/* Status Summary */}
      {latestReading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "TDS Level", value: `${tds.toFixed(0)} ppm`, status: tdsStatus },
            { label: "Turbidity", value: `${turbidity.toFixed(2)} NTU`, status: turbStatus },
            { label: "pH Level", value: ph.toFixed(2), status: phStatus },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border p-3"
              style={{ borderColor: LEVEL_COLOR[item.status], background: `${LEVEL_COLOR[item.status]}10` }}>
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground">{item.label}</div>
              <div className="font-mono font-bold text-lg mt-1" style={{ color: LEVEL_COLOR[item.status] }}>{item.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Warning banner */}
      {latestReading && quality !== "safe" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-lg border p-3"
          style={{ borderColor: LEVEL_COLOR[quality], background: `${LEVEL_COLOR[quality]}12` }}>
          <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: LEVEL_COLOR[quality] }} />
          <div>
            <div className="text-sm font-bold" style={{ color: LEVEL_COLOR[quality] }}>
              {quality === "critical" ? "WATER UNSAFE — CHECK SENSORS IMMEDIATELY" : "WARNING — PARAMETERS APPROACHING LIMITS"}
            </div>
            <div className="text-xs text-muted-foreground">
              {quality === "critical"
                ? "One or more readings are in the critical range. Investigate immediately."
                : "One or more readings are outside the normal range. Monitor closely."}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── Status indicator card ──────────────────────────────────────────────────
function StatusCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string;
}) {
  return (
    <div className="rounded-lg border p-3 flex items-center gap-3" style={{ borderColor: `${color}55`, background: `${color}0d` }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-semibold tracking-widest text-muted-foreground truncate">{label}</div>
        <div className="font-mono font-bold text-xs mt-0.5 truncate" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <>
      <Unauthenticated>
        <div className="flex items-center justify-center h-full p-6">
          <div className="text-center space-y-4">
            <Droplets className="w-12 h-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Sign in to view the water quality dashboard</p>
            <SignInButton />
          </div>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
          </div>
        </div>
      </AuthLoading>
      <Authenticated>
        <DashboardInner />
      </Authenticated>
    </>
  );
}
