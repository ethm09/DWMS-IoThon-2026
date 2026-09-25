import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MapPin, Wifi, WifiOff, AlertTriangle, CheckCircle,
  Droplets, Activity, Thermometer, Zap, RotateCcw,
  TrendingUp, TrendingDown, Minus, RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

type SiteStatus = "online" | "warning" | "critical" | "offline";

interface SiteMetrics {
  tds: number;
  turbidity: number;
  ph: number;
  temp: number;
  flow: number;
  pressure: number;
}

interface Site {
  id: string;
  name: string;
  location: string;
  region: string;
  status: SiteStatus;
  metrics: SiteMetrics;
  returnActive: boolean;
  uptime: number;       // percent
  lastSync: string;     // time string
  alerts: number;
  capacity: number;     // L/min rated
  coordinates: { x: number; y: number }; // percent on map
}

type Trend = "up" | "down" | "stable";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<SiteStatus, string> = {
  online: "#22c55e",
  warning: "#eab308",
  critical: "#ef4444",
  offline: "#4b5563",
};

const STATUS_BG: Record<SiteStatus, string> = {
  online: "#22c55e12",
  warning: "#eab30812",
  critical: "#ef444412",
  offline: "#1f293733",
};

const STATUS_LABEL: Record<SiteStatus, string> = {
  online: "ONLINE",
  warning: "WARNING",
  critical: "CRITICAL",
  offline: "OFFLINE",
};

const REGIONS = ["All Regions", "Northern Command", "Eastern Sector", "Southern Base", "Western Outpost"];

// ─── Initial Sites ────────────────────────────────────────────────────────────

function makeSite(
  id: string, name: string, location: string, region: string,
  status: SiteStatus, metrics: SiteMetrics,
  uptime: number, alerts: number, capacity: number,
  coords: { x: number; y: number }
): Site {
  return {
    id, name, location, region, status, metrics,
    returnActive: metrics.tds > 500 || metrics.turbidity > 20 || metrics.ph < 6.5 || metrics.ph > 8.5,
    uptime, lastSync: new Date().toLocaleTimeString(), alerts, capacity, coordinates: coords,
  };
}

const INITIAL_SITES: Site[] = [
  makeSite("S1", "Alpha Station", "Forward Base Alpha", "Northern Command",
    "online", { tds: 240, turbidity: 0.8, ph: 7.2, temp: 21, flow: 82, pressure: 3.8 },
    99.4, 0, 120, { x: 22, y: 24 }),
  makeSite("S2", "Bravo Outpost", "Perimeter Bravo", "Northern Command",
    "warning", { tds: 420, turbidity: 6.2, ph: 7.8, temp: 28, flow: 61, pressure: 2.9 },
    97.1, 2, 80, { x: 38, y: 18 }),
  makeSite("S3", "Charlie Post", "Desert Charlie", "Eastern Sector",
    "critical", { tds: 640, turbidity: 24, ph: 9.1, temp: 38, flow: 35, pressure: 1.4 },
    88.6, 5, 100, { x: 64, y: 32 }),
  makeSite("S4", "Delta Hub", "Mountain Delta", "Eastern Sector",
    "online", { tds: 185, turbidity: 0.3, ph: 7.0, temp: 16, flow: 94, pressure: 4.2 },
    99.9, 0, 150, { x: 78, y: 22 }),
  makeSite("S5", "Echo Base", "Coastal Echo", "Southern Base",
    "online", { tds: 290, turbidity: 1.1, ph: 7.5, temp: 24, flow: 76, pressure: 3.5 },
    98.7, 0, 90, { x: 30, y: 62 }),
  makeSite("S6", "Foxtrot Camp", "Jungle Foxtrot", "Southern Base",
    "warning", { tds: 380, turbidity: 4.8, ph: 6.2, temp: 32, flow: 55, pressure: 2.4 },
    93.2, 3, 70, { x: 52, y: 72 }),
  makeSite("S7", "Golf Station", "Plains Golf", "Western Outpost",
    "online", { tds: 210, turbidity: 0.6, ph: 7.3, temp: 19, flow: 88, pressure: 4.0 },
    99.2, 0, 110, { x: 12, y: 48 }),
  makeSite("S8", "Hotel Post", "Arctic Hotel", "Western Outpost",
    "offline", { tds: 0, turbidity: 0, ph: 0, temp: 0, flow: 0, pressure: 0 },
    0, 0, 60, { x: 16, y: 72 }),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function siteStatusFromMetrics(m: SiteMetrics): SiteStatus {
  if (m.tds > 500 || m.turbidity > 20 || m.ph < 6.0 || m.ph > 9.0 || m.flow < 30) return "critical";
  if (m.tds > 350 || m.turbidity > 5 || m.ph < 6.5 || m.ph > 8.5 || m.flow < 55) return "warning";
  return "online";
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "up") return <TrendingUp className="w-3 h-3" />;
  if (trend === "down") return <TrendingDown className="w-3 h-3" />;
  return <Minus className="w-3 h-3" />;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status, pulse = true }: { status: SiteStatus; pulse?: boolean }) {
  const color = STATUS_COLOR[status];
  return (
    <div className="relative shrink-0">
      {pulse && status !== "offline" && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: color }}
          animate={{ scale: [1, 2], opacity: [0.5, 0] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}
      <div className="w-2.5 h-2.5 rounded-full relative" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
    </div>
  );
}

