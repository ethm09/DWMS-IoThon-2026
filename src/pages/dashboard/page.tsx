import { useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { Link, useLocation } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { AlertTriangle, ArrowRight, Cloud, Cpu, Droplets, FlaskConical, Gauge, Power, RotateCcw, Waves } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import HardwareControlPanel from "@/components/hardware-control-panel.tsx";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import { useDemo } from "@/hooks/use-demo";
import { DEMO_DEVICE } from "@/lib/demo-state";
import { classifyFlow, classifyPh, classifyTds, classifyTurbidity, evaluateState, THRESHOLDS, type OverallQuality } from "@/lib/dwms-safety.ts";
import { DEMO_SCENARIOS, readingFreshness, waterQuality, validWaterReading, type DemoScenario, type WaterReading, type ReadingFreshness } from "@/lib/monitoring";

type HistoryPoint = WaterReading & { timestamp: string; flowRate?: number };
type DisplayReading = WaterReading & { flowRate?: number };
const METRICS = [
  { key: "ph", label: "pH", unit: "", classify: classifyPh, icon: FlaskConical, band: `${THRESHOLDS.ph.safe.min}–${THRESHOLDS.ph.safe.max}`, limit: 8.5, color: "#0f7a93" },
  { key: "tds", label: "TDS", unit: "ppm", classify: classifyTds, icon: Droplets, band: `< ${THRESHOLDS.tds.safe.max} ppm`, limit: 500, color: "#2563eb" },
  { key: "turbidity", label: "Turbidity", unit: "NTU", classify: classifyTurbidity, icon: Waves, band: `< ${THRESHOLDS.turbidity.safe.max} NTU`, limit: 5, color: "#7c3aed" },
  { key: "flowRate", label: "Flow rate", unit: "L/min", classify: classifyFlow, icon: Gauge, band: `${THRESHOLDS.flowRate.safe.min}–${THRESHOLDS.flowRate.safe.max} L/min`, limit: 2, color: "#0284c7" },
] as const;
const STATUS = {
  safe: { label: "Normal", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
  warning: { label: "Warning", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
  critical: { label: "Critical", className: "bg-red-500/10 text-red-700 dark:text-red-400", dot: "bg-red-500" },
  unknown: { label: "Unknown", className: "bg-slate-500/10 text-muted-foreground", dot: "bg-slate-400" },
};

function SensorReadings({ reading, freshness, history, demo = false }: { reading: DisplayReading | null | undefined; freshness: ReadingFreshness; history: HistoryPoint[]; demo?: boolean }) {
  const valid = validWaterReading(reading);
  const latestTime = history.length ? new Date(history[history.length - 1].timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  return <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4">
    {METRICS.map((metric) => {
      const value = reading?.[metric.key];
      const present = valid && typeof value === "number" && Number.isFinite(value);
      const level = present && freshness === "fresh" ? metric.classify(value) : "unknown";
      return <Card key={metric.key} className="min-w-0 overflow-hidden py-0 shadow-none">
        <CardContent className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-sm font-medium"><metric.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{metric.label}</span><span title={STATUS[level].label} aria-label={STATUS[level].label} className={`h-2 w-2 shrink-0 rounded-full ${STATUS[level].dot}`} /></div>
          <div className="flex items-baseline gap-1"><span className="font-mono text-[26px] font-semibold leading-none tracking-tight">{present ? value.toFixed(metric.key === "tds" ? 0 : metric.key === "ph" ? 2 : 1) : "—"}</span><span className="text-xs text-muted-foreground">{metric.unit}</span></div>
          <p className={`mt-2 truncate text-xs ${level === "warning" ? "text-amber-700 dark:text-amber-400" : level === "critical" ? "text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>{!present ? "No sensor connected" : freshness !== "fresh" ? "Historical value" : `${STATUS[level].label} · ${metric.band}`}</p>
          <p className="mt-1 text-xs text-muted-foreground">{present && latestTime ? `Updated ${latestTime}` : "No current reading"}</p>
        </CardContent>
      </Card>;
    })}
  </div>;
}

function Trends({ history, demo = false }: { history: HistoryPoint[]; demo?: boolean }) {
  const [metricKey, setMetricKey] = useState<(typeof METRICS)[number]["key"]>("turbidity");
  const [range, setRange] = useState("all");
  const metric = METRICS.find((item) => item.key === metricKey)!;
  const availableMetrics = demo ? METRICS : METRICS.filter((item) => item.key !== "flowRate");
  const newest = history.length ? Date.parse(history[history.length - 1].timestamp) : 0;
  const filtered = history.filter((item) => range === "all" || newest - Date.parse(item.timestamp) <= Number(range));
  const data = filtered.map((item) => ({ ...item, time: new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }));
  return <Card className="min-w-0 gap-3 shadow-none">
    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-5 pb-0">
      <div><CardTitle className="text-sm">Water quality trends</CardTitle><p className="mt-1 text-xs text-muted-foreground">{demo ? "Scenario actions in this session" : "Recent stored readings"}</p></div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <select aria-label="Trend metric" className="rounded-md border border-border bg-background px-2 py-1.5 text-xs" value={metricKey} onChange={(event) => setMetricKey(event.target.value as typeof metricKey)}>{availableMetrics.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
        <select aria-label="Trend time range" className="rounded-md border border-border bg-background px-2 py-1.5 text-xs" value={range} onChange={(event) => setRange(event.target.value)}><option value="all">All recent</option><option value="300000">Last 5 min</option><option value="60000">Last minute</option></select>
      </div>
    </CardHeader>
    <CardContent className="px-3 pb-3">
      <div className="mb-1 ml-3 text-xs text-muted-foreground">{metric.label}{metric.unit ? ` · ${metric.unit}` : ""}</div>
      {data.length ? <ResponsiveContainer width="100%" minWidth={0} height={180}><LineChart data={data} margin={{ top: 10, right: 18, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="time" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={45} />
        <YAxis tickFormatter={(value: number) => Number(value.toFixed(1)).toString()} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={metricKey === "ph" ? [0, 14] : [0, (maximum: number) => Math.max(maximum * 1.15, metric.limit * 1.2)]} width={45} />
        <Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: 8, fontSize: 12 }} />
        {metricKey === "ph" && <ReferenceLine y={THRESHOLDS.ph.safe.min} stroke="#d97706" strokeDasharray="4 4" />}
        <ReferenceLine y={metric.limit} stroke="#d97706" strokeDasharray="4 4" label={{ value: "Normal limit", position: "insideTopRight", fontSize: 10, fill: "#a16207" }} />
        <Line type="linear" dataKey={metricKey} name={metric.label} stroke={metric.color} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
      </LineChart></ResponsiveContainer> : <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">No readings in this view.</div>}
    </CardContent>
  </Card>;
}

const SYSTEM_NODES = [
  { label: "Water source", icon: Waves, description: "A sample from a network, reservoir or treated-water reuse point. Site-specific sampling and sensor calibration are required." },
  { label: "Sensors", icon: FlaskConical, description: "pH, TDS and turbidity probes feed the controller. Flow is an example value in the simulation; the included hardware has no flow sensor." },
  { label: "Controller", icon: Cpu, description: "Arduino Uno reads calibrated sensor channels and enforces a local stop interlock. USB serial and a Python HTTPS bridge carry telemetry and commands to Convex." },
  { label: "Response system", icon: Power, description: "A relay requests the configured pump or filtration response. Critical readings latch a stop. Software acknowledgement does not prove physical pump motion or treatment effectiveness." },
  { label: "Cloud platform", icon: Cloud, description: "Convex validates and records per-device readings, applies deterministic rules and updates this dashboard. AI explanations remain outside the safety loop." },
];
function SystemView({ demo, connected, pumpOn, emergency }: { demo: boolean; connected: boolean; pumpOn: boolean | null; emergency: boolean }) {
  const [selected, setSelected] = useState(3);
  return <Card id="process" className="gap-3 scroll-mt-24 shadow-none">
    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 pb-0"><CardTitle className="text-sm">Live system visualization</CardTitle><span className="text-xs text-muted-foreground">{demo ? "Interactive schematic" : connected ? "Recent telemetry" : "Awaiting telemetry"}</span></CardHeader>
    <CardContent className="px-4 pb-4">
      <div className="grid min-w-0 grid-cols-3 gap-2 sm:grid-cols-5">
        {SYSTEM_NODES.map((node, index) => <button key={node.label} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)} className={`relative flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-lg border p-2 text-center transition-colors ${selected === index ? "border-primary/40 bg-primary/8 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:border-primary/30"}`}><node.icon className={`h-6 w-6 ${index === 3 && pumpOn ? "animate-pulse text-primary" : ""}`} /><span className="text-xs font-medium leading-tight">{node.label}</span>{index === 3 && <span className={`max-w-full text-xs font-semibold leading-tight ${emergency ? "text-red-600" : "text-primary"}`}>{emergency ? "STOP LATCHED" : pumpOn === null ? "UNKNOWN" : pumpOn ? "PUMP ON" : "PUMP OFF"}</span>}{index < SYSTEM_NODES.length - 1 && <ArrowRight className="absolute -right-2 z-10 hidden h-3 w-3 bg-card text-muted-foreground sm:block" />}</button>)}
      </div>
      <details className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">About {SYSTEM_NODES[selected].label.toLowerCase()}</summary><p className="mt-2">{SYSTEM_NODES[selected].description}</p></details>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs"><span className="text-muted-foreground">Telemetry: sensors → Arduino → USB bridge → Convex</span><span className="text-muted-foreground">{demo ? "Example response · no hardware actions" : "Relay state is controller reported"}</span></div>
    </CardContent>
  </Card>;
}

function DemoControlPanel() {
  const { state, acknowledgeRecovery, setResponseMode, setManualPump, triggerEmergency } = useDemo();
  const { response, readings } = state;
  const canAcknowledge = !evaluateState(readings).emergency;
  return <Card className="min-w-0 gap-3 shadow-none">
    <CardHeader className="flex flex-row items-center justify-between px-5 pb-0"><CardTitle className="text-sm">Operational response</CardTitle><span className={`h-2 w-2 rounded-full ${response.emergencyLatched ? "bg-red-500" : "bg-primary"}`} /></CardHeader>
    <CardContent className="space-y-4 px-5 pb-4">
      <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3"><div><p className="text-xs text-muted-foreground">Controller mode</p><p className="mt-1 text-sm font-semibold capitalize">{response.mode}{response.emergencyLatched ? " · latched" : ""}</p></div><div className="text-right"><p className="text-xs text-muted-foreground">Pump</p><p className={`mt-1 text-sm font-semibold ${response.pumpOn ? "text-primary" : "text-muted-foreground"}`}>{response.pumpOn ? "ON" : "OFF"}</p></div></div>
      <div className="flex gap-2"><Button className="flex-1" size="sm" variant={response.mode === "auto" ? "default" : "outline"} disabled={response.emergencyLatched} onClick={() => setResponseMode("auto")}>Auto</Button><Button className="flex-1" size="sm" variant={response.mode === "manual" ? "default" : "outline"} disabled={response.emergencyLatched} onClick={() => setResponseMode("manual")}>Manual</Button></div>
      {response.mode === "manual" && <Button size="sm" variant="outline" className="w-full" onClick={() => setManualPump(!response.pumpOn)}>{response.pumpOn ? "Stop" : "Start"} example pump</Button>}
      {response.emergencyLatched ? <Button size="sm" className="w-full" disabled={!canAcknowledge} onClick={acknowledgeRecovery}>Acknowledge recovery</Button> : <Button size="sm" variant="outline" className="w-full border-red-500/25 text-red-600 hover:text-red-600" onClick={triggerEmergency}><Power className="h-3.5 w-3.5" />Emergency stop</Button>}
      <p className="text-xs leading-relaxed text-muted-foreground">{response.emergencyLatched ? "Load recovery readings, then acknowledge to release the stop." : response.pumpOn ? "Configured threshold response requested. Treatment effectiveness remains unverified." : "Auto responds above 20 NTU or 1500 ppm. Critical pH or turbidity latches a stop."}</p>
    </CardContent>
  </Card>;
}

function AssistantPanel({ demo = false }: { demo?: boolean }) {
  if (demo) return <details className="rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Ethm <span className="ml-1 text-xs">· offline</span></summary><p className="mt-2 leading-relaxed">Optional explanations need authenticated device data and a configured AI service. Deterministic monitoring rules work independently.</p></details>;
  return <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs"><span className="text-muted-foreground">Ethm · explanations</span><Link className="text-primary hover:underline" to="/ai-decision">Open assistant →</Link></div>;
}

function DemoDashboard() {
  const { state, applyScenario, resetDemo } = useDemo();
  const quality = waterQuality(state.readings, "fresh");
  const activeAlerts = state.alerts.filter((alert) => alert.status === "active");
  const severity = state.response.emergencyLatched ? "critical" : quality;
  return <div className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2 text-sm"><span className="h-2 w-2 shrink-0 rounded-full bg-primary" /><span className="font-medium">{DEMO_DEVICE.name}</span><span className="hidden text-xs text-muted-foreground sm:inline">{DEMO_DEVICE.deviceId}</span></div><span className="text-xs text-muted-foreground">Updated {new Date(state.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
    <div role="status" className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5 ${STATUS[severity].className}`}><div className="flex min-w-0 items-center gap-2">{severity === "safe" ? <Droplets className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}<p className="text-sm font-semibold">{state.response.emergencyLatched ? "Emergency stop latched · pump OFF" : quality === "safe" ? "Parameters within prototype limits" : quality === "warning" ? "Warning · investigate readings" : "Critical · immediate response required"}</p></div><Link className="text-xs font-medium underline underline-offset-2" to="/alerts">{activeAlerts.length} active alerts</Link></div>
    <SensorReadings reading={state.readings} freshness="fresh" history={state.history} demo />
    <div className="rounded-lg border border-border bg-card p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-medium">Demo scenario</p><button type="button" onClick={resetDemo} className="flex min-h-8 items-center gap-1 text-xs text-muted-foreground hover:text-primary"><RotateCcw className="h-3 w-3" />Reset demo</button></div><div className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Demo scenarios">{(Object.keys(DEMO_SCENARIOS) as DemoScenario[]).map((key) => <Button key={key} className="h-10 min-w-0 px-1 text-xs" size="sm" variant={state.scenario === key ? "default" : "outline"} onClick={() => applyScenario(key)} aria-pressed={state.scenario === key}>{DEMO_SCENARIOS[key].label}</Button>)}</div></div>
    <div className="grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_280px]"><div className="min-w-0 space-y-3"><SystemView demo connected pumpOn={state.response.pumpOn} emergency={state.response.emergencyLatched} /><Trends history={state.history} demo /></div><div className="min-w-0 space-y-3"><DemoControlPanel /><Card className="gap-3 shadow-none"><CardHeader className="px-4 pb-0"><CardTitle className="text-sm">Recent activity</CardTitle></CardHeader><CardContent className="space-y-3 px-4 pb-4">{state.events.slice(0, 2).map((event) => <div key={event.id} className="border-l-2 border-primary/20 pl-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium">{event.type}</p><time className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{event.message}</p></div>)}</CardContent></Card><AssistantPanel demo /></div></div>
  </div>;
}

function HardwareDashboard() {
  const { selectedDeviceId, setSelectedDeviceId } = useProcessMode();
  const devices = useQuery(api.devices.listDevices, {});
  const latest = useQuery(api.devices.getLatestReading, selectedDeviceId ? { deviceId: selectedDeviceId } : "skip");
  const recent = useQuery(api.devices.getRecentReadings, selectedDeviceId ? { deviceId: selectedDeviceId, limit: 60 } : "skip");
  const control = useQuery(api.devices.getControlState, selectedDeviceId ? { deviceId: selectedDeviceId } : "skip");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  useEffect(() => { if (devices?.length && !devices.some((item) => item.deviceId === selectedDeviceId)) setSelectedDeviceId(devices[0].deviceId); }, [devices, selectedDeviceId, setSelectedDeviceId]);
  const device = devices?.find((item) => item.deviceId === selectedDeviceId);
  const freshness = readingFreshness(latest?.timestamp, now);
  const currentFreshness = freshness === "fresh" && device?.status !== "online" ? "offline" : freshness;
  const quality = waterQuality(latest, currentFreshness);
  const decision = latest && currentFreshness === "fresh" && validWaterReading(latest) ? evaluateState(latest) : null;
  const history: HistoryPoint[] = (recent ?? []).slice().reverse();
  const age = latest ? Math.max(0, Math.floor((now - Date.parse(latest.timestamp)) / 1000)) : null;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><select aria-label="Site / device" className="min-w-48 rounded-md border border-border bg-background px-3 py-2 text-sm" value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)}>{!devices?.length && <option value="">{devices === undefined ? "Loading devices…" : "No registered devices"}</option>}{devices?.map((item) => <option key={item.deviceId} value={item.deviceId}>{item.location ? `${item.location} · ` : ""}{item.name}</option>)}</select><Link className="text-xs text-primary hover:underline" to="/devices">Manage devices →</Link></div>
    <div role="status" className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3 ${STATUS[quality].className}`}><div><p className="text-sm font-semibold">{quality === "safe" ? "Water parameters within prototype limits" : quality === "unknown" ? "Unknown · check device connection" : quality === "warning" ? "Warning · investigate readings" : "Critical · respond now"}</p><p className="mt-0.5 text-xs opacity-80">{decision?.reason ?? "Restore telemetry and verify sensors before starting equipment."}</p></div><span className="text-xs">{currentFreshness.toUpperCase()}{age !== null && Number.isFinite(age) ? ` · ${age}s since receipt` : ""}</span></div>
    <SensorReadings reading={latest} freshness={currentFreshness} history={history} />
    {currentFreshness !== "fresh" && latest && <p className="text-xs text-muted-foreground">Displayed values are historical. Current quality is unknown.</p>}
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="min-w-0 space-y-4"><SystemView demo={false} connected={currentFreshness === "fresh"} pumpOn={currentFreshness === "fresh" ? control?.reportedPumpState ?? null : null} emergency={control?.mode === "emergency"} /><Trends history={history} /></div><div className="space-y-4"><HardwareControlPanel /><AssistantPanel /></div></div>
  </div>;
}

export default function Dashboard() {
  const { dataMode, setDataMode } = useProcessMode();
  const { hash } = useLocation();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const hardwareView = isAuthenticated && dataMode === "hardware";
  useEffect(() => {
    if (!isLoading && !isAuthenticated && dataMode === "hardware") setDataMode("demo");
  }, [isLoading, isAuthenticated, dataMode, setDataMode]);
  useEffect(() => {
    if (hash === "#process") document.getElementById("process")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, dataMode]);
  return <div className="mx-auto min-w-0 max-w-7xl space-y-4 p-3 sm:p-4 lg:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight">Water quality overview</h1><p className="mt-1 text-xs text-muted-foreground">Readings, alerts and operational response across your water system.</p></div>{isAuthenticated && <div className="inline-flex rounded-lg border border-border bg-card p-1" aria-label="Data mode"><Button size="sm" variant={!hardwareView ? "default" : "ghost"} onClick={() => setDataMode("demo")} aria-pressed={!hardwareView}>Local demo</Button>{isAuthenticated && <Button size="sm" variant={hardwareView ? "default" : "ghost"} onClick={() => setDataMode("hardware")} aria-pressed={hardwareView}>Device data</Button>}</div>}</div>
    {hardwareView ? <HardwareDashboard /> : <DemoDashboard />}
  </div>;
}
