"use client";
import { useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from "react";
import {
  ProcessModeContext,
  type ControlMode,
  type SensorSnapshot,
  type EthmAlert,
  type DwmsEvent,
  type Readings,
  type HardwareStatus,
} from "@/hooks/use-process-mode.ts";
import { evaluateState, overallQuality, type DataMode } from "@/lib/dwms-safety.ts";
import { toast } from "sonner";

const DEVICE_KEY = "ldwms.selectedDeviceId";
const STATE_KEY = "ldwms.dwmsState";
const LOG_KEY = "ldwms.eventLog";

// The full persisted DWMS state. Written to localStorage immediately on every
// change so it is restored BEFORE any default automatic values are applied.
type PersistedState = {
  pumpStatus: boolean;
  systemMode: ControlMode;
  manualOverride: boolean;
  emergencyShutdown: boolean;
  filterStatus: boolean;
  ph: number | null;
  tds: number | null;
  turbidity: number | null;
  flowRate: number | null;
  dataMode: DataMode;
  apiUrl: string;
  lastUpdated: string;
};

const DEFAULT_STATE: PersistedState = {
  pumpStatus: false,
  systemMode: "auto",
  manualOverride: false,
  emergencyShutdown: false,
  filterStatus: false,
  ph: 7.2,
  tds: 245,
  turbidity: 0.8,
  flowRate: 1.4,
  dataMode: "demo",
  apiUrl: "",
  lastUpdated: new Date(0).toISOString(),
};

function loadPersisted(): PersistedState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const state = { ...DEFAULT_STATE, ...parsed };

    // If in demo mode, clamp readings to safe ranges and clear any lingering
    // emergency state that was triggered by the old unclamped drift.
    if (state.dataMode === "demo") {
      if (state.ph !== null) state.ph = Math.max(6.0, Math.min(9.0, state.ph));
      if (state.tds !== null) state.tds = Math.max(100, Math.min(500, state.tds));
      if (state.turbidity !== null) state.turbidity = Math.max(0.1, Math.min(3.5, state.turbidity));
      if (state.emergencyShutdown) {
        state.emergencyShutdown = false;
        state.systemMode = "auto";
        state.manualOverride = false;
      }
    }

    return state;
  } catch {
    return DEFAULT_STATE;
  }
}

function loadLog(): DwmsEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DwmsEvent[];
  } catch {
    return [];
  }
}

