import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { AlertTriangle, Bell } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@/components/ui/signin.tsx";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import { classifyPh, classifyTds, classifyTurbidity } from "@/lib/dwms-safety.ts";

type AlertLevel = "critical" | "warning" | "info";
const colors = { critical: "text-red-400", warning: "text-amber-400", info: "text-cyan-400" };

export default function Alerts() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { selectedDeviceId } = useProcessMode();
  const [filter, setFilter] = useState<AlertLevel | "all">("all");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const notifications = useQuery(api.notifications.list, isAuthenticated ? { limit: 50 } : "skip");
  const reading = useQuery(api.devices.getLatestReading, isAuthenticated && selectedDeviceId ? { deviceId: selectedDeviceId } : "skip");
  const dismissNotification = useMutation(api.notifications.dismiss);
  const dismissAllNotifications = useMutation(api.notifications.dismissAll);
  const timestamp = reading ? Date.parse(reading.timestamp) : NaN;
  const age = now - timestamp;
  const fresh = Number.isFinite(age) && age >= 0 && age <= 10_000;
  const levels = reading && fresh ? [classifyPh(reading.ph), classifyTds(reading.tds), classifyTurbidity(reading.turbidity)] : [];
  const status = !selectedDeviceId ? "Select a device on the dashboard to view its current status."
    : reading === undefined ? "Loading selected-device status…"
      : !reading ? "UNKNOWN · No stored sensor reading."
        : !fresh ? "UNKNOWN · Stored reading is stale or its timestamp is invalid."
          : levels.includes("critical") ? "CRITICAL · A prototype threshold is exceeded."
            : levels.includes("warning") ? "WARNING · A reading is outside the configured band."
              : "WITHIN CONFIGURED BANDS · No current threshold alert.";
  const visible = (notifications ?? []).filter(item => filter === "all" || item.level === filter);
  const dismiss = async (notificationId: Id<"notifications">) => {
    try { await dismissNotification({ notificationId }); }
    catch { toast.error("Could not dismiss the saved notification"); }
  };
  const dismissAll = async () => {
    try {
      const count = await dismissAllNotifications({});
      toast.success(`${count} saved notifications dismissed`);
    } catch { toast.error("Could not dismiss saved notifications"); }
  };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold">Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">Saved backend notifications and the selected device's latest threshold status.</p>
      </div>
      <p className="text-sm text-muted-foreground">The <Link to="/" className="text-primary underline">dashboard demo</Link> is local and does not create saved alerts. This feed contains your account's notifications across devices; each event retains its original time and message.</p>
      {isLoading ? <p>Loading session…</p> : !isAuthenticated ? (
        <Card><CardContent className="pt-6 space-y-3"><p>Sign in to view saved device alerts.</p><SignInButton /></CardContent></Card>
      ) : <>
        <Card>
          <CardHeader><CardTitle className="text-base flex gap-2 items-center"><AlertTriangle className="w-4 h-4" /> Selected device · {selectedDeviceId || "none"}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className={!fresh ? "text-muted-foreground" : levels.includes("critical") ? colors.critical : levels.includes("warning") ? colors.warning : "text-green-400"}>{status}</p>
            {reading && <>
              <p className="font-mono text-sm">pH {reading.ph.toFixed(2)} · TDS {reading.tds.toFixed(0)} ppm · Turbidity {reading.turbidity.toFixed(2)} NTU</p>
              <p className="text-xs text-muted-foreground">Server receipt: {new Date(reading.timestamp).toLocaleString()}{Number.isFinite(age) && age >= 0 ? ` · ${Math.floor(age / 1000)}s ago` : ""}. {fresh ? "" : "Values are historical; current water status is unknown."}</p>
            </>}
            <p className="text-xs text-muted-foreground">Prototype thresholds do not certify water safety or treatment effectiveness. Verify flagged readings and follow approved site procedures.</p>
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-2 items-center">
          {(["all", "critical", "warning", "info"] as const).map(level => <Button key={level} variant={filter === level ? "default" : "secondary"} size="sm" onClick={() => setFilter(level)}>{level === "all" ? "All" : level[0].toUpperCase() + level.slice(1)}{level !== "all" ? ` (${(notifications ?? []).filter(item => item.level === level).length})` : ""}</Button>)}
          <Button className="ml-auto" variant="outline" size="sm" disabled={!notifications?.length} onClick={() => void dismissAll()}>Dismiss all</Button>
        </div>
        <Card>
          <CardHeader><CardTitle className="text-base flex gap-2 items-center"><Bell className="w-4 h-4" /> Saved notifications · latest 50</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {notifications === undefined ? <p>Loading saved notifications…</p> : visible.length === 0 ? <p className="text-muted-foreground">No saved notifications match this filter.</p> : visible.map(item => (
              <div key={item._id} className="border border-border rounded-lg p-3 flex gap-3 justify-between">
                <div className="space-y-1">
                  <p className={`font-semibold text-sm ${colors[item.level]}`}>{item.level.toUpperCase()} · {item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.message}</p>
                  {item.parameter && <p className="font-mono text-xs">{item.parameter}{item.value ? `: ${item.value}` : ""}</p>}
                  <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <Button size="sm" variant="ghost" aria-label={`Dismiss ${item.title}`} onClick={() => void dismiss(item._id)}>Dismiss</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </>}
    </div>
  );
}
