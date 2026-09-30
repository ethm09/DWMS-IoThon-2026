import { useMutation, useQuery } from "convex/react";
import { Activity, AlertTriangle, Loader2, Power, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The control request failed.";
}

export default function HardwareControlPanel() {
  const {
    dataMode,
    mode: localMode,
    pumpStatus: localPumpStatus,
    setMode,
    setPumpStatus,
    triggerEmergency,
    acknowledgeEmergency,
    selectedDeviceId,
    hardwareStatus,
  } = useProcessMode();
  const { canControl } = useUserRole();
  const hardwareMode = dataMode === "hardware";
  const state = useQuery(
    api.devices.getControlState,
    hardwareMode && selectedDeviceId ? { deviceId: selectedDeviceId } : "skip",
  );
  const setHardwareMode = useMutation(api.devices.setDeviceControlMode);
  const setHardwarePump = useMutation(api.devices.setDevicePump);
  const acknowledgeHardwareEmergency = useMutation(api.devices.acknowledgeDeviceEmergency);

  const submit = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const mode = hardwareMode ? (state?.mode ?? "auto") : localMode;
  const pumpOn = hardwareMode ? (state?.reportedPumpState ?? null) : localPumpStatus;
  const waitingForCommand = state?.command?.status === "pending";
  const connected = hardwareStatus === "connected";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-widest">
          <Power className="h-4 w-4 text-primary" /> FILTRATION CONTROL
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            {hardwareMode ? <Activity className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
            <div>
              <p className="text-xs font-bold tracking-wider">
                {hardwareMode ? "PHYSICAL DEVICE" : "SIMULATION ONLY"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {hardwareMode
                  ? selectedDeviceId
                    ? `${selectedDeviceId} · ${connected ? "connected" : hardwareStatus}`
                    : "Select a device on the Data Source page"
                  : "These controls change local demo state; they do not operate a relay."}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold tracking-widest text-muted-foreground">CONTROLLER REPORTED STATE</p>
            <p className={`font-mono text-sm font-bold ${pumpOn === null ? "text-amber-500" : pumpOn ? "text-green-500" : "text-muted-foreground"}`}>
              {pumpOn === null ? "UNKNOWN" : pumpOn ? "ON" : "OFF"}
            </p>
          </div>
        </div>

        {hardwareMode && waitingForCommand && (
          <p className="text-xs text-amber-500">
            Command sent: pump {state.command?.pumpOn ? "ON" : "OFF"}. Waiting for an Arduino acknowledgement.
          </p>
        )}
        {hardwareMode && state?.command && ["failed", "expired"].includes(state.command.status) && (
          <p className="text-xs text-destructive">
            {state.command.message ?? state.message ?? "The device did not confirm this command."}
          </p>
        )}
        {hardwareMode && state?.mode === "emergency" && (
          <p className="flex items-start gap-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Emergency lock is active. The backend and Arduino must confirm safe readings before Auto can resume.
          </p>
        )}
        {hardwareMode && !connected && (
          <p className="text-xs text-muted-foreground">
            Hardware mode remains active while disconnected. Pump state is based on the last Arduino acknowledgement; unconfirmed output is shown as unknown.
          </p>
        )}
        {hardwareMode && (
          <p className="text-[10px] text-muted-foreground">
            The Arduino acknowledgement confirms its software relay state only. No relay-contact or pump-motion feedback sensor is installed.
          </p>
        )}

        {!hardwareMode ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={mode === "auto" ? "default" : "secondary"} onClick={() => setMode("auto")}>
              Auto
            </Button>
            <Button size="sm" variant={mode === "manual" ? "default" : "secondary"} onClick={() => setMode("manual")}>
              Manual
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setPumpStatus(!localPumpStatus, true)}>
              {localPumpStatus ? "Stop simulated pump" : "Start simulated pump"}
            </Button>
            {mode === "emergency" ? (
              <Button size="sm" variant="secondary" onClick={acknowledgeEmergency}>
                Acknowledge demo emergency
              </Button>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => triggerEmergency("Operator requested demo stop", "Pump")}>
                Demo emergency stop
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={mode === "auto" ? "default" : "secondary"}
              disabled={!canControl || !connected || mode === "emergency" || !selectedDeviceId}
              onClick={() => void submit(() => setHardwareMode({ deviceId: selectedDeviceId, mode: "auto" }), "Automatic mode requested")}
            >
              Auto
            </Button>
            <Button
              size="sm"
              variant={mode === "manual" ? "default" : "secondary"}
              disabled={!canControl || !connected || mode === "emergency" || !selectedDeviceId}
              onClick={() => void submit(() => setHardwareMode({ deviceId: selectedDeviceId, mode: "manual" }), "Manual mode requested")}
            >
              Manual
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!canControl || !selectedDeviceId || mode !== "manual" || (!connected && !pumpOn)}
              onClick={() => void submit(() => setHardwarePump({ deviceId: selectedDeviceId, pumpOn: !pumpOn }), pumpOn ? "Pump stop requested" : "Pump start requested")}
            >
              {pumpOn ? "Stop pump" : "Start pump"}
            </Button>
            {mode === "emergency" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={!canControl || !connected || !selectedDeviceId}
                onClick={() => void submit(() => acknowledgeHardwareEmergency({ deviceId: selectedDeviceId }), "Emergency acknowledgement requested")}
              >
                <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Acknowledge
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                disabled={!canControl || !selectedDeviceId}
                onClick={() => void submit(() => setHardwareMode({ deviceId: selectedDeviceId, mode: "emergency" }), "Emergency stop requested")}
              >
                Emergency stop
              </Button>
            )}
            {!canControl && <p className="w-full text-xs text-muted-foreground">Only an administrator or operator can control hardware.</p>}
            {hardwareMode && state === undefined && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