export function ProcessModeProvider({ children }: { children: ReactNode }) {
  // Read saved values from localStorage BEFORE applying any defaults.
  const initial = useRef<PersistedState>(loadPersisted());

  const [mode, setModeInternal] = useState<ControlMode>(initial.current.systemMode);
  const [manualOverride, setManualOverride] = useState<boolean>(initial.current.manualOverride);
  const [emergencyShutdown, setEmergencyShutdown] = useState<boolean>(initial.current.emergencyShutdown);
  const [pumpStatus, setPumpStatusState] = useState<boolean>(initial.current.pumpStatus);
  const [filterStatus, setFilterStatusState] = useState<boolean>(initial.current.filterStatus);
  const [readings, setReadings] = useState<Readings>({
    ph: initial.current.ph,
    tds: initial.current.tds,
    turbidity: initial.current.turbidity,
    flowRate: initial.current.flowRate,
  });
  const [dataMode, setDataModeState] = useState<DataMode>(initial.current.dataMode);
  const [apiUrl, setApiUrlState] = useState<string>(initial.current.apiUrl);
  const [lastUpdated, setLastUpdated] = useState<string>(initial.current.lastUpdated);
  const [hardwareStatus, setHardwareStatus] = useState<HardwareStatus>("disconnected");

  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string>(
    () => (typeof window !== "undefined" ? localStorage.getItem(DEVICE_KEY) ?? "" : "")
  );
  const [sensorData, setSensorDataState] = useState<SensorSnapshot | null>(null);

  const [eventLog, setEventLog] = useState<DwmsEvent[]>(() => loadLog());
  const [alerts, setAlerts] = useState<EthmAlert[]>([]);
  const [guardianOpen, setGuardianOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const lastHardwareAt = useRef<number | null>(null);
  // Grace period after acknowledging an emergency — prevents immediate re-trigger
  // while the operator takes corrective action (standard SCADA behavior).
  const lastAcknowledgedAt = useRef<number>(0);

  // Mirror live state into a ref so callbacks can build accurate log entries
  // without being re-created on every state change.
  const stateRef = useRef({ mode, pumpStatus });
  stateRef.current = { mode, pumpStatus };

  // Single helper that writes the full DWMS state to localStorage immediately.
  const persist = useCallback((patch: Partial<PersistedState>) => {
    if (typeof window === "undefined") return;
    const current = loadPersisted();
    const next: PersistedState = {
      ...current,
      ...patch,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(next));
    setLastUpdated(next.lastUpdated);
  }, []);

  // ── Event log ────────────────────────────────────────────────────────────
  const logEvent = useCallback(
    (e: Omit<DwmsEvent, "id" | "timestamp" | "systemMode" | "pumpStatus">) => {
      const entry: DwmsEvent = {
        ...e,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        systemMode: stateRef.current.mode,
        pumpStatus: stateRef.current.pumpStatus,
      };
      setEventLog((prev) => {
        const next = [entry, ...prev].slice(0, 300);
        if (typeof window !== "undefined") localStorage.setItem(LOG_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const clearEventLog = useCallback(() => {
    setEventLog([]);
    if (typeof window !== "undefined") localStorage.removeItem(LOG_KEY);
  }, []);

  // ── Mode ──────────────────────────────────────────────────────────────────
  const setMode = useCallback(
    (m: ControlMode) => {
      // Emergency cannot be left except via acknowledge.
      if (stateRef.current.mode === "emergency" && m !== "emergency") return;
      setModeInternal((prev) => {
        if (prev !== m) {
          logEvent({ type: "Mode Changed", oldValue: prev, newValue: m, decision: "Operator changed system mode" });
        }
        return m;
      });
      persist({ systemMode: m });
    },
    [persist, logEvent]
  );

  // ── Pump ────────────────────────────────────────────────────────────────
  // Manual OFF engages Manual Override so Auto logic cannot turn it back on.
  const setPumpStatus = useCallback(
    (on: boolean, manual: boolean = true) => {
      // While locked by emergency, the pump can only be forced OFF.
      if (stateRef.current.mode === "emergency" && on) return;
      setPumpStatusState((prev) => {
        if (prev !== on) {
          logEvent({
            type: on ? "Pump Started" : "Pump Stopped",
            parameter: "Pump",
            oldValue: prev ? "ON" : "OFF",
            newValue: on ? "ON" : "OFF",
            action: manual ? "Manual operator action" : "Automatic control",
          });
        }
        return on;
      });
      if (manual && !on) {
        setManualOverride(true);
        setModeInternal("manual");
        persist({ pumpStatus: on, manualOverride: true, systemMode: "manual" });
        logEvent({ type: "Manual Override Activated", parameter: "Pump", decision: "Pump forced OFF — auto control blocked" });
      } else if (manual) {
        setModeInternal("manual");
        persist({ pumpStatus: on, systemMode: "manual" });
      } else {
        persist({ pumpStatus: on });
      }
    },
    [persist, logEvent]
  );

  const setFilterStatus = useCallback(
    (on: boolean) => {
      setFilterStatusState(on);
      persist({ filterStatus: on });
    },
    [persist]
  );

  // ── Manual override ────────────────────────────────────────────────────────
  const engageManualOverride = useCallback(() => {
    if (stateRef.current.mode === "emergency") return;
    setManualOverride(true);
    setModeInternal("manual");
    persist({ manualOverride: true, systemMode: "manual" });
    logEvent({ type: "Manual Override Activated", decision: "Operator engaged manual override" });
  }, [persist, logEvent]);

  const returnToAuto = useCallback(() => {
    if (stateRef.current.mode === "emergency") return; // must acknowledge first
    setManualOverride(false);
    setModeInternal("auto");
    persist({ manualOverride: false, systemMode: "auto" });
    logEvent({ type: "Returned to Auto Mode", decision: "Automatic control restored" });
  }, [persist, logEvent]);

  // ── Emergency shutdown ───────────────────────────────────────────────────
  const triggerEmergency = useCallback(
    (reason: string, parameter: string) => {
      if (stateRef.current.mode === "emergency") return; // already locked
      setEmergencyShutdown(true);
      setModeInternal("emergency");
      setPumpStatusState(false);
      persist({ emergencyShutdown: true, systemMode: "emergency", pumpStatus: false });
      logEvent({
        type: "Emergency Shutdown",
        parameter,
        decision: reason,
        action: "Pump stopped and system locked",
      });
    },
    [persist, logEvent]
  );

  const acknowledgeEmergency = useCallback(() => {
    setEmergencyShutdown(false);
    setManualOverride(false);
    setModeInternal("auto");
    persist({ emergencyShutdown: false, systemMode: "auto", manualOverride: false });
    logEvent({ type: "Emergency Acknowledged", decision: "Operator acknowledged shutdown — returned to Auto" });
    // Start a 30-second grace period so the same condition doesn't re-trigger instantly.
    lastAcknowledgedAt.current = Date.now();
  }, [persist, logEvent]);

  // ── Readings ────────────────────────────────────────────────────────────
  const applyReading = useCallback(
    (key: keyof Readings, value: number) => {
      setReadings((prev) => {
        const next = { ...prev, [key]: value };
        persist({ ph: next.ph, tds: next.tds, turbidity: next.turbidity, flowRate: next.flowRate });
        return next;
      });
    },
    [persist]
  );

  // ── Data source / hardware ─────────────────────────────────────────────────
  const setDataMode = useCallback(
    (m: DataMode) => {
      setDataModeState(m);
      persist({ dataMode: m });
      logEvent({ type: "Data Source Changed", newValue: m === "demo" ? "Demo Data" : "Real Hardware" });
      if (m === "hardware") {
        setHardwareStatus("disconnected");
        lastHardwareAt.current = null;
      }
      // When switching to demo, clear any emergency state so the user starts fresh.
      if (m === "demo" && stateRef.current.mode === "emergency") {
        setEmergencyShutdown(false);
        setManualOverride(false);
        setModeInternal("auto");
        persist({ dataMode: m, emergencyShutdown: false, systemMode: "auto", manualOverride: false });
      }
    },
    [persist, logEvent]
  );

  const setApiUrl = useCallback(
    (url: string) => {
      setApiUrlState(url);
      persist({ apiUrl: url });
    },
    [persist]
  );

  const setSelectedDeviceId = useCallback((id: string) => {
    setSelectedDeviceIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(DEVICE_KEY, id);
  }, []);

  // Persist incoming device sensor readings and feed them into global readings.
  const setSensorData = useCallback(
    (data: SensorSnapshot) => {
      setSensorDataState(data);
      if (data.source === "device") {
        lastHardwareAt.current = Date.now();
        setHardwareStatus("connected");
      }
      setReadings((prev) => {
        const next: Readings = {
          ph: data.ph ?? prev.ph,
          tds: data.tds ?? prev.tds,
          turbidity: data.turbidity ?? prev.turbidity,
          flowRate: data.flowRate ?? prev.flowRate,
        };
        persist({ ph: next.ph, tds: next.tds, turbidity: next.turbidity, flowRate: next.flowRate });
        return next;
      });
    },
    [persist]
  );

  // ── Ethm AI alerts ─────────────────────────────────────────────────────────
  const addAlert = useCallback((alert: EthmAlert) => {
    setAlerts((prev) => {
      const filtered = prev.filter((a) => a.parameter !== alert.parameter);
      return [alert, ...filtered].slice(0, 10);
    });
    setGuardianOpen(true);
  }, []);

  const clearAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // ── Continuous safety evaluation (single source of truth) ──────────────────
  const decision = useMemo(() => evaluateState(readings), [readings]);
  const quality = useMemo(() => overallQuality(readings), [readings]);

  // ── Central auto-response engine — applies the rule book site-wide. ─────────
  // Emergency conditions override EVERY mode. Auto mode (when not manually
  // overridden) may auto-correct flow and auto-start filtration. Manual mode
  // never auto-starts the pump unless an emergency is required.
  useEffect(() => {
    if (decision.emergency && !emergencyShutdown && mode !== "emergency") {
      // Never trigger emergency shutdowns in demo mode — demo is for safe testing.
      if (dataMode === "demo") return;
      // Respect a 30-second grace period after the operator acknowledged an emergency.
      // This gives time to correct the problem before the popup re-triggers.
      const gracePeriodMs = 30_000;
      if (Date.now() - lastAcknowledgedAt.current < gracePeriodMs) return;
      triggerEmergency(decision.reason, decision.parameter);
      return;
    }
    if (emergencyShutdown || mode === "emergency") return;
    if (mode !== "auto" || manualOverride) return;

    // Auto-correct flow above filter capacity.
    if (
      decision.parameter === "Flow Rate" &&
      decision.correctedValue !== undefined &&
      readings.flowRate !== null &&
      readings.flowRate > decision.correctedValue
    ) {
      const old = readings.flowRate;
      applyReading("flowRate", decision.correctedValue);
      logEvent({
        type: "Auto Correction Applied",
        parameter: "Flow Rate",
        oldValue: old,
        newValue: decision.correctedValue,
        decision: decision.reason,
        action: "Flow rate reduced to filter capacity",
      });
      return;
    }

    // Auto-start filtration for unsafe sensor readings.
    if (decision.startFiltration && !pumpStatus) {
      setPumpStatusState(true);
      setFilterStatusState(true);
      persist({ pumpStatus: true, filterStatus: true });
      logEvent({
        type: "Auto Filtration Started",
        parameter: decision.parameter,
        decision: decision.reason,
        action: "Pump started in Auto Mode",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision, mode, manualOverride, emergencyShutdown, pumpStatus]);

  // ── Demo data simulator — gentle live drift when in Demo mode. ──────────────
  // Flow rate is treated as a control parameter and is NOT drifted.
  // Ranges are clamped to safe operating bands so demo never triggers emergencies.
  useEffect(() => {
    if (dataMode !== "demo") return;
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const round = (v: number, d: number) => Number(v.toFixed(d));
    const id = setInterval(() => {
      setReadings((prev) => {
        const next: Readings = {
          // pH stays within 6.0–9.0 (safe operating range, avoids emergency at 5.5/9.5)
          ph: prev.ph === null ? null : round(clamp(prev.ph + (Math.random() - 0.5) * 0.06, 6.0, 9.0), 2),
          // TDS stays within 100–500 (avoids critical at 600+)
          tds: prev.tds === null ? null : Math.round(clamp(prev.tds + (Math.random() - 0.5) * 10, 100, 500)),
          // Turbidity stays within 0.1–3.5 (avoids critical at 4+)
          turbidity: prev.turbidity === null ? null : round(clamp(prev.turbidity + (Math.random() - 0.5) * 0.15, 0.1, 3.5), 2),
          flowRate: prev.flowRate,
        };
        persist({ ph: next.ph, tds: next.tds, turbidity: next.turbidity, flowRate: next.flowRate });
        return next;
      });
    }, 2500);
    return () => clearInterval(id);
  }, [dataMode, persist]);

  // Hardware watchdog: downgrade status based on time since last reading.
  useEffect(() => {
    if (dataMode !== "hardware") return;
    const interval = setInterval(() => {
      const last = lastHardwareAt.current;
      if (last === null) {
        setHardwareStatus("disconnected");
        return;
      }
      const elapsed = Date.now() - last;
      if (elapsed > 30000) setHardwareStatus("disconnected");
      else if (elapsed > 10000) setHardwareStatus("warning");
      else setHardwareStatus("connected");
    }, 2000);
    return () => clearInterval(interval);
  }, [dataMode]);

  // Auto-revert to demo if hardware mode stays disconnected for 30 seconds.
  // This fires once after switching to hardware mode. If data arrives (status
  // changes to "connected"), the timer is cleared.
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Clear any existing timer on mode/status change.
    if (revertTimerRef.current) {
      clearTimeout(revertTimerRef.current);
      revertTimerRef.current = null;
    }

    if (dataMode !== "hardware") return;
    // If already connected, no need to set a revert timer.
    if (hardwareStatus === "connected") return;

    // Start 30-second countdown to revert to demo.
    revertTimerRef.current = setTimeout(() => {
      // Only revert if still in hardware mode and still disconnected.
      setDataModeState((currentMode) => {
        if (currentMode !== "hardware") return currentMode;
        // Perform revert
        persist({ dataMode: "demo" });
        logEvent({ type: "Data Source Changed", newValue: "Demo Data", decision: "Auto-reverted: no hardware data received in 30 seconds" });
        setHardwareStatus("disconnected");
        toast("Reverted to Demo mode", {
          description: "No hardware data received in 30 seconds. Connect your device and try again.",
        });
        return "demo";
      });
    }, 30_000);

    return () => {
      if (revertTimerRef.current) {
        clearTimeout(revertTimerRef.current);
        revertTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataMode, hardwareStatus]);

  // Keep state synchronized across tabs/windows.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === LOG_KEY) {
        setEventLog(loadLog());
        return;
      }
      if (e.key !== STATE_KEY || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue) as PersistedState;
        setModeInternal(s.systemMode);
        setManualOverride(s.manualOverride);
        setEmergencyShutdown(s.emergencyShutdown);
        setPumpStatusState(s.pumpStatus);
        setFilterStatusState(s.filterStatus);
        setReadings({ ph: s.ph, tds: s.tds, turbidity: s.turbidity, flowRate: s.flowRate });
        setDataModeState(s.dataMode);
        setApiUrlState(s.apiUrl);
        setLastUpdated(s.lastUpdated);
      } catch {
        // ignore malformed payloads
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <ProcessModeContext.Provider
      value={{
        mode,
        setMode,
        manualOverride,
        engageManualOverride,
        returnToAuto,
        emergencyShutdown,
        triggerEmergency,
        acknowledgeEmergency,
        pumpStatus,
        setPumpStatus,
        filterStatus,
        setFilterStatus,
        readings,
        applyReading,
        decision,
        quality,
        dataMode,
        setDataMode,
        hardwareStatus,
        apiUrl,
        setApiUrl,
        selectedDeviceId,
        setSelectedDeviceId,
        sensorData,
        setSensorData,
        eventLog,
        logEvent,
        clearEventLog,
        alerts,
        addAlert,
        clearAlert,
        guardianOpen,
        setGuardianOpen,
        assistantOpen,
        setAssistantOpen,
        lastUpdated,
      }}
    >
      {children}
    </ProcessModeContext.Provider>
  );
}
