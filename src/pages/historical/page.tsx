import { useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import { TrendingUp, TrendingDown, Download, Activity, Droplets, Thermometer, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils.ts";

// ── Types ──────────────────────────────────────────────────────────────────
type TimeRange = "24h" | "7d" | "30d" | "90d";
type MetricKey = "pH" | "turbidity" | "chlorine" | "temperature" | "pressure" | "flow";

interface DataPoint {
  time: string;
  pH: number;
  turbidity: number;
  chlorine: number;
  temperature: number;
  pressure: number;
  flow: number;
  anomaly?: boolean;
}

interface TrendStat {
  key: MetricKey;
  label: string;
  unit: string;
  current: number;
  avg: number;
  min: number;
  max: number;
  trend: number; // percent change
  icon: React.ReactNode;
  color: string;
  threshold: { warn: number; crit: number };
}

// ── Data Generators ────────────────────────────────────────────────────────
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateData(points: number, startSeed = 42): DataPoint[] {
  const rand = seededRandom(startSeed);
  const now = Date.now();
  const interval = (points <= 24 ? 3600 : points <= 168 ? 3600 : 86400) * 1000;

  return Array.from({ length: points }, (_, i) => {
    const t = new Date(now - (points - i) * interval);
    const label =
      points <= 24
        ? t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : points <= 168
        ? t.toLocaleDateString([], { weekday: "short", hour: "2-digit" })
        : t.toLocaleDateString([], { month: "short", day: "numeric" });

    const noise = () => (rand() - 0.5) * 2;
    const anomaly = rand() > 0.95;

    return {
      time: label,
      pH: parseFloat((7.2 + noise() * 0.3 + (anomaly ? 0.6 : 0)).toFixed(2)),
      turbidity: parseFloat((1.8 + rand() * 0.8 + (anomaly ? 2 : 0)).toFixed(2)),
      chlorine: parseFloat((1.5 + noise() * 0.2).toFixed(2)),
      temperature: parseFloat((18 + noise() * 1.5).toFixed(1)),
      pressure: parseFloat((68 + noise() * 4).toFixed(1)),
      flow: parseFloat((420 + noise() * 30).toFixed(0)),
      anomaly,
    };
  });
}

const RANGE_POINTS: Record<TimeRange, number> = { "24h": 24, "7d": 168, "30d": 30, "90d": 90 };

// ── Metric Config ──────────────────────────────────────────────────────────
function buildStats(data: DataPoint[]): TrendStat[] {
  const stat = (key: MetricKey) => {
    const vals = data.map((d) => d[key] as number);
    return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, min: Math.min(...vals), max: Math.max(...vals) };
  };

  return [
    { key: "pH", label: "pH Level", unit: "", ...stat("pH"), current: data.at(-1)!.pH, trend: 0.4, icon: <Droplets className="w-4 h-4" />, color: "#06b6d4", threshold: { warn: 7.8, crit: 8.5 } },
    { key: "turbidity", label: "Turbidity", unit: "NTU", ...stat("turbidity"), current: data.at(-1)!.turbidity, trend: -1.2, icon: <Activity className="w-4 h-4" />, color: "#f59e0b", threshold: { warn: 2.5, crit: 4 } },
    { key: "chlorine", label: "Chlorine", unit: "mg/L", ...stat("chlorine"), current: data.at(-1)!.chlorine, trend: 0.8, icon: <Activity className="w-4 h-4" />, color: "#10b981", threshold: { warn: 2, crit: 3 } },
    { key: "temperature", label: "Temperature", unit: "°C", ...stat("temperature"), current: data.at(-1)!.temperature, trend: -0.3, icon: <Thermometer className="w-4 h-4" />, color: "#f97316", threshold: { warn: 22, crit: 25 } },
    { key: "pressure", label: "Pressure", unit: "PSI", ...stat("pressure"), current: data.at(-1)!.pressure, trend: 1.1, icon: <Activity className="w-4 h-4" />, color: "#8b5cf6", threshold: { warn: 75, crit: 80 } },
    { key: "flow", label: "Flow Rate", unit: "L/m", ...stat("flow"), current: data.at(-1)!.flow, trend: 0.6, icon: <Activity className="w-4 h-4" />, color: "#ec4899", threshold: { warn: 460, crit: 500 } },
  ];
}

// ── Anomaly Events ─────────────────────────────────────────────────────────
const ANOMALY_LABELS = [
  "pH spike detected — Zone 4 sensor",
  "Turbidity exceeded threshold — Filter B",
  "Pressure drop — Main line junction",
  "Temperature anomaly — Sector 2",
  "Chlorine level deviation — Dosing pump",
];

// ── Custom Tooltip ─────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card/95 border border-border rounded-lg p-3 text-xs space-y-1 shadow-xl backdrop-blur">
      <div className="font-mono text-muted-foreground mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold" style={{ color: p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function HistoricalData() {
  const [range, setRange] = useState<TimeRange>("7d");
  const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>(["pH", "turbidity", "chlorine"]);
  const [chartType, setChartType] = useState<"line" | "area" | "bar">("area");
  const [showAnomalies, setShowAnomalies] = useState(true);

  const data = useMemo(() => generateData(RANGE_POINTS[range]), [range]);
  const stats = useMemo(() => buildStats(data), [data]);

  const anomalyPoints = useMemo(
    () => data.filter((d) => d.anomaly).map((d, i) => ({ ...d, label: ANOMALY_LABELS[i % ANOMALY_LABELS.length] })),
    [data]
  );

  const toggleMetric = (key: MetricKey) => {
    setActiveMetrics((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((k) => k !== key) : prev) : [...prev, key]
    );
  };

  const metricColors: Record<MetricKey, string> = {
    pH: "#06b6d4", turbidity: "#f59e0b", chlorine: "#10b981",
    temperature: "#f97316", pressure: "#8b5cf6", flow: "#ec4899",
  };

  return (
    <div className="p-6 space-y-6 min-h-screen">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-widest text-foreground">HISTORICAL DATA</h1>
          <p className="text-xs text-muted-foreground tracking-widest mt-0.5">SENSOR TRENDS · ANOMALY DETECTION · ANALYTICS</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time range */}
          <div className="flex bg-muted/40 rounded-lg border border-border p-0.5 gap-0.5">
            {(["24h", "7d", "30d", "90d"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold tracking-widest rounded-md transition-all cursor-pointer",
                  range === r ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
          {/* Chart type */}
          <div className="flex bg-muted/40 rounded-lg border border-border p-0.5 gap-0.5">
            {(["area", "line", "bar"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold tracking-widest rounded-md transition-all cursor-pointer",
                  chartType === t ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-bold tracking-widest text-muted-foreground hover:text-foreground hover:bg-accent transition-all cursor-pointer">
            <Download className="w-3.5 h-3.5" />
            EXPORT
          </button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s, i) => {
          const isWarn = s.current >= s.threshold.warn;
          const isCrit = s.current >= s.threshold.crit;
          return (
            <motion.button
              key={s.key}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              onClick={() => toggleMetric(s.key)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all cursor-pointer",
                activeMetrics.includes(s.key)
                  ? "border-primary/40 bg-primary/5 shadow-[0_0_12px_rgba(var(--primary-rgb),0.15)]"
                  : "border-border bg-card hover:bg-accent/30"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div style={{ color: s.color }}>{s.icon}</div>
                {isCrit ? (
                  <AlertTriangle className="w-3 h-3 text-destructive" />
                ) : isWarn ? (
                  <AlertTriangle className="w-3 h-3 text-yellow-400" />
                ) : null}
              </div>
              <div className="text-lg font-bold font-mono" style={{ color: s.color }}>
                {s.current}{s.unit}
              </div>
              <div className="text-[10px] text-muted-foreground tracking-widest mt-0.5">{s.label.toUpperCase()}</div>
              <div className={cn("flex items-center gap-1 mt-1 text-[10px] font-bold", s.trend >= 0 ? "text-green-400" : "text-red-400")}>
                {s.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(s.trend)}%
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Main Chart */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-card/50 border border-border rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-sm font-bold tracking-widest">MULTI-PARAMETER TREND ANALYSIS</h2>
            <p className="text-xs text-muted-foreground mt-0.5 tracking-wider">Click KPI cards above to toggle metrics</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAnomalies(!showAnomalies)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest transition-all cursor-pointer border",
                showAnomalies ? "bg-destructive/20 border-destructive/40 text-destructive" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              ANOMALIES {showAnomalies ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={320}>
          {chartType === "bar" ? (
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "10px", letterSpacing: "0.1em" }} />
              {showAnomalies && anomalyPoints.map((pt) => (
                <ReferenceLine key={pt.time} x={pt.time} stroke="hsl(var(--destructive))" strokeDasharray="4 2" strokeWidth={1} opacity={0.6} />
              ))}
              {activeMetrics.map((key) => (
                <Bar key={key} dataKey={key} name={key.toUpperCase()} fill={metricColors[key]} fillOpacity={0.8} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          ) : chartType === "area" ? (
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <defs>
                {activeMetrics.map((key) => (
                  <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={metricColors[key]} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={metricColors[key]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "10px", letterSpacing: "0.1em" }} />
              {showAnomalies && anomalyPoints.map((pt) => (
                <ReferenceLine key={pt.time} x={pt.time} stroke="hsl(var(--destructive))" strokeDasharray="4 2" strokeWidth={1} opacity={0.6} />
              ))}
              {activeMetrics.map((key) => (
                <Area key={key} type="monotone" dataKey={key} name={key.toUpperCase()} stroke={metricColors[key]} strokeWidth={2} fill={`url(#grad-${key})`} dot={false} />
              ))}
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "10px", letterSpacing: "0.1em" }} />
              {showAnomalies && anomalyPoints.map((pt) => (
                <ReferenceLine key={pt.time} x={pt.time} stroke="hsl(var(--destructive))" strokeDasharray="4 2" strokeWidth={1} opacity={0.6} />
              ))}
              {activeMetrics.map((key) => (
                <Line key={key} type="monotone" dataKey={key} name={key.toUpperCase()} stroke={metricColors[key]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </motion.div>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Distribution Chart */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          className="bg-card/50 border border-border rounded-xl p-5">
          <h2 className="text-sm font-bold tracking-widest mb-4">pH DISTRIBUTION — {range.toUpperCase()}</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.slice(0, Math.min(data.length, 30))} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={Math.floor(data.length / 6)} />
              <YAxis domain={[6.5, 8.5]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={7.0} stroke="#06b6d4" strokeDasharray="3 3" opacity={0.5} />
              <ReferenceLine y={7.5} stroke="#10b981" strokeDasharray="3 3" opacity={0.5} />
              <ReferenceLine y={8.0} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.5} />
              <Bar dataKey="pH" name="pH" fill="#06b6d4" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            {[{ label: "OPTIMAL", color: "#10b981" }, { label: "CAUTION", color: "#f59e0b" }, { label: "CRITICAL", color: "#ef4444" }].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground tracking-widest">
                <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Anomaly Log */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          className="bg-card/50 border border-border rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold tracking-widest">ANOMALY EVENT LOG</h2>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-destructive tracking-widest">
              <motion.div className="w-2 h-2 rounded-full bg-destructive" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
              {anomalyPoints.length} DETECTED
            </div>
          </div>
          <div className="space-y-2 flex-1 overflow-auto">
            {anomalyPoints.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs tracking-widest">NO ANOMALIES IN SELECTED RANGE</div>
            ) : (
              anomalyPoints.slice(0, 8).map((pt, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-foreground">{pt.label}</div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">{pt.time}</div>
                  </div>
                  <div className="ml-auto text-[10px] font-bold text-destructive tracking-wider">WARN</div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Stats Summary Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="bg-card/50 border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-bold tracking-widest">STATISTICAL SUMMARY — {range.toUpperCase()}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {["PARAMETER", "CURRENT", "AVERAGE", "MIN", "MAX", "STATUS"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left font-bold tracking-widest text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => {
                const isWarn = s.current >= s.threshold.warn;
                const isCrit = s.current >= s.threshold.crit;
                const statusLabel = isCrit ? "CRITICAL" : isWarn ? "WARNING" : "NOMINAL";
                const statusColor = isCrit ? "text-destructive" : isWarn ? "text-yellow-400" : "text-green-400";
                return (
                  <tr key={s.key} className={cn("border-b border-border/50 hover:bg-accent/10 transition-colors", i % 2 === 0 ? "bg-muted/10" : "")}>
                    <td className="px-5 py-3 font-bold tracking-wider" style={{ color: s.color }}>{s.label.toUpperCase()}</td>
                    <td className="px-5 py-3 font-mono font-bold">{s.current} {s.unit}</td>
                    <td className="px-5 py-3 font-mono text-muted-foreground">{s.avg.toFixed(2)} {s.unit}</td>
                    <td className="px-5 py-3 font-mono text-blue-400">{s.min.toFixed(2)} {s.unit}</td>
                    <td className="px-5 py-3 font-mono text-orange-400">{s.max.toFixed(2)} {s.unit}</td>
                    <td className="px-5 py-3">
                      <span className={cn("font-bold tracking-widest text-[10px]", statusColor)}>{statusLabel}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

    </div>
  );
}
