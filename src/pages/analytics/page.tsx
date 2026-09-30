import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type HistPoint = { time: string; tds: number; turbidity: number; ph: number };

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleTimeString();
}
const tooltipStyle = {
  contentStyle: { background: "oklch(0.14 0.02 145)", border: "1px solid oklch(0.25 0.04 145)", borderRadius: 6 },
  labelStyle: { color: "oklch(0.92 0.02 145)", fontSize: 10 },
  itemStyle: { fontSize: 11 },
};

export default function Analytics() {
  const { readings: demoReadings, dataMode, selectedDeviceId, lastUpdated } = useProcessMode();
  const hardwareReadings = useQuery(
    api.devices.getRecentReadings,
    dataMode === "hardware" && selectedDeviceId
      ? { deviceId: selectedDeviceId, limit: 100 }
      : "skip",
  );
  const isLoadingHardwareReadings =
    dataMode === "hardware" && Boolean(selectedDeviceId) && hardwareReadings === undefined;
  const liveData: HistPoint[] = dataMode === "hardware"
    ? (hardwareReadings ?? []).slice().reverse().map((reading) => ({
        time: formatTime(reading.timestamp),
        tds: reading.tds,
        turbidity: reading.turbidity,
        ph: reading.ph,
      }))
    : demoReadings.tds !== null && demoReadings.turbidity !== null && demoReadings.ph !== null
      ? [{
          time: formatTime(Date.parse(lastUpdated) > 0 ? lastUpdated : new Date().toISOString()),
          tds: demoReadings.tds,
          turbidity: demoReadings.turbidity,
          ph: demoReadings.ph,
        }]
      : [];

  const last = liveData.at(-1);
  const previous = liveData.length > 1 ? liveData[Math.max(0, liveData.length - 5)] : last;
  const average = (key: "tds" | "turbidity" | "ph", decimals: number, unit = "") => {
    if (liveData.length === 0) return "—";
    const value = liveData.reduce((sum, point) => sum + point[key], 0) / liveData.length;
    return `${value.toFixed(decimals)}${unit}`;
  };
  const peakTds = liveData.length > 0 ? Math.max(...liveData.map((point) => point.tds)) : null;

  const stats = [
    { label: dataMode === "demo" ? "TDS snapshot" : "Avg TDS (saved)", value: average("tds", 0, " ppm"), color: "#22c55e" },
    { label: "Peak TDS (saved)", value: peakTds === null ? "—" : `${peakTds.toFixed(0)} ppm`, color: "#22c55e" },
    { label: dataMode === "demo" ? "Turbidity snapshot" : "Avg Turbidity (saved)", value: average("turbidity", 2, " NTU"), color: "#eab308" },
    { label: dataMode === "demo" ? "pH snapshot" : "Avg pH (saved)", value: average("ph", 2), color: "#22c55e" },
  ];

  const trends = last && previous ? [
    { label: "TDS", current: last.tds, previous: previous.tds, unit: "ppm", color: "#22c55e" },
    { label: "Turbidity", current: last.turbidity, previous: previous.turbidity, unit: "NTU", color: "#eab308" },
    { label: "pH", current: last.ph, previous: previous.ph, unit: "", color: "#22c55e" },
  ] : [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-widest text-primary uppercase">Analytics</h2>
        <p className="text-xs text-muted-foreground tracking-wider">Analysis of saved sensor readings for the selected source</p>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[10px] text-muted-foreground">
        <span className="font-bold text-amber-400">
          {dataMode === "hardware" ? `HARDWARE · ${selectedDeviceId || "NO DEVICE SELECTED"}` : "DEMO SIMULATION · ONE SNAPSHOT"}
        </span>
        <span className="mx-2">·</span>
        {dataMode === "hardware"
          ? "Charts use up to 100 persisted pH, TDS, and turbidity readings; no flow, pressure, or temperature history is stored."
          : "Demo mode has no historical record. Charts show a single local simulated snapshot."}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className="text-[10px] font-semibold tracking-widest text-muted-foreground">{s.label.toUpperCase()}</div>
              <div className="font-mono font-bold text-xl mt-1" style={{ color: s.color }}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trends */}
      <div className="grid grid-cols-3 gap-3">
        {trends.map((t) => {
          const diff = t.current - t.previous;
          const Icon = Math.abs(diff) < 0.01 ? Minus : diff > 0 ? TrendingUp : TrendingDown;
          const trendColor = Math.abs(diff) < 0.01 ? "#6b7280" : diff > 0 ? "#ef4444" : "#22c55e";
          return (
            <Card key={t.label}>
              <CardContent className="pt-4 pb-3">
                <div className="text-[10px] font-semibold tracking-widest text-muted-foreground">{t.label.toUpperCase()}</div>
                <div className="flex items-end gap-2 mt-1">
                  <span className="font-mono font-bold text-lg" style={{ color: t.color }}>{t.current.toFixed(2)}{t.unit}</span>
                  <Icon className="w-4 h-4 mb-0.5" style={{ color: trendColor }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Live area chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary">TDS AND pH — SAVED READINGS</CardTitle>
        </CardHeader>
        <CardContent>
          {liveData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
              {isLoadingHardwareReadings ? "Loading device history…" : "No readings are available for this source yet."}
            </div>
          ) : <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={liveData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="tdsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="phGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.04 145)" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "oklch(0.55 0.04 145)" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "oklch(0.55 0.04 145)" }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="tds" stroke="#22c55e" fill="url(#tdsGrad)" strokeWidth={2} dot={false} name="TDS (ppm)" />
              <Area type="monotone" dataKey="ph" stroke="#22c55e" fill="url(#phGrad)" strokeWidth={2} dot={false} name="pH" />
            </AreaChart>
          </ResponsiveContainer>}
        </CardContent>
      </Card>

      {/* Saved turbidity history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary">TURBIDITY — SAVED READINGS</CardTitle>
        </CardHeader>
        <CardContent>
          {liveData.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-xs text-muted-foreground">
              {isLoadingHardwareReadings ? "Loading device history…" : "No readings are available for this source yet."}
            </div>
          ) : <ResponsiveContainer width="100%" height={180}>
            <BarChart data={liveData.filter((_, i) => i % Math.max(1, Math.ceil(liveData.length / 12)) === 0)} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.04 145)" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "oklch(0.55 0.04 145)" }} />
              <YAxis tick={{ fontSize: 9, fill: "oklch(0.55 0.04 145)" }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="turbidity" fill="#eab308" name="Turbidity (NTU)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>}
        </CardContent>
      </Card>
    </div>
  );
}
