/**
 * HardwareBridge — subscribes to the selected device's latest reading from
 * Convex and feeds it into the ProcessMode global state when in "hardware" mode.
 * 
 * This component renders no UI — it is placed inside the provider tree where it
 * has access to both Convex queries (via the ConvexProvider) and the ProcessMode
 * context (via the ProcessModeProvider).
 */
import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useProcessMode } from "@/hooks/use-process-mode.ts";

export default function HardwareBridge() {
  const { dataMode, selectedDeviceId, setSensorData, syncHardwareControlState } = useProcessMode();

  // Only subscribe when in hardware mode and a device is selected
  const shouldSubscribe = dataMode === "hardware" && !!selectedDeviceId;

  const latestReading = useQuery(
    api.devices.getLatestReading,
    shouldSubscribe ? { deviceId: selectedDeviceId } : "skip"
  );
  const controlState = useQuery(
    api.devices.getControlState,
    shouldSubscribe ? { deviceId: selectedDeviceId } : "skip",
  );

  // Track last timestamp to avoid re-processing the same reading
  const lastTimestamp = useRef<string>("");
  const lastControlState = useRef<string>("");

  useEffect(() => {
    if (!latestReading) return;
    const signature = `${selectedDeviceId}:${latestReading.timestamp}`;
    if (signature === lastTimestamp.current) return;

    lastTimestamp.current = signature;

    setSensorData({
      ph: latestReading.ph,
      tds: latestReading.tds,
      turbidity: latestReading.turbidity,
      timestamp: latestReading.timestamp,
      source: "device",
    });
  }, [latestReading, selectedDeviceId, setSensorData]);

  useEffect(() => {
    if (!controlState) return;
    const reported = controlState.reportedPumpState;
    const signature = `${selectedDeviceId}:${controlState.mode}:${reported}`;
    if (signature === lastControlState.current) return;
    lastControlState.current = signature;
    syncHardwareControlState(controlState.mode, reported);
  }, [controlState, selectedDeviceId, syncHardwareControlState]);

  return null;
}
