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
import { api } from "@/convex/_generated/api.js";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import { useDemo } from "@/hooks/use-demo.ts";
import { DEMO_DEVICE } from "@/lib/demo-state.ts";
import { waterQuality } from "@/lib/monitoring.ts";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function SitesInner() {
  const devices = useQuery(api.devices.listDevices, {});
  const { setSelectedDeviceId, setDataMode } = useProcessMode();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(timer);
  }, []);

  const selectDevice = (deviceId: string) => {
    setDataMode("hardware");
    setSelectedDeviceId(deviceId);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold">Sites and connectivity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registered devices and their last accepted telemetry. Open a site to
          inspect readings and control acknowledgements.
        </p>
      </div>
      {devices === undefined ? (
        <p role="status">Loading registered devices…</p>
      ) : devices.length === 0 ? (
        <Card className="p-6 text-sm">
          No sites are registered.{" "}
          <Link to="/devices" className="text-primary underline">
            Register a device
          </Link>{" "}
          and give it a descriptive location.
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device / site</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Telemetry</TableHead>
                  <TableHead>Last receipt</TableHead>
                  <TableHead>Inspect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => {
                  const age = device.lastSeen
                    ? now - Date.parse(device.lastSeen)
                    : null;
                  const validAge =
                    age !== null && Number.isFinite(age) && age >= 0;
                  const fresh =
                    validAge && age <= 10_000 && device.status === "online";
                  const label =
                    device.status === "error"
                      ? "Device error"
                      : fresh
                        ? "Fresh"
                        : !device.lastSeen
                          ? "No data"
                          : validAge &&
                              age <= 30_000 &&
                              device.status === "online"
                            ? "Stale"
                            : "Offline / stale";
                  return (
                    <TableRow key={device.deviceId}>
                      <TableCell>
                        <p className="font-medium">{device.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {device.deviceId}
                        </p>
                      </TableCell>
                      <TableCell>
                        {device.location || "Not configured"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            fresh ? "text-emerald-700" : "text-amber-800"
                          }
                        >
                          {label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {device.lastSeen ? (
                          <time dateTime={device.lastSeen}>
                            {new Date(device.lastSeen).toLocaleString()}
                          </time>
                        ) : (
                          "Never"
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/dashboard"
                          onClick={() => selectDevice(device.deviceId)}
                          className="text-primary underline"
                        >
                          Open dashboard
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">
        Fresh means accepted telemetry within 10 seconds. Stale or offline
        readings cannot establish current water status. Sites share a device
        registry; this is a prototype monitoring view, with field capacity and
        network resilience still to be measured.
      </p>
    </div>
  );
}

function DemoSites() {
  const { state } = useDemo();
  const quality = waterQuality(state.readings, "fresh");
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <p className="mb-2 text-sm font-medium text-primary">Network</p>
        <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Inspect the node participating in this simulation.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{DEMO_DEVICE.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {DEMO_DEVICE.location}
              </p>
            </div>
            <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
              Virtual node
            </span>
          </div>
          <dl className="grid gap-5 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-muted-foreground">Water status</dt>
              <dd className="mt-1 font-medium">
                {quality === "safe"
                  ? "Within configured bands"
                  : quality === "critical"
                    ? "Critical"
                    : "Warning"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Response</dt>
              <dd className="mt-1 font-medium">
                {state.response.emergencyLatched
                  ? "Emergency latched"
                  : `${state.response.mode === "auto" ? "Auto" : "Manual"} · pump ${state.response.pumpOn ? "ON" : "OFF"}`}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                Last scenario update
              </dt>
              <dd className="mt-1 font-medium">
                {new Date(state.updatedAt).toLocaleTimeString()}
              </dd>
            </div>
          </dl>
          <Link
            to="/dashboard"
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Open monitoring
          </Link>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        One virtual node is included. Physical multi-site capacity requires
        connected devices and field validation.
      </p>
    </div>
  );
}

export default function RemoteMonitoring() {
  const { dataMode } = useProcessMode();
  const { isAuthenticated } = useConvexAuth();
  return dataMode === "demo" ? (
    <DemoSites />
  ) : (
    <LiveAccessState title="Live sites">
      <SitesInner />
    </LiveAccessState>
  );
}
