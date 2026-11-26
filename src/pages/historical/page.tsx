import { LiveAccessState } from "@/components/live-access-state";
import { useEffect, useState } from "react";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
  useConvexAuth,
} from "convex/react";
import { WorkspaceLink as Link } from "@/components/workspace-link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/convex/_generated/api.js";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import { useDemo } from "@/hooks/use-demo.ts";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { THRESHOLDS } from "@/lib/dwms-safety";
const METRICS = {
  ph: { label: "pH", unit: "pH", color: "#8D62AE" },
  tds: { label: "TDS", unit: "ppm", color: "#168A70" },
  turbidity: { label: "Turbidity", unit: "NTU", color: "#AC750B" },
};
type Metric = keyof typeof METRICS;
const selectClass = "rounded-md border border-border bg-background p-2 text-sm";

function HistoryInner() {
  const { selectedDeviceId, setSelectedDeviceId } = useProcessMode();
  const devices = useQuery(api.devices.listDevices, {});
  const [metric, setMetric] = useState<Metric>("ph");
  const [range, setRange] = useState("all");
  const [now, setNow] = useState(Date.now);
  const deviceId = devices?.some(
    (device) => device.deviceId === selectedDeviceId,
  )
    ? selectedDeviceId
    : devices?.[0]?.deviceId;
  useEffect(() => {
    if (deviceId && deviceId !== selectedDeviceId)
      setSelectedDeviceId(deviceId);
  }, [deviceId, selectedDeviceId, setSelectedDeviceId]);
  const readings = useQuery(
    api.devices.getRecentReadings,
    deviceId ? { deviceId, limit: 200 } : "skip",
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(timer);
  }, []);

  const config = METRICS[metric];
  const normalLimit =
    metric === "ph"
      ? THRESHOLDS.ph.safe.max
      : metric === "tds"
        ? THRESHOLDS.tds.safe.max
        : THRESHOLDS.turbidity.safe.max;
  const visibleReadings = (readings ?? []).filter(
    (reading) =>
      range === "all" ||
      (now - Date.parse(reading.timestamp) >= 0 &&
        now - Date.parse(reading.timestamp) <= Number(range)),
  );
  const history = visibleReadings
    .slice()
    .reverse()
    .map((reading) => ({
      ...reading,
      receivedAt: Date.parse(reading.timestamp),
    }));
  const latest = readings?.[0];
  const age = latest ? now - Date.parse(latest.timestamp) : null;
  const fresh =
    age !== null &&
    Number.isFinite(age) &&
    age >= 0 &&
    age <= 10_000 &&
    devices?.find((device) => device.deviceId === deviceId)?.status ===
      "online";

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold">Sensor history</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stored device readings only. Browser demo values are not saved here.
        </p>
      </div>
      {devices === undefined ? (
        <p role="status">Loading devices…</p>
      ) : devices.length === 0 ? (
        <Card className="p-6 text-sm">
          No devices are registered.{" "}
          <Link to="/devices" className="text-primary underline">
            Register a device
          </Link>{" "}
          to begin collecting history.
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <label className="grid gap-1 text-sm">
              Device / site
              <select
                className={selectClass}
                value={deviceId ?? ""}
                onChange={(event) => setSelectedDeviceId(event.target.value)}
              >
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.name} · {device.location || device.deviceId}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Time window
              <select
                className={selectClass}
                value={range}
                onChange={(event) => setRange(event.target.value)}
              >
                <option value="all">All 200 recent</option>
                <option value="60000">Last minute</option>
                <option value="300000">Last 5 minutes</option>
                <option value="3600000">Last hour</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Trend metric
              <select
                className={selectClass}
                value={metric}
                onChange={(event) => setMetric(event.target.value as Metric)}
              >
                {Object.entries(METRICS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label} ({value.unit})
                  </option>
                ))}
              </select>
            </label>
          </div>
          {readings === undefined ? (
            <p role="status">Loading stored readings…</p>
          ) : readings.length === 0 ? (
            <Card className="p-6 text-sm">
              No readings have been received for this device. Check its
              credentials, sensor calibration and serial bridge.
            </Card>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Latest receipt:{" "}
                <time dateTime={latest?.timestamp}>
                  {latest ? new Date(latest.timestamp).toLocaleString() : "—"}
                </time>
                {" · "}
                {fresh
                  ? "received within 10 seconds"
                  : "historical / stale; current water status is unknown"}
                .
              </p>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {config.label} ({config.unit}) · latest {history.length}{" "}
                    records
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {history.length === 0 && (
                    <p className="py-4 text-sm text-muted-foreground">
                      No samples in this time window.
                    </p>
                  )}
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart
                      data={history}
                      margin={{ top: 8, right: 20, bottom: 10, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis
                        dataKey="receivedAt"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(value: number) =>
                          new Date(value).toLocaleTimeString()
                        }
                        tick={{ fontSize: 11 }}
                        minTickGap={50}
                      />
                      <YAxis
                        domain={
                          metric === "ph"
                            ? [0, 14]
                            : [
                                0,
                                (maximum: number) =>
                                  Math.max(maximum * 1.1, normalLimit * 1.2),
                              ]
                        }
                        tick={{ fontSize: 11 }}
                        width={55}
                      />
                      <Tooltip
                        labelFormatter={(value) =>
                          new Date(Number(value)).toLocaleString()
                        }
                        formatter={(value) => [
                          `${value} ${config.unit}`,
                          config.label,
                        ]}
                      />
                      {metric === "ph" && (
                        <ReferenceLine
                          y={THRESHOLDS.ph.safe.min}
                          stroke="#AC750B"
                          strokeDasharray="4 4"
                        />
                      )}
                      <ReferenceLine
                        y={normalLimit}
                        stroke="#AC750B"
                        strokeDasharray="4 4"
                      />
                      <Line
                        type="linear"
                        dataKey={metric}
                        name={config.label}
                        stroke={config.color}
                        strokeWidth={2}
                        dot={history.length < 20}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Horizontal axis: server receipt time. Lines connect received
                    samples and do not establish continuous measurement between
                    them. Dashed lines show the configured normal band.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Recent readings · newest first
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Received at</TableHead>
                        <TableHead>pH</TableHead>
                        <TableHead>TDS (ppm)</TableHead>
                        <TableHead>Turbidity (NTU)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleReadings.slice(0, 20).map((reading) => (
                        <TableRow key={reading._id}>
                          <TableCell>
                            <time dateTime={reading.timestamp}>
                              {new Date(reading.timestamp).toLocaleString()}
                            </time>
                          </TableCell>
                          <TableCell>{reading.ph.toFixed(2)}</TableCell>
                          <TableCell>{reading.tds.toFixed(1)}</TableCell>
                          <TableCell>{reading.turbidity.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Timestamps record backend receipt, not probe acquisition time. Device
        ingestion alone does not establish physical calibration or water
        compliance. This view is limited to 200 recent records per device.
      </p>
    </div>
  );
}

function DemoHistory() {
  const { state } = useDemo();
  const [metric, setMetric] = useState<"ph" | "tds" | "turbidity" | "flowRate">(
    "turbidity",
  );
  const metrics = {
    ...METRICS,
    flowRate: { label: "Flow", unit: "L/min", color: "#087EA4" },
  };
  const config = metrics[metric];
  const normalLimit =
    metric === "ph"
      ? THRESHOLDS.ph.safe.max
      : metric === "tds"
        ? THRESHOLDS.tds.safe.max
        : metric === "turbidity"
          ? THRESHOLDS.turbidity.safe.max
          : THRESHOLDS.flowRate.safe.max;
  const history = state.history.map((reading) => ({
    ...reading,
    at: Date.parse(reading.timestamp),
  }));
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <p className="mb-2 text-sm font-medium text-primary">Monitoring</p>
        <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore the readings from your current simulation session.
        </p>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="grid gap-2 text-sm font-medium">
          Parameter
          <select
            className="min-h-11 rounded-lg border border-border bg-card px-3"
            value={metric}
            onChange={(event) => setMetric(event.target.value as typeof metric)}
          >
            {Object.entries(metrics).map(([key, item]) => (
              <option key={key} value={key}>
                {item.label} ({item.unit})
              </option>
            ))}
          </select>
        </label>
        <Link
          to="/dashboard"
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          Run another scenario
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {config.label} · {config.unit}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={history}
              margin={{ top: 12, right: 16, bottom: 12, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis
                dataKey="at"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(value: number) =>
                  new Date(value).toLocaleTimeString()
                }
                tick={{ fontSize: 12 }}
                minTickGap={50}
              />
              <YAxis
                domain={
                  metric === "ph"
                    ? [0, 14]
                    : [
                        0,
                        (maximum: number) =>
                          Math.max(maximum * 1.1, normalLimit * 1.2),
                      ]
                }
                tick={{ fontSize: 12 }}
                width={50}
              />
              <Tooltip
                labelFormatter={(value) =>
                  new Date(Number(value)).toLocaleTimeString()
                }
                formatter={(value) => [`${value} ${config.unit}`, config.label]}
              />
              {metric === "ph" && (
                <ReferenceLine
                  y={THRESHOLDS.ph.safe.min}
                  stroke="#AC750B"
                  strokeDasharray="4 4"
                />
              )}
              <ReferenceLine
                y={normalLimit}
                stroke="#AC750B"
                strokeDasharray="4 4"
              />
              <Line
                type="linear"
                dataKey={metric}
                stroke={config.color}
                strokeWidth={2}
                dot={history.length < 15}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-4 text-sm text-muted-foreground">
            {history.length} scenario{" "}
            {history.length === 1 ? "sample" : "samples"}. Samples are added
            when you apply a scenario; lines connect those example values.
            Dashed lines show the configured normal band.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session readings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applied at</TableHead>
                <TableHead>Scenario</TableHead>
                <TableHead>pH</TableHead>
                <TableHead>TDS · ppm</TableHead>
                <TableHead>Turbidity · NTU</TableHead>
                <TableHead>Flow · L/min</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.history
                .slice()
                .reverse()
                .slice(0, 20)
                .map((reading, index) => (
                  <TableRow key={`${reading.timestamp}-${index}`}>
                    <TableCell>
                      {new Date(reading.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="capitalize">
                      {reading.scenario === "filtration"
                        ? "Response"
                        : reading.scenario}
                    </TableCell>
                    <TableCell>{reading.ph.toFixed(2)}</TableCell>
                    <TableCell>{reading.tds.toFixed(0)}</TableCell>
                    <TableCell>{reading.turbidity.toFixed(1)}</TableCell>
                    <TableCell>{reading.flowRate.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function HistoricalData() {
  const { dataMode } = useProcessMode();
  const { isAuthenticated } = useConvexAuth();
  return dataMode === "demo" ? (
    <DemoHistory />
  ) : (
    <LiveAccessState title="Live trends">
      <HistoryInner />
    </LiveAccessState>
  );
}
