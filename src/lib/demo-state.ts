import { classifyFlow, classifyPh, classifyTds, classifyTurbidity, type SafetyLevel } from "../../convex/safetyPolicy";
import { DEMO_SCENARIOS, demoResponse, type DemoScenario, type WaterReading } from "./monitoring";

export const DEMO_DEVICE = { deviceId: "SIMULATION-NODE-01", name: "Reservoir demo", location: "Simulation workspace" } as const;
export type DemoReadings = WaterReading & { flowRate: number };
export type DemoAlert = {
  id: string; parameter: string; title: string; message: string; level: "warning" | "critical";
  status: "active" | "resolved"; createdAt: string; resolvedAt?: string;
};
export type DemoHistory = DemoReadings & { timestamp: string; scenario: DemoScenario };
export type DemoEvent = { id: string; timestamp: string; type: string; message: string };
export type DemoState = {
  scenario: DemoScenario; readings: DemoReadings;
  response: { mode: "auto" | "manual" | "emergency"; pumpOn: boolean; emergencyLatched: boolean };
  alerts: DemoAlert[]; history: DemoHistory[]; events: DemoEvent[]; updatedAt: string; sequence: number;
};
export type DemoAction =
  | { type: "scenario"; scenario: DemoScenario; timestamp: string }
  | { type: "acknowledge"; timestamp: string }
  | { type: "mode"; mode: "auto" | "manual"; timestamp: string }
  | { type: "pump"; pumpOn: boolean; timestamp: string }
  | { type: "emergency"; timestamp: string }
  | { type: "reset"; timestamp: string };

export function initialDemoState(timestamp: string): DemoState {
  const readings = { ph: DEMO_SCENARIOS.normal.ph, tds: DEMO_SCENARIOS.normal.tds, turbidity: DEMO_SCENARIOS.normal.turbidity, flowRate: 1.5 };
  return {
    scenario: "normal", readings, response: { mode: "auto", pumpOn: false, emergencyLatched: false },
    alerts: [], history: [{ ...readings, scenario: "normal", timestamp }],
    events: [{ id: "event-0", timestamp, type: "Demo started", message: "Fixed example readings loaded. No physical control is connected." }],
    updatedAt: timestamp, sequence: 0,
  };
}

type Incident = { parameter: string; level: "warning" | "critical"; title: string; message: string };
function incidents(readings: DemoReadings, emergencyLatched: boolean): Incident[] {
  const channels: { parameter: string; value: number; unit: string; level: SafetyLevel }[] = [
    { parameter: "pH", value: readings.ph, unit: "", level: classifyPh(readings.ph) },
    { parameter: "TDS", value: readings.tds, unit: "ppm", level: classifyTds(readings.tds) },
    { parameter: "Turbidity", value: readings.turbidity, unit: "NTU", level: classifyTurbidity(readings.turbidity) },
    { parameter: "Flow", value: readings.flowRate, unit: "L/min", level: classifyFlow(readings.flowRate) },
  ];
  const result = channels.filter((channel) => channel.level !== "safe").map((channel): Incident => ({
    parameter: channel.parameter, level: channel.level as "warning" | "critical",
    title: `${channel.level === "critical" ? "Critical" : "Warning"} ${channel.parameter}`,
    message: `Example ${channel.parameter}: ${channel.value}${channel.unit ? ` ${channel.unit}` : ""}. Check the configured operational threshold.`,
  }));
  if (emergencyLatched) result.push({ parameter: "Controller", level: "critical", title: "Emergency stop latched", message: "The simulated pump is OFF. Load recovery readings, then acknowledge to resume Auto." });
  return result;
}

function updateAlerts(previous: DemoAlert[], active: Incident[], timestamp: string, sequence: number): DemoAlert[] {
  const next = previous.map((alert): DemoAlert => {
    if (alert.status !== "active") return alert;
    const incident = active.find((item) => item.parameter === alert.parameter && item.level === alert.level);
    return incident ? { ...alert, ...incident } : { ...alert, status: "resolved", resolvedAt: timestamp };
  });
  for (const incident of active) {
    const existing = next.find((alert) => alert.status === "active" && alert.parameter === incident.parameter && alert.level === incident.level);
    if (!existing) next.unshift({ ...incident, id: `alert-${sequence}-${incident.parameter}`, status: "active", createdAt: timestamp });
  }
  return next.slice(0, 80);
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  if (action.type === "reset") return initialDemoState(action.timestamp);
  const timestamp = action.timestamp;
  let scenario = state.scenario;
  let readings = state.readings;
  let response = state.response;
  let type = "";
  let message = "";
  if (action.type === "scenario") {
    scenario = action.scenario;
    const fixture = DEMO_SCENARIOS[scenario];
    readings = { ph: fixture.ph, tds: fixture.tds, turbidity: fixture.turbidity, flowRate: 1.5 };
    const next = demoResponse(readings, { emergency: state.response.emergencyLatched, pumpOn: state.response.pumpOn });
    response = next.emergency
      ? { mode: "emergency", pumpOn: false, emergencyLatched: true }
      : { ...response, pumpOn: response.mode === "auto" ? next.pumpOn : response.pumpOn };
    type = "Scenario applied";
    message = `${fixture.label.slice(4)} example loaded. Simulated pump ${response.pumpOn ? "ON" : "OFF"}${response.emergencyLatched ? "; emergency remains latched" : ""}.`;
  } else if (action.type === "acknowledge") {
    const next = demoResponse(readings, { emergency: response.emergencyLatched, pumpOn: response.pumpOn }, true);
    if (!response.emergencyLatched || next.emergency) return state;
    response = { mode: "auto", pumpOn: next.pumpOn, emergencyLatched: false };
    type = "Recovery acknowledged";
    message = "Operator acknowledgement cleared the simulated emergency latch and resumed Auto.";
  } else if (action.type === "mode") {
    if (response.emergencyLatched || response.mode === action.mode) return state;
    const next = demoResponse(readings, { emergency: false, pumpOn: response.pumpOn });
    response = { mode: action.mode, pumpOn: action.mode === "auto" ? next.pumpOn : false, emergencyLatched: false };
    type = "Mode changed";
    message = `${action.mode === "auto" ? "Auto" : "Manual"} selected. Simulated pump ${response.pumpOn ? "ON" : "OFF"}.`;
  } else if (action.type === "pump") {
    if (response.mode !== "manual" || response.emergencyLatched) return state;
    const next = demoResponse(readings, { emergency: false, pumpOn: response.pumpOn });
    if (action.pumpOn && next.emergency) return state;
    response = { ...response, pumpOn: action.pumpOn };
    type = "Manual command";
    message = `Simulated pump ${action.pumpOn ? "ON" : "OFF"} requested by operator.`;
  } else {
    response = { mode: "emergency", pumpOn: false, emergencyLatched: true };
    type = "Emergency stop";
    message = "Operator latched the simulated emergency stop.";
  }
  const sequence = state.sequence + 1;
  return {
    ...state, scenario, readings, response, sequence, updatedAt: timestamp,
    alerts: updateAlerts(state.alerts, incidents(readings, response.emergencyLatched), timestamp, sequence),
    history: action.type === "scenario" ? [...state.history, { ...readings, scenario, timestamp }].slice(-120) : state.history,
    events: [{ id: `event-${sequence}`, timestamp, type, message }, ...state.events].slice(0, 120),
  };
}
