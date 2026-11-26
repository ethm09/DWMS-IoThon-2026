import { useEffect, useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading, useQuery, useConvexAuth } from "convex/react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, Droplets, Radio } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInButton } from "@/components/ui/signin.tsx";
import HardwareControlPanel from "@/components/hardware-control-panel.tsx";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import { classifyPh, classifyTds, classifyTurbidity, evaluateState, LEVEL_COLOR, THRESHOLDS } from "@/lib/dwms-safety.ts";
import {
  DEMO_SCENARIOS, demoResponse, readingFreshness, waterQuality, validWaterReading,
  type DemoScenario, type DemoControl, type WaterReading, type ReadingFreshness,
} from "@/lib/monitoring";

type HistoryPoint = WaterReading & { time: string };
const METRICS = [
  { key: "ph", label: "pH", unit: "", classify: classifyPh, band: `${THRESHOLDS.ph.safe.min}–${THRESHOLDS.ph.safe.max}` },
  { key: "tds", label: "TDS", unit: "ppm", classify: classifyTds, band: `< ${THRESHOLDS.tds.safe.max} ppm` },
  { key: "turbidity", label: "Turbidity", unit: "NTU", classify: classifyTurbidity, band: `< ${THRESHOLDS.turbidity.safe.max} NTU` },
] as const;

function qualityLabel(quality: ReturnType<typeof waterQuality>) {
  return quality === "safe" ? "Within prototype limits" : quality === "unknown" ? "Unknown · check data" : quality === "warning" ? "Warning · investigate" : "Critical · respond now";
}

