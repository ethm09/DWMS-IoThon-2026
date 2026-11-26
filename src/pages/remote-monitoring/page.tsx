import { useEffect, useState } from "react";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { Link } from "react-router-dom";
import { api } from "@/convex/_generated/api.js";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
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
                            fresh ? "text-green-500" : "text-amber-500"
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
                          to="/"
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

export default function RemoteMonitoring() {
  return (
    <>
      <AuthLoading>
        <p className="p-6" role="status">
          Checking session…
        </p>
      </AuthLoading>
      <Unauthenticated>
        <div className="space-y-4 p-6">
          <h1 className="text-xl font-bold">Sites and connectivity</h1>
          <p>Sign in to view registered sites.</p>
          <SignInButton />
          <p>
            <Link to="/" className="text-primary underline">
              Open the local demo
            </Link>
          </p>
        </div>
      </Unauthenticated>
      <Authenticated>
        <SitesInner />
      </Authenticated>
    </>
  );
}
