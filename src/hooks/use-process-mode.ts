import { createContext, useContext } from "react";
import type { SystemMode, DataMode, SafetyLevel, SafetyDecision } from "@/lib/dwms-safety.ts";

// Canonical control mode is the three-state SystemMode from the safety engine.
export type ControlMode = SystemMode;

export type SensorSnapshot = {
  ph?: number;
  tds?: number;
  turbidity?: number;
  temperature?: number;
  flowRate?: number;
  pressure?: number;
  timestamp: string;
  source: "device" | "simulated";
};

// Live readings tracked in the global persisted state.
export type Readings = {
  ph: number | null;
  tds: number | null;
  turbidity: number | null;
  flowRate: number | null;
};

export type HardwareStatus = "connected" | "warning" | "disconnected";

export type EthmAlert = {
  id: string;
  level: "advisory" | "action" | "critical";
  parameter: string;
  message: string;
  voiceMessage: string;
  autoSwitched?: boolean;
  timestamp: string;
};
// Backwards-compatible alias (older components referenced JarvisAlert).
export type JarvisAlert = EthmAlert;

// A single entry in the persistent event log.
export type DwmsEvent = {
  id: string;
  timestamp: string;
  type: string; // e.g. "Pump Stopped", "Ethm AI Warning", "Emergency Shutdown"
  parameter?: string;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  decision?: string;
  action?: string;
  systemMode: SystemMode;
  pumpStatus: boolean;
};

export type ProcessModeContextType = {
  // ── Core mode ──
  /** Canonical mode: auto | manual | emergency. */
  mode: ControlMode;
  setMode: (m: ControlMode) => void;

  // ── Manual override ──
  manualOverride: boolean;
  engageManualOverride: () => void;
  returnToAuto: () => void;

  // ── Emergency shutdown ──
  emergencyShutdown: boolean;
  /** Trigger an emergency shutdown (stops + locks the pump). */
  triggerEmergency: (reason: string, parameter: string) => void;
  /** Acknowledge and clear an emergency shutdown (operator action). */
  acknowledgeEmergency: () => void;

  // ── Pump / filtration ──
  pumpStatus: boolean;
  setPumpStatus: (on: boolean, manual?: boolean) => void;
  filterStatus: boolean;
  setFilterStatus: (on: boolean) => void;

  // ── Live readings (global, persisted) ──
  readings: Readings;
  /** Apply a corrected/new value to a single reading. */
  applyReading: (key: keyof Readings, value: number) => void;

  // ── Latest safety decision (continuously evaluated) ──
  decision: SafetyDecision;
  quality: SafetyLevel;

  // ── Data source / hardware ──
  dataMode: DataMode;
  setDataMode: (m: DataMode) => void;
  hardwareStatus: HardwareStatus;
  apiUrl: string;
  setApiUrl: (url: string) => void;

  // ── Device selection (Convex IoT registry) ──
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  sensorData: SensorSnapshot | null;
  setSensorData: (data: SensorSnapshot) => void;

  // ── Event log (persisted) ──
  eventLog: DwmsEvent[];
  logEvent: (e: Omit<DwmsEvent, "id" | "timestamp" | "systemMode" | "pumpStatus">) => void;
  clearEventLog: () => void;

  // ── Ethm AI alerts (the Guardian overlay) ──
  alerts: EthmAlert[];
  addAlert: (alert: EthmAlert) => void;
  clearAlert: (id: string) => void;
  guardianOpen: boolean;
  setGuardianOpen: (open: boolean) => void;

  // ── Ethm AI chat panel ──
  assistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;

  lastUpdated: string;
};

export const ProcessModeContext = createContext<ProcessModeContextType | null>(null);

export function useProcessMode(): ProcessModeContextType {
  const ctx = useContext(ProcessModeContext);
  if (!ctx) throw new Error("useProcessMode must be used inside ProcessModeProvider");
  return ctx;
}
