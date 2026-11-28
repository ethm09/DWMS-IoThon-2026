import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProcessMode } from "@/hooks/use-process-mode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CommandHistory({ compact = false }: { compact?: boolean }) {
  const { selectedDeviceId, setSelectedDeviceId } = useProcessMode();
  const devices = useQuery(api.devices.listDevices, {});
  const deviceId = devices?.some(device => device.deviceId === selectedDeviceId) ? selectedDeviceId : devices?.[0]?.deviceId;
  useEffect(() => { if (deviceId && deviceId !== selectedDeviceId) setSelectedDeviceId(deviceId); }, [deviceId, selectedDeviceId, setSelectedDeviceId]);
  const commands = useQuery(api.devices.getRecentCommands, deviceId ? { deviceId, limit: compact ? 4 : 50 } : "skip");
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return <Card className="min-w-0 shadow-none">
    <CardHeader><CardTitle className="text-base">Operational history</CardTitle>{!compact && <p className="text-sm text-muted-foreground">Persistent requests and controller acknowledgements. An acknowledgement does not prove physical pump motion.</p>}</CardHeader>
    <CardContent className="space-y-4">
      {!compact && <select aria-label="Event history device" value={deviceId || ""} onChange={event => setSelectedDeviceId(event.target.value)} className="min-h-11 max-w-full rounded-lg border border-border bg-background px-3 text-sm">{!devices?.length && <option value="">{devices === undefined ? "Loading devices…" : "No registered devices"}</option>}{devices?.map(device => <option key={device.deviceId} value={device.deviceId}>{device.name}</option>)}</select>}
      {!deviceId ? <p className="text-sm text-muted-foreground">Awaiting a registered device. No events are generated for this view.</p> : commands === undefined ? <p className="text-sm text-muted-foreground">Loading recorded events…</p> : !commands.length ? <p className="text-sm text-muted-foreground">No command events recorded for this device.</p> : <ol className="space-y-4">{commands.map(command => <li key={command.commandId} className="border-l-2 border-primary/25 pl-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold capitalize">{command.mode} · request {command.pumpOn ? "ON" : "OFF"}</p><span className={"rounded-md px-2 py-1 text-xs " + (command.status === "applied" ? "bg-emerald-50 text-emerald-700" : command.status === "failed" || command.status === "expired" ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground")}>{command.status === "pending" && now > Date.parse(command.expiresAt) ? "expired · no ACK" : command.status}</span></div>
        <p className="mt-1 text-xs text-muted-foreground">{command.source} · {new Date(command.createdAt).toLocaleString()}</p>
        <p className="mt-1 text-sm text-muted-foreground">Controller reported: {command.reportedPumpState === null ? "unconfirmed" : command.reportedPumpState ? "ON" : "OFF"}</p>
        {command.acknowledgedAt && <p className="mt-1 text-xs text-muted-foreground">Acknowledged {new Date(command.acknowledgedAt).toLocaleString()}</p>}
        {command.message && <p className="mt-1 break-words text-sm text-muted-foreground">{command.message}</p>}
      </li>)}</ol>}
    </CardContent>
  </Card>;
}
