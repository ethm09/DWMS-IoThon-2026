import { DEMO_SCENARIOS, demoResponse, type DemoScenario } from "../src/lib/monitoring";
import { DEMO_DEVICE, demoReducer, initialDemoState } from "../src/lib/demo-state";

export const DEMO_AI_LIMITS = {
  sessionTtlMs: 30 * 60_000,
  sessionTurns: 6,
  sessionTokens: 60_000,
  globalTokens: 250_000,
  globalRequests: 60,
  globalSessions: 40,
  requestsPerMinute: 10,
  sessionsPerMinute: 6,
  requestIntervalMs: 5_000,
  requestLeaseMs: 60_000,
  bodyBytes: 8192,
  questionCharacters: 600,
  historySamples: 12,
  promptBytes: 28_000,
  completionTokens: 1200,
} as const;

export class DemoAiError extends Error {
  constructor(public code: string, message: string, public status = 400, public retryAfterSeconds?: number) {
    super(message);
  }
}

export function demoAiConfiguration(env: Record<string, string | undefined> = process.env) {
  const requested = Number(env.DWMS_DEMO_AI_TOKEN_BUDGET ?? 0);
  return {
    enabled: env.DWMS_DEMO_AI_ENABLED === "true" && Number.isSafeInteger(requested) && requested > 0,
    // Lifetime reservation cap, never reset by an elapsed time bucket or session.
    tokenBudget: Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, DEMO_AI_LIMITS.globalTokens) : 0,
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DemoAiError("DEMO_AI_BAD_REQUEST", "Use a valid Demo request.");
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new DemoAiError("DEMO_AI_INVALID_CONTEXT", "Only the official demonstration context is accepted.");
}
function scenario(value: unknown): DemoScenario {
  if (typeof value !== "string" || !Object.prototype.hasOwnProperty.call(DEMO_SCENARIOS, value)) throw new DemoAiError("DEMO_AI_INVALID_CONTEXT", "Select an available demonstration scenario.");
  return value as DemoScenario;
}

/** Reconstruct readings from official fixtures, never accept browser sensor numbers. */
export function canonicalDemoContext(value: unknown, now = Date.now()) {
  const input = object(value);
  exactKeys(input, ["scenario", "mode", "pumpOn", "emergencyLatched", "history"]);
  const currentScenario = scenario(input.scenario);
  if (typeof input.mode !== "string" || !["auto", "manual", "emergency"].includes(input.mode) || typeof input.pumpOn !== "boolean" || typeof input.emergencyLatched !== "boolean") {
    throw new DemoAiError("DEMO_AI_INVALID_CONTEXT", "Use a valid demonstration control state.");
  }
  if (!Array.isArray(input.history) || input.history.length < 1 || input.history.length > DEMO_AI_LIMITS.historySamples) throw new DemoAiError("DEMO_AI_INVALID_CONTEXT", "Use the bounded demonstration history.");
  let previousTime = -Infinity;
  const history = input.history.map(item => {
    const row = object(item); exactKeys(row, ["scenario", "timestamp"]);
    const name = scenario(row.scenario);
    const time = typeof row.timestamp === "string" && row.timestamp.length <= 40 ? Date.parse(row.timestamp) : NaN;
    if (!Number.isFinite(time) || time < previousTime || time > now || time < now - 24 * 60 * 60_000) throw new DemoAiError("DEMO_AI_INVALID_CONTEXT", "Reset the demonstration to provide a current scenario history.");
    previousTime = time;
    return { scenario: name, timestamp: new Date(time).toISOString() };
  });
  if (history[history.length - 1]?.scenario !== currentScenario) throw new DemoAiError("DEMO_AI_INVALID_CONTEXT", "Refresh the demonstration context before asking Ethm.");
  const fixture = DEMO_SCENARIOS[currentScenario];
  const configured = demoResponse(fixture, { emergency: false, pumpOn: false });
  if (
    (configured.emergency && !input.emergencyLatched) ||
    (input.emergencyLatched && (input.mode !== "emergency" || input.pumpOn)) ||
    (!input.emergencyLatched && input.mode === "emergency") ||
    (!input.emergencyLatched && input.mode === "auto" && input.pumpOn !== configured.pumpOn)
  ) throw new DemoAiError("DEMO_AI_INVALID_CONTEXT", "The scenario and simulated response must agree.");
  let state = initialDemoState(history[0].timestamp);
  for (const entry of history) state = demoReducer(state, { type: "scenario", ...entry });
  const at = history[history.length - 1]!.timestamp;
  if (!input.emergencyLatched && state.response.emergencyLatched) state = demoReducer(state, { type: "acknowledge", timestamp: at });
  if (input.emergencyLatched && !state.response.emergencyLatched) state = demoReducer(state, { type: "emergency", timestamp: at });
  if (!input.emergencyLatched && input.mode !== state.response.mode) state = demoReducer(state, { type: "mode", mode: input.mode as "auto" | "manual", timestamp: at });
  if (!input.emergencyLatched && input.mode === "manual" && input.pumpOn !== state.response.pumpOn) state = demoReducer(state, { type: "pump", pumpOn: input.pumpOn, timestamp: at });
  return {
    workspace: "DEMO" as const, dataBasis: "SIMULATED" as const,
    device: DEMO_DEVICE, scenario: currentScenario, contextAsOf: at,
    readings: state.readings,
    response: { ...state.response, physicalEquipmentConnected: false },
    activeAlerts: state.alerts.filter(alert => alert.status === "active").map(alert => ({ parameter: alert.parameter, level: alert.level, title: alert.title })),
    history: history.map(row => { const values = DEMO_SCENARIOS[row.scenario]; return { ...row, ph: values.ph, tds: values.tds, turbidity: values.turbidity, flowRate: 1.5 }; }),
    freshness: { ageMs: Math.max(0, now - Date.parse(at)), basis: "browser simulation timestamp; not a physical sensor acquisition" },
  };
}

export function validateDemoQuestion(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > DEMO_AI_LIMITS.questionCharacters) throw new DemoAiError("DEMO_AI_BAD_REQUEST", "Ask a question of 1–600 characters.");
  return value.trim();
}

/** Includes UTF-8 bytes and deliberately generous chat framing; no cached-token discount. */
export function reservedPromptTokens(messages: readonly { role: string; content: string }[]) {
  const bytes = new TextEncoder().encode(JSON.stringify(messages)).byteLength;
  if (bytes > DEMO_AI_LIMITS.promptBytes) throw new DemoAiError("DEMO_AI_CONTEXT_LIMIT", "This context is too large. Reset the demonstration and try a shorter question.");
  return bytes + 1024 + messages.length * 32 + DEMO_AI_LIMITS.completionTokens;
}

export const DEMO_AI_ORIGIN = "https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site";
export function demoOriginAllowed(origin: string | null) { return origin === DEMO_AI_ORIGIN; }