function SensorReadings({ reading, freshness }: { reading: WaterReading | null | undefined; freshness: ReadingFreshness }) {
  const valid = validWaterReading(reading);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {METRICS.map((metric) => {
        const level = valid && freshness === "fresh" ? metric.classify(reading[metric.key]) : "unknown";
        return (
          <Card key={metric.key}>
            <CardContent className="p-5 space-y-2">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <p className="font-mono text-3xl font-semibold" style={{ color: LEVEL_COLOR[level] }}>
                {valid ? reading[metric.key].toFixed(metric.key === "tds" ? 0 : 2) : "—"}
                <span className="ml-2 text-sm text-muted-foreground">{metric.unit}</span>
              </p>
              <p className="text-xs" style={{ color: LEVEL_COLOR[level] }}>
                {freshness !== "fresh" ? "No current assessment" : level === "safe" ? "Within limits" : level.toUpperCase()}
              </p>
              <p className="text-xs text-muted-foreground">Prototype normal band: {metric.band}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Trends({ history, demo = false }: { history: HistoryPoint[]; demo?: boolean }) {
  const [metricKey, setMetricKey] = useState<(typeof METRICS)[number]["key"]>("turbidity");
  const metric = METRICS.find((item) => item.key === metricKey)!;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
        <CardTitle className="text-base">{demo ? "Scenario trace · simulated" : "Recent readings · stored"}</CardTitle>
        <label className="text-xs text-muted-foreground flex items-center gap-2">
          Trend
          <select aria-label="Trend metric" className="rounded-md border border-border bg-background p-2 text-foreground" value={metricKey} onChange={(event) => setMetricKey(event.target.value as typeof metricKey)}>
            {METRICS.map((item) => <option key={item.key} value={item.key}>{item.label}{item.unit ? ` (${item.unit})` : ""}</option>)}
          </select>
        </label>
      </CardHeader>
      <CardContent>
        {history.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} domain={metricKey === "ph" ? [0, 14] : [0, "auto"]} width={50} />
              <Tooltip contentStyle={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: 8 }} />
              <Line type="linear" dataKey={metricKey} name={`${metric.label}${metric.unit ? ` (${metric.unit})` : ""}`} stroke="#22c55e" strokeWidth={2} dot={history.length < 15} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="py-8 text-center text-sm text-muted-foreground">No stored readings for this device.</p>}
      </CardContent>
    </Card>
  );
}

function DemoDashboard() {
  const [scenario, setScenario] = useState<DemoScenario>("normal");
  const [control, setControl] = useState<DemoControl>({ emergency: false, pumpOn: false });
  const [history, setHistory] = useState<HistoryPoint[]>([{ ...DEMO_SCENARIOS.normal, time: "Normal" }]);
  const reading = DEMO_SCENARIOS[scenario];
  const quality = waterQuality(reading, "fresh");
  const decision = evaluateState(reading);
  const applyScenario = (next: DemoScenario) => {
    const nextReading = DEMO_SCENARIOS[next];
    setScenario(next);
    setControl((previous) => demoResponse(nextReading, previous));
    setHistory((previous) => [...previous, { ...nextReading, time: nextReading.label.slice(4) }].slice(-30));
  };
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-500">
        <strong>SIMULATION ONLY.</strong> Fixed example readings run in this browser. No relay commands are sent and nothing is saved to the backend.
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Demo scenarios">
        {(Object.keys(DEMO_SCENARIOS) as DemoScenario[]).map((key) => (
          <Button key={key} size="sm" variant={scenario === key ? "default" : "outline"} onClick={() => applyScenario(key)} aria-pressed={scenario === key}>
            {DEMO_SCENARIOS[key].label}
          </Button>
        ))}
      </div>
      <div role="status" className="rounded-lg border p-4 space-y-1" style={{ borderColor: LEVEL_COLOR[quality] }}>
        <p className="text-lg font-semibold" style={{ color: LEVEL_COLOR[quality] }}>{qualityLabel(quality)}</p>
        <p className="text-sm text-muted-foreground">{decision.reason}</p>
      </div>
      <SensorReadings reading={reading} freshness="fresh" />
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Rule-based response · simulated</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="font-medium">{control.emergency ? "Emergency latched · simulated pump OFF" : `Auto · simulated pump ${control.pumpOn ? "ON" : "OFF"}`}</p>
          <p className="text-sm text-muted-foreground">
            {control.emergency ? "Critical readings latch a stop. Recovery readings alone do not clear it; an operator must acknowledge."
              : control.pumpOn ? "Turbidity above 20 NTU or TDS above 1500 ppm requests the configured prototype response. Treatment effectiveness is unverified."
              : "Normal and warning readings keep the simulated pump off. Investigate warnings before they reach the response threshold."}
          </p>
          {control.emergency && (
            <Button size="sm" disabled={!!decision.emergency} onClick={() => setControl((previous) => demoResponse(reading, previous, true))}>
              Acknowledge recovery
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => { setScenario("normal"); setControl({ emergency: false, pumpOn: false }); setHistory([{ ...DEMO_SCENARIOS.normal, time: "Normal" }]); }}>
            Reset demo
          </Button>
        </CardContent>
      </Card>
      <Trends history={history} demo />
    </div>
  );
}

function HardwareDashboard() {
  const { selectedDeviceId, setSelectedDeviceId } = useProcessMode();
  const devices = useQuery(api.devices.listDevices, {});
  const latest = useQuery(api.devices.getLatestReading, selectedDeviceId ? { deviceId: selectedDeviceId } : "skip");
  const recent = useQuery(api.devices.getRecentReadings, selectedDeviceId ? { deviceId: selectedDeviceId, limit: 60 } : "skip");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (devices?.length && !devices.some((item) => item.deviceId === selectedDeviceId)) setSelectedDeviceId(devices[0].deviceId);
  }, [devices, selectedDeviceId, setSelectedDeviceId]);
  const device = devices?.find((item) => item.deviceId === selectedDeviceId);
  const freshness = readingFreshness(latest?.timestamp, now);
  const currentFreshness = freshness === "fresh" && device?.status !== "online" ? "offline" : freshness;
  const quality = waterQuality(latest, currentFreshness);
  const decision = latest && currentFreshness === "fresh" && validWaterReading(latest) ? evaluateState(latest) : null;
  const history: HistoryPoint[] = (recent ?? []).slice().reverse().map((item) => ({ ...item, time: new Date(item.timestamp).toLocaleTimeString() }));
  const age = latest ? Math.max(0, Math.floor((now - Date.parse(latest.timestamp)) / 1000)) : null;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex-1 min-w-48 text-sm text-muted-foreground space-y-1">
          <span>Site / device</span>
          <select aria-label="Site / device" className="block w-full rounded-md border border-border bg-background p-2 text-foreground" value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)}>
            {!devices?.length && <option value="">{devices === undefined ? "Loading devices…" : "No registered devices"}</option>}
            {devices?.map((item) => <option key={item.deviceId} value={item.deviceId}>{item.location ? `${item.location} · ` : ""}{item.name} ({item.deviceId})</option>)}
          </select>
        </label>
        <Link className="text-sm text-primary underline py-2" to="/devices">Manage devices</Link>
      </div>
      <div role="status" className="rounded-lg border p-4 space-y-2" style={{ borderColor: LEVEL_COLOR[quality] }}>
        <p className="text-lg font-semibold" style={{ color: LEVEL_COLOR[quality] }}>{qualityLabel(quality)}</p>
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Radio className="h-4 w-4" />
          {currentFreshness === "fresh" ? "Receiving device data" : currentFreshness === "missing" ? "No sensor data" : currentFreshness === "stale" ? "Stale data · check connection" : currentFreshness === "invalid" ? "Invalid timestamp · check device" : "Offline · check bridge and device"}
          {age !== null && Number.isFinite(age) ? ` · last receipt ${age}s ago` : ""}
        </p>
        <p className="text-sm text-muted-foreground">{decision?.reason ?? "Current water quality cannot be assessed. Restore telemetry and verify sensors before starting equipment."}</p>
      </div>
      <SensorReadings reading={latest} freshness={currentFreshness} />
      {currentFreshness !== "fresh" && latest && <p className="text-xs text-muted-foreground">Values above are the last received readings. They are historical, not a current water-quality assessment.</p>}
      <HardwareControlPanel />
      <Trends history={history} />
      <p className="text-xs text-muted-foreground">Device-ingested data indicates transport provenance. Calibration, sensor accuracy and actual pump motion require separate physical evidence.</p>
    </div>
  );
}

