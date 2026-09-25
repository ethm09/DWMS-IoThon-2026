import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import {
  Wifi, WifiOff, AlertTriangle, Database, Radio,
  Settings2, Plug, TestTube2, Clock, ArrowRightLeft,
  CheckCircle2, XCircle, Loader2, Cpu,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import type { HardwareStatus } from "@/hooks/use-process-mode.ts";
import type { DataMode } from "@/lib/dwms-safety.ts";

// Status display constants
const HW_STATUS_CONFIG: Record<HardwareStatus, { label: string; color: string; icon: typeof Wifi; description: string }> = {
  connected: {
    label: "CONNECTED",
    color: "#22c55e",
    icon: Wifi,
    description: "Receiving live sensor data (last reading < 10s ago)",
  },
  warning: {
    label: "WARNING",
    color: "#eab308",
    icon: AlertTriangle,
    description: "No data received for 10–30 seconds — check hardware connection",
  },
  disconnected: {
    label: "DISCONNECTED",
    color: "#6b7280",
    icon: WifiOff,
    description: "No data received for 30+ seconds or hardware not configured",
  },
};

function DataSourceInner() {
  const {
    dataMode, setDataMode,
    hardwareStatus,
    apiUrl, setApiUrl,
    selectedDeviceId, setSelectedDeviceId,
    lastUpdated,
    setSensorData,
  } = useProcessMode();

  const devices = useQuery(api.devices.listDevices, {});
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [urlDraft, setUrlDraft] = useState(apiUrl);

  const hwConfig = HW_STATUS_CONFIG[hardwareStatus];
  const HwIcon = hwConfig.icon;

  // Handle mode change with safety checks
  const handleModeChange = useCallback((newMode: string) => {
    if (newMode === "hardware" && hardwareStatus === "connected") {
      // Already connected, just switch
      setDataMode(newMode as DataMode);
      toast.success("Switched to Real Hardware mode");
    } else if (newMode === "hardware") {
      // Switch with a warning
      setDataMode(newMode as DataMode);
      toast("Switched to Hardware mode — waiting for device data", {
        description: "If no data arrives in 30 seconds, consider switching back to Demo.",
      });
    } else {
      // Switch to demo — safe to do unless hardware is actively connected
      if (hardwareStatus === "connected") {
        toast("Switched to Demo Data — hardware data will be ignored while in Demo mode");
      }
      setDataMode(newMode as DataMode);
    }
  }, [hardwareStatus, setDataMode]);

  // Test connection by making a lightweight GET/OPTIONS to the API URL
  const handleTestConnection = useCallback(async () => {
    if (!urlDraft.trim()) {
      toast.error("Enter an API URL first");
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      // Attempt a basic connectivity check using OPTIONS preflight
      const testUrl = urlDraft.trim().replace(/\/$/, "") + "/arduino/data";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const resp = await fetch(testUrl, {
        method: "OPTIONS",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (resp.ok || resp.status === 204) {
        setTestResult({ ok: true, message: `Endpoint reachable (${resp.status})` });
        toast.success("Connection successful — endpoint is reachable");
      } else {
        setTestResult({ ok: false, message: `Endpoint responded with ${resp.status}` });
        toast.error(`Connection test failed: HTTP ${resp.status}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setTestResult({ ok: false, message: message.includes("abort") ? "Request timed out (5s)" : message });
      toast.error(`Connection test failed: ${message}`);
    } finally {
      setTestLoading(false);
    }
  }, [urlDraft]);

  const handleSaveUrl = useCallback(() => {
    setApiUrl(urlDraft.trim());
    toast.success("API URL saved");
  }, [urlDraft, setApiUrl]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-widest text-primary flex items-center gap-2">
          <Settings2 className="w-5 h-5" /> DATA SOURCE
        </h1>
        <p className="text-xs text-muted-foreground mt-1 tracking-wider">
          Configure how the system receives sensor data — Demo simulation or Real Hardware
        </p>
      </div>

      {/* Data Mode Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold tracking-widest flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-primary" /> DATA MODE
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ModeCard
              active={dataMode === "demo"}
              onClick={() => handleModeChange("demo")}
              icon={<Database className="w-5 h-5" />}
              title="DEMO DATA"
              description="Gentle random drift of sensor values for testing and demonstration"
              color="#3b82f6"
            />
            <ModeCard
              active={dataMode === "hardware"}
              onClick={() => handleModeChange("hardware")}
              icon={<Radio className="w-5 h-5" />}
              title="REAL HARDWARE"
              description="Live readings from Arduino sensors via the Python Serial Bridge"
              color="#22c55e"
            />
          </div>

          {/* Safety note */}
          <div className="rounded-lg p-3 text-xs"
            style={{ background: "oklch(0.1 0.03 145)", border: "1px solid oklch(0.2 0.04 145)" }}>
            <p className="font-bold tracking-wider text-muted-foreground mb-1">SAFETY RULE</p>
            <p className="text-muted-foreground">
              When hardware is actively sending data, switching to Demo mode will not overwrite live readings.
              Demo drift only runs while no hardware data is received.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Hardware Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold tracking-widest flex items-center gap-2">
            <Plug className="w-4 h-4 text-primary" /> HARDWARE STATUS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border p-4 flex items-center gap-4"
            style={{ borderColor: `${hwConfig.color}50`, background: `${hwConfig.color}08` }}
          >
            <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${hwConfig.color}18`, border: `1px solid ${hwConfig.color}40` }}>
              <HwIcon className="w-6 h-6" style={{ color: hwConfig.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-widest" style={{ color: hwConfig.color }}>
                  {hwConfig.label}
                </span>
                {hardwareStatus === "connected" && (
                  <motion.div
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-2 h-2 rounded-full"
                    style={{ background: hwConfig.color }}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{hwConfig.description}</p>
            </div>
          </motion.div>

          {/* Last Updated */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>
              Last data received:{" "}
              {lastUpdated && lastUpdated !== new Date(0).toISOString()
                ? new Date(lastUpdated).toLocaleString()
                : "Never"}
            </span>
          </div>

          {/* Fallback message */}
          <AnimatePresence>
            {dataMode === "hardware" && hardwareStatus === "disconnected" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-lg border p-3 flex items-start gap-2"
                style={{ borderColor: "#eab30850", background: "#eab30808" }}
              >
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-yellow-500 tracking-wider">HARDWARE UNREACHABLE</p>
                  <p className="text-muted-foreground mt-0.5">
                    No data in 30+ seconds. The system will display the last known values.
                    Switch to Demo mode if you want simulated data while hardware is offline.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* API Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold tracking-widest flex items-center gap-2">
            <TestTube2 className="w-4 h-4 text-primary" /> CONNECTION SETTINGS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* API URL */}
          <div className="space-y-2">
            <Label className="text-xs tracking-widest font-bold">HTTP ACTIONS URL</Label>
            <div className="flex gap-2">
              <Input
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://your-deployment.convex.site"
                className="font-mono text-xs flex-1"
              />
              <Button
                size="sm"
                onClick={handleSaveUrl}
                disabled={urlDraft.trim() === apiUrl}
                className="shrink-0 cursor-pointer"
              >
                Save
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground tracking-wider">
              The Convex HTTP Actions endpoint. Your Python bridge sends data to this URL + /arduino/data
            </p>
          </div>

          {/* Device selector */}
          {devices && devices.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs tracking-widest font-bold">ACTIVE DEVICE</Label>
              <Select value={selectedDeviceId || "none"} onValueChange={(v) => setSelectedDeviceId(v === "none" ? "" : v)}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Select a device..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="cursor-pointer">No device selected</SelectItem>
                  {devices.map((d) => (
                    <SelectItem key={d.deviceId} value={d.deviceId} className="cursor-pointer">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: d.status === "online" ? "#22c55e" : "#6b7280" }} />
                        {d.name} ({d.deviceId})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Test Connection */}
          <div className="space-y-2 pt-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { void handleTestConnection(); }}
              disabled={testLoading || !urlDraft.trim()}
              className="gap-2 cursor-pointer"
            >
              {testLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube2 className="w-3.5 h-3.5" />}
              {testLoading ? "Testing..." : "Test Connection"}
            </Button>

            {/* Test result */}
            <AnimatePresence>
              {testResult && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-xs rounded-lg p-2.5"
                  style={{
                    background: testResult.ok ? "#22c55e10" : "#ef444410",
                    border: `1px solid ${testResult.ok ? "#22c55e40" : "#ef444440"}`,
                  }}
                >
                  {testResult.ok
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                  <span className={testResult.ok ? "text-green-400" : "text-red-400"}>
                    {testResult.message}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Supported Protocols */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold tracking-widest flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" /> SUPPORTED HARDWARE
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { name: "Arduino + Serial Bridge", desc: "USB serial → Python → HTTP POST", supported: true },
              { name: "ESP32 / WiFi MCU", desc: "Direct HTTP POST from board", supported: true },
              { name: "REST API / Webhook", desc: "Any device posting JSON to endpoint", supported: true },
              { name: "Firebase / Supabase", desc: "External DB → webhook bridge", supported: true },
            ].map((proto) => (
              <div key={proto.name} className="rounded-lg border border-border p-3 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ background: proto.supported ? "#22c55e" : "#6b7280" }} />
                <div>
                  <p className="text-xs font-bold tracking-wider text-foreground">{proto.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{proto.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Mode selection card */
function ModeCard({
  active, onClick, icon, title, description, color,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer rounded-xl border p-4 text-left transition-all relative overflow-hidden"
      style={{
        borderColor: active ? `${color}80` : "oklch(0.26 0.04 145)",
        background: active ? `${color}10` : "oklch(0.13 0.02 145)",
      }}
    >
      {active && (
        <motion.div
          layoutId="active-mode-indicator"
          className="absolute top-2 right-2 w-2 h-2 rounded-full"
          style={{ background: color }}
        />
      )}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{
            background: active ? `${color}20` : "oklch(0.18 0.03 145)",
            color: active ? color : "oklch(0.55 0.04 145)",
          }}>
          {icon}
        </div>
        <span className="text-xs font-bold tracking-widest"
          style={{ color: active ? color : "oklch(0.75 0.02 90)" }}>
          {title}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{description}</p>
    </button>
  );
}

export default function DataSourcePage() {
  return (
    <>
      <Unauthenticated>
        <div className="flex items-center justify-center h-full p-6">
          <div className="text-center space-y-4">
            <Settings2 className="w-12 h-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Sign in to configure data sources</p>
            <SignInButton />
          </div>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AuthLoading>
      <Authenticated>
        <DataSourceInner />
      </Authenticated>
    </>
  );
}