function MetricBadge({ label, value, unit, ok }: { label: string; value: string; unit: string; ok: boolean }) {
  return (
    <div className="text-center">
      <div className="text-[8px] tracking-widest text-muted-foreground">{label}</div>
      <div className="font-mono text-xs font-bold" style={{ color: ok ? "#22c55e" : "#ef4444" }}>
        {value}<span className="text-[8px] font-normal text-muted-foreground ml-0.5">{unit}</span>
      </div>
    </div>
  );
}

function SiteCard({ site, selected, onClick }: { site: Site; selected: boolean; onClick: () => void }) {
  const color = STATUS_COLOR[site.status];
  const isOffline = site.status === "offline";

  return (
    <motion.div
      layout
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 cursor-pointer transition-all",
        selected ? "ring-2 ring-primary/60" : ""
      )}
      style={{
        borderColor: selected ? color : `${color}44`,
        background: selected ? `${color}10` : STATUS_BG[site.status],
      }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Header row */}
      <div className="flex items-start gap-2 mb-3">
        <StatusDot status={site.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-xs font-bold tracking-widest truncate" style={{ color }}>
              {site.name}
            </div>
            {site.returnActive && (
              <div className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30">
                <RotateCcw className="w-2.5 h-2.5 text-red-400" />
                <span className="text-[8px] text-red-400 font-bold tracking-widest">RETURN</span>
              </div>
            )}
            {site.alerts > 0 && (
              <div className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30">
                <AlertTriangle className="w-2.5 h-2.5 text-yellow-400" />
                <span className="text-[8px] text-yellow-400 font-bold">{site.alerts}</span>
              </div>
            )}
          </div>
          <div className="text-[9px] text-muted-foreground tracking-wider flex items-center gap-1 mt-0.5">
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            {site.location} · {site.region}
          </div>
        </div>
        <div className="text-[8px] font-bold tracking-widest px-2 py-1 rounded border shrink-0"
          style={{ color, borderColor: `${color}44`, background: `${color}12` }}>
          {STATUS_LABEL[site.status]}
        </div>
      </div>

      {/* Metrics row */}
      {!isOffline ? (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <MetricBadge label="TDS" value={site.metrics.tds.toFixed(0)} unit="ppm" ok={site.metrics.tds < 500} />
          <MetricBadge label="TURB" value={site.metrics.turbidity.toFixed(1)} unit="NTU" ok={site.metrics.turbidity < 20} />
          <MetricBadge label="pH" value={site.metrics.ph.toFixed(1)} unit="" ok={site.metrics.ph >= 6.5 && site.metrics.ph <= 8.5} />
        </div>
      ) : (
        <div className="text-center py-2 text-[10px] text-muted-foreground tracking-widest mb-3">
          — NO DATA — CONNECTION LOST —
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
        <div className="flex items-center gap-1">
          {isOffline ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3 text-green-400" />}
          <span>{isOffline ? "Offline" : `Sync: ${site.lastSync}`}</span>
        </div>
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          <span>Uptime: {site.uptime.toFixed(1)}%</span>
        </div>
      </div>

      {/* Uptime bar */}
      <div className="mt-2 h-1 rounded-full bg-muted/30 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${site.uptime}%`, backgroundColor: site.uptime > 95 ? "#22c55e" : site.uptime > 80 ? "#eab308" : "#ef4444" }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </motion.div>
  );
}

// ─── Map Dot ──────────────────────────────────────────────────────────────────

function MapDot({ site, selected, onClick }: { site: Site; selected: boolean; onClick: () => void }) {
  const color = STATUS_COLOR[site.status];
  return (
    <div
      className="absolute cursor-pointer group"
      style={{ left: `${site.coordinates.x}%`, top: `${site.coordinates.y}%`, transform: "translate(-50%, -50%)" }}
      onClick={onClick}
    >
      {/* Pulse */}
      {site.status !== "offline" && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: color, width: 16, height: 16, top: -2, left: -2 }}
          animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
      )}
      <motion.div
        className="w-3 h-3 rounded-full border-2 border-background relative z-10"
        style={{ background: color, boxShadow: selected ? `0 0 12px ${color}` : `0 0 6px ${color}88` }}
        animate={{ scale: selected ? 1.5 : 1 }}
        transition={{ duration: 0.2 }}
      />
      {/* Tooltip */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:block z-20 pointer-events-none">
        <div className="bg-card border border-border rounded px-2 py-1 text-[9px] font-bold tracking-widest whitespace-nowrap"
          style={{ color }}>
          {site.name}
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function SiteDetail({ site }: { site: Site }) {
  const color = STATUS_COLOR[site.status];
  const isOffline = site.status === "offline";

  const metrics = [
    { label: "TDS", value: site.metrics.tds.toFixed(0), unit: "ppm", ok: site.metrics.tds < 500, icon: <Droplets size={14} /> },
    { label: "Turbidity", value: site.metrics.turbidity.toFixed(2), unit: "NTU", ok: site.metrics.turbidity < 20, icon: <Activity size={14} /> },
    { label: "pH Level", value: site.metrics.ph.toFixed(2), unit: "", ok: site.metrics.ph >= 6.5 && site.metrics.ph <= 8.5, icon: <Thermometer size={14} /> },
    { label: "Temperature", value: site.metrics.temp.toFixed(1), unit: "°C", ok: site.metrics.temp < 35, icon: <Thermometer size={14} /> },
    { label: "Flow Rate", value: site.metrics.flow.toFixed(0), unit: "L/min", ok: site.metrics.flow > 50, icon: <Zap size={14} /> },
    { label: "Pressure", value: site.metrics.pressure.toFixed(1), unit: "bar", ok: site.metrics.pressure >= 2, icon: <Activity size={14} /> },
  ];

  return (
    <motion.div
      key={site.id}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      className="rounded-xl border p-5 space-y-4"
      style={{ borderColor: `${color}44`, background: `${color}08` }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <StatusDot status={site.status} />
        <div className="flex-1">
          <div className="text-sm font-bold tracking-widest" style={{ color }}>{site.name}</div>
          <div className="text-[10px] text-muted-foreground tracking-wider flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3" />{site.location} · {site.region}
          </div>
        </div>
        <div className="text-right text-[9px] text-muted-foreground">
          <div>Cap: {site.capacity} L/min</div>
          <div>Uptime: {site.uptime.toFixed(1)}%</div>
        </div>
      </div>

      {/* Return flow alert */}
      {site.returnActive && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2 flex items-center gap-2">
          <RotateCcw className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <div className="text-[10px] font-bold text-red-400 tracking-wider">RETURN FLOW ACTIVE — Water recirculating to filtration</div>
        </div>
      )}

      {/* Metrics grid */}
      {!isOffline ? (
        <div className="grid grid-cols-2 gap-2">
          {metrics.map(m => {
            const mColor = m.ok ? "#22c55e" : "#ef4444";
            return (
              <div key={m.label} className="rounded-lg border border-border px-3 py-2 flex items-center gap-2">
                <div style={{ color: mColor }}>{m.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] tracking-widest text-muted-foreground">{m.label}</div>
                  <div className="font-mono text-sm font-bold leading-tight" style={{ color: mColor }}>
                    {m.value} <span className="text-[9px] font-normal text-muted-foreground">{m.unit}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-border p-6 text-center text-muted-foreground text-xs tracking-widest">
          SITE OFFLINE — NO TELEMETRY DATA AVAILABLE
        </div>
      )}

      {/* Status row */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground border-t border-border pt-3">
        <div className="flex items-center gap-1.5">
          {isOffline ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3 text-green-400" />}
          {isOffline ? "Connection lost" : `Last sync: ${site.lastSync}`}
        </div>
        {site.alerts > 0 && (
          <div className="flex items-center gap-1 text-yellow-400">
            <AlertTriangle className="w-3 h-3" />
            <span>{site.alerts} active alert{site.alerts > 1 ? "s" : ""}</span>
          </div>
        )}
        {site.alerts === 0 && !isOffline && (
          <div className="flex items-center gap-1 text-green-400">
            <CheckCircle className="w-3 h-3" />
            <span>No alerts</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RemoteMonitoring() {
  const [sites, setSites] = useState<Site[]>(INITIAL_SITES);
  const [selectedId, setSelectedId] = useState<string | null>("S1");
  const [regionFilter, setRegionFilter] = useState("All Regions");
  const [lastRefresh, setLastRefresh] = useState(new Date().toLocaleTimeString());
  const [refreshing, setRefreshing] = useState(false);

  // Live simulation — drift each site's metrics
  useEffect(() => {
    const id = setInterval(() => {
      setSites(prev => prev.map(site => {
        if (site.status === "offline") return site;
        const m = site.metrics;
        const updated: SiteMetrics = {
          tds: Math.max(50, Math.min(800, m.tds + (Math.random() - 0.48) * 20)),
          turbidity: Math.max(0, Math.min(35, m.turbidity + (Math.random() - 0.48) * 1.5)),
          ph: Math.max(4.5, Math.min(10, m.ph + (Math.random() - 0.5) * 0.1)),
          temp: Math.max(5, Math.min(50, m.temp + (Math.random() - 0.5) * 0.4)),
          flow: Math.max(10, Math.min(100, m.flow + (Math.random() - 0.48) * 5)),
          pressure: Math.max(0.5, Math.min(8, m.pressure + (Math.random() - 0.5) * 0.2)),
        };
        const newStatus = siteStatusFromMetrics(updated);
        return {
          ...site,
          metrics: updated,
          status: newStatus,
          returnActive: updated.tds > 500 || updated.turbidity > 20 || updated.ph < 6.5 || updated.ph > 8.5,
          lastSync: new Date().toLocaleTimeString(),
        };
      }));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setLastRefresh(new Date().toLocaleTimeString());
    setTimeout(() => setRefreshing(false), 800);
  };

  const filteredSites = regionFilter === "All Regions"
    ? sites
    : sites.filter(s => s.region === regionFilter);

  const selectedSite = selectedId ? sites.find(s => s.id === selectedId) ?? null : null;

  // Aggregate stats
  const online = sites.filter(s => s.status === "online").length;
  const warning = sites.filter(s => s.status === "warning").length;
  const critical = sites.filter(s => s.status === "critical").length;
  const offline = sites.filter(s => s.status === "offline").length;
  const totalAlerts = sites.reduce((a, s) => a + s.alerts, 0);
  const returning = sites.filter(s => s.returnActive).length;

  const summaryCards = [
    { label: "ONLINE", value: online, color: "#22c55e", icon: <CheckCircle className="w-4 h-4" /> },
    { label: "WARNING", value: warning, color: "#eab308", icon: <AlertTriangle className="w-4 h-4" /> },
    { label: "CRITICAL", value: critical, color: "#ef4444", icon: <AlertTriangle className="w-4 h-4" /> },
    { label: "OFFLINE", value: offline, color: "#4b5563", icon: <WifiOff className="w-4 h-4" /> },
    { label: "ALERTS", value: totalAlerts, color: "#f97316", icon: <Activity className="w-4 h-4" /> },
    { label: "RETURN FLOWS", value: returning, color: "#a78bfa", icon: <RotateCcw className="w-4 h-4" /> },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-widest text-primary uppercase">Remote Monitoring</h2>
          <p className="text-xs text-muted-foreground tracking-wider">
            Multi-site command center — {sites.length} stations monitored · Last refresh: {lastRefresh}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[10px] font-bold tracking-widest text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors cursor-pointer"
        >
          <motion.div animate={{ rotate: refreshing ? 360 : 0 }} transition={{ duration: 0.6 }}>
            <RefreshCw className="w-3.5 h-3.5" />
          </motion.div>
          REFRESH
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {summaryCards.map(c => (
          <div key={c.label} className="rounded-xl border border-border p-3 text-center">
            <div style={{ color: c.color }} className="flex justify-center mb-1">{c.icon}</div>
            <motion.div className="text-2xl font-bold font-mono" animate={{ color: c.color }} transition={{ duration: 0.4 }}>
              {c.value}
            </motion.div>
            <div className="text-[8px] tracking-widest text-muted-foreground mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Map + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tactical Map */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <div className="text-[10px] font-bold tracking-widest text-muted-foreground">TACTICAL MAP — SITE LOCATIONS</div>
                <div className="text-[9px] text-muted-foreground font-mono">LIVE · {sites.filter(s => s.status !== "offline").length} ACTIVE</div>
              </div>
              <div
                className="relative mx-4 mb-4 rounded-lg overflow-hidden"
                style={{
                  paddingBottom: "58%",
                  background: "radial-gradient(ellipse at 30% 40%, oklch(0.16 0.03 145), oklch(0.1 0.015 145))",
                  border: "1px solid oklch(0.22 0.035 145)",
                }}
              >
                {/* Grid overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  backgroundImage: "linear-gradient(oklch(0.25 0.04 145 / 0.15) 1px, transparent 1px), linear-gradient(90deg, oklch(0.25 0.04 145 / 0.15) 1px, transparent 1px)",
                  backgroundSize: "12.5% 16.67%",
                }} />

                {/* Continent-like shapes (decorative) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 58">
                  <ellipse cx="35" cy="30" rx="28" ry="18" fill="oklch(0.15 0.025 145 / 0.5)" />
                  <ellipse cx="70" cy="35" rx="22" ry="14" fill="oklch(0.14 0.022 145 / 0.5)" />
                  <ellipse cx="15" cy="48" rx="10" ry="7" fill="oklch(0.14 0.022 145 / 0.4)" />
                  <ellipse cx="85" cy="20" rx="10" ry="6" fill="oklch(0.15 0.025 145 / 0.4)" />
                </svg>

                {/* Connection lines between nearby sites */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 58" preserveAspectRatio="none">
                  {sites.filter(s => s.status !== "offline").flatMap((site, i) =>
                    sites.slice(i + 1).filter(s2 => s2.status !== "offline").map(site2 => {
                      const dist = Math.sqrt((site.coordinates.x - site2.coordinates.x) ** 2 + (site.coordinates.y - site2.coordinates.y) ** 2);
                      if (dist > 35) return null;
                      return (
                        <line
                          key={`${site.id}-${site2.id}`}
                          x1={site.coordinates.x} y1={site.coordinates.y}
                          x2={site2.coordinates.x} y2={site2.coordinates.y}
                          stroke={STATUS_COLOR[site.status]}
                          strokeWidth="0.2"
                          strokeOpacity="0.25"
                          strokeDasharray="2 2"
                        />
                      );
                    })
                  )}
                </svg>

                {/* Site dots */}
                <div className="absolute inset-0">
                  {sites.map(site => (
                    <MapDot
                      key={site.id}
                      site={site}
                      selected={selectedId === site.id}
                      onClick={() => setSelectedId(id => id === site.id ? null : site.id)}
                    />
                  ))}
                </div>

                {/* Legend */}
                <div className="absolute bottom-2 right-2 flex gap-2 bg-background/70 backdrop-blur-sm rounded px-2 py-1">
                  {(["online", "warning", "critical", "offline"] as SiteStatus[]).map(s => (
                    <div key={s} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                      <span className="text-[7px] tracking-widest text-muted-foreground uppercase">{s}</span>
                    </div>
                  ))}
                </div>

                {/* Compass */}
                <div className="absolute top-2 left-2 text-[8px] font-bold text-muted-foreground/50 tracking-widest font-mono">
                  N↑
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detail panel */}
        <div className="space-y-3">
          <AnimatePresence mode="wait">
            {selectedSite ? (
              <SiteDetail key={selectedSite.id} site={selectedSite} />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-border p-8 text-center text-muted-foreground text-xs tracking-widest"
              >
                <MapPin className="w-6 h-6 mx-auto mb-2 opacity-30" />
                Select a site on the map or list to view details
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Site list */}
      <div>
        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          <div className="text-[9px] tracking-widest text-muted-foreground shrink-0">REGION:</div>
          {REGIONS.map(r => (
            <button
              key={r}
              onClick={() => setRegionFilter(r)}
              className={cn(
                "shrink-0 px-3 py-1 rounded-full text-[9px] font-bold tracking-widest border transition-all cursor-pointer",
                regionFilter === r
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
              )}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <AnimatePresence>
            {filteredSites.map(site => (
              <SiteCard
                key={site.id}
                site={site}
                selected={selectedId === site.id}
                onClick={() => setSelectedId(id => id === site.id ? null : site.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Critical alerts banner */}
      <AnimatePresence>
        {critical > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="rounded-xl border border-red-500/40 bg-red-500/8 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </motion.div>
              <div className="text-xs font-bold tracking-widest text-red-400">
                {critical} SITE{critical > 1 ? "S" : ""} IN CRITICAL STATE — IMMEDIATE ATTENTION REQUIRED
              </div>
            </div>
            <div className="space-y-1">
              {sites.filter(s => s.status === "critical").map(s => (
                <div key={s.id} className="flex items-center gap-2 text-[10px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  <span className="text-red-300 font-bold">{s.name}</span>
                  <span className="text-muted-foreground">— {s.location} · TDS:{s.metrics.tds.toFixed(0)} NTU:{s.metrics.turbidity.toFixed(1)} pH:{s.metrics.ph.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
