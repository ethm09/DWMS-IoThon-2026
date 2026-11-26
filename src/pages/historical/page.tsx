import { useEffect, useState } from "react";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/convex/_generated/api.js";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
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

const METRICS = {
  ph: { label: "pH", unit: "pH", color: "#a78bfa" },
  tds: { label: "TDS", unit: "ppm", color: "#34d399" },
  turbidity: { label: "Turbidity", unit: "NTU", color: "#fbbf24" },
};
type Metric = keyof typeof METRICS;
const selectClass = "rounded-md border border-border bg-background p-2 text-sm";

function HistoryInner() {
  const { selectedDeviceId, setSelectedDeviceId } = useProcessMode();
  const devices = useQuery(api.devices.listDevices, {});
  const [metric, setMetric] = useState<Metric>("ph");
  const [now, setNow] = useState(Date.now);
  const deviceId = devices?.some(
    (device) => device.deviceId === selectedDeviceId,
  )
    ? selectedDeviceId
    : devices?.[0]?.deviceId;
  const readings = useQuery(
    api.devices.getRecentReadings,
    deviceId ? { deviceId, limit: 200 } : "skip",
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(timer);
  }, []);

  const config = METRICS[metric];
  const history =
    readings
      ?.slice()
      .reverse()
      .map((reading) => ({
        ...reading,
        receivedAt: Date.parse(reading.timestamp),
      })) ?? [];
  const latest = readings?.[0];
  const age = latest ? now - Date.parse(latest.timestamp) : null;
  const fresh =
    age !== null && Number.isFinite(age) && age >= 0 && age <= 10_000;

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
                        domain={metric === "ph" ? [0, 14] : [0, "auto"]}
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
                    them.
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
                      {readings.slice(0, 20).map((reading) => (
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

export default function HistoricalData() {
  return (
    <>
      <AuthLoading>
        <p className="p-6" role="status">
          Checking session…
        </p>
      </AuthLoading>
      <Unauthenticated>
        <div className="space-y-4 p-6">
          <h1 className="text-xl font-bold">Sensor history</h1>
          <p>Sign in to view stored device readings.</p>
          <SignInButton />
          <p>
            <Link to="/" className="text-primary underline">
              Open the local demo
            </Link>
          </p>
        </div>
      </Unauthenticated>
      <Authenticated>
        <HistoryInner />
      </Authenticated>
    </>
  );
}