export default function Dashboard() {
  const { dataMode, setDataMode } = useProcessMode();
  const { isAuthenticated } = useConvexAuth();
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-xl font-semibold"><Droplets className="h-5 w-5 text-primary" />Water monitoring</h1><p className="mt-1 text-sm text-muted-foreground">Readings → alerts → operational response</p></div>
        <div className="flex gap-2" aria-label="Data mode">
          <Button size="sm" variant={dataMode === "demo" ? "default" : "outline"} onClick={() => setDataMode("demo")} aria-pressed={dataMode === "demo"}>Local demo</Button>
          <Button size="sm" variant={dataMode === "hardware" ? "default" : "outline"} onClick={() => setDataMode("hardware")} aria-pressed={dataMode === "hardware"}>Device data</Button>
        </div>
      </div>
      {dataMode === "demo" ? <DemoDashboard /> : (
        <>
          <Unauthenticated><Card className="p-6 space-y-3"><p className="text-sm">Sign in to monitor registered devices and use authorized controls.</p><SignInButton /></Card></Unauthenticated>
          <AuthLoading><p className="text-sm text-muted-foreground">Checking device access…</p></AuthLoading>
          <Authenticated>{isAuthenticated && <HardwareDashboard />}</Authenticated>
        </>
      )}
      <p className="flex items-start gap-2 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />Prototype thresholds are operational examples, not a water-safety certification. pH, TDS and turbidity cannot establish microbiological safety.</p>
    </div>
  );
}
