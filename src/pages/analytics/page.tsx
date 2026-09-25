import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type HistPoint = { time: string; tds: number; turbidity: number; ph: number };

function generateHistory(count: number): HistPoint[] {
  const data: HistPoint[] = [];
  let tds = 250, turb = 1.0, ph = 7.0;
  const now = Date.now();
  for (let i = count; i >= 0; i--) {
    tds = Math.max(50, Math.min(900, tds + (Math.random() - 0.5) * 30));
    turb = Math.max(0, Math.min(10, turb + (Math.random() - 0.5) * 0.5));
    ph = Math.max(4, Math.min(11, ph + (Math.random() - 0.5) * 0.2));
    const d = new Date(now - i * 60000);
    data.push({
      time: `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`,
      tds: parseFloat(tds.toFixed(1)),
      turbidity: parseFloat(turb.toFixed(2)),
      ph: parseFloat(ph.toFixed(2)),
    });
  }
  return data;
}

const HOUR_DATA = generateHistory(60);
const tooltipStyle = {
  contentStyle: { background: "oklch(0.14 0.02 145)", border: "1px solid oklch(0.25 0.04 145)", borderRadius: 6 },
  labelStyle: { color: "oklch(0.92 0.02 145)", fontSize: 10 },
  itemStyle: { fontSize: 11 },
};

export default function Analytics() {
  const [liveData, setLiveData] = useState<HistPoint[]>(HOUR_DATA.slice(-20));

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveData((prev) => {
        const last = prev[prev.length - 1];
        const now = new Date();
        const newPoint: HistPoint = {
          time: `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`,
          tds: parseFloat(Math.max(50, Math.min(900, last.tds + (Math.random() - 0.5) * 20)).toFixed(1)),
          turbidity: parseFloat(Math.max(0, Math.min(10, last.turbidity + (Math.random() - 0.5) * 0.3)).toFixed(2)),
          ph: parseFloat(Math.max(4, Math.min(11, last.ph + (Math.random() - 0.5) * 0.1)).toFixed(2)),
        };
        return [...prev.slice(-29), newPoint];
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const last = liveData[liveData.length - 1];
  const prev = liveData[liveData.length - 5] ?? last;

  const stats = [
    { label: "Avg TDS (1h)", value: `${(HOUR_DATA.reduce((s, d) => s + d.tds, 0) / HOUR_DATA.length).toFixed(0)} ppm`, color: "#22c55e" },
    { label: "Peak TDS", value: `${Math.max(...HOUR_DATA.map((d) => d.tds)).toFixed(0)} ppm`, color: "#22c55e" },
    { label: "Avg Turbidity", value: `${(HOUR_DATA.reduce((s, d) => s + d.turbidity, 0) / HOUR_DATA.length).toFixed(2)} NTU`, color: "#eab308" },
    { label: "Avg pH", value: `${(HOUR_DATA.reduce((s, d) => s + d.ph, 0) / HOUR_DATA.length).toFixed(2)}`, color: "#22c55e" },
  ];

  const trends = [
    { label: "TDS", current: last.tds, previous: prev.tds, unit: "ppm", color: "#22c55e" },
    { label: "Turbidity", current: last.turbidity, previous: prev.turbidity, unit: "NTU", color: "#eab308" },
    { label: "pH", current: last.ph, previous: prev.ph, unit: "", color: "#22c55e" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-widest text-primary uppercase">Analytics</h2>
        <p className="text-xs text-muted-foreground tracking-wider">Historical sensor data analysis</p>
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
          <CardTitle className="text-sm font-bold tracking-widest text-primary">LIVE TREND (LAST 30 READINGS)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
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
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 1-hour bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary">TURBIDITY — LAST 60 MIN</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={HOUR_DATA.filter((_, i) => i % 5 === 0)} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.04 145)" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: "oklch(0.55 0.04 145)" }} />
              <YAxis tick={{ fontSize: 9, fill: "oklch(0.55 0.04 145)" }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="turbidity" fill="#eab308" name="Turbidity (NTU)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
