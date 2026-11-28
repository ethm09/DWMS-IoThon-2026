export type SafetyLevel = "safe" | "warning" | "critical";
export type ParamKey = "ph" | "tds" | "turbidity" | "flowRate";

/** Maximum flow the filter can safely handle (L/min). */
export const MAX_FILTER_CAPACITY = 2.0;

export const THRESHOLDS = {
  ph: {
    safe: { min: 6.5, max: 8.5 },
    warning: [
      { min: 5.5, max: 6.5 },
      { min: 8.5, max: 10.0 },
    ],
    critical: { below: 5.5, above: 10.0 },
    unit: "",
    label: "pH",
  },
  tds: {
    safe: { max: 500 },
    warning: { min: 500, max: 1500 },
    critical: { above: 1500 },
    unit: "ppm",
    label: "TDS",
  },
  turbidity: {
    safe: { max: 5 },
    warning: { min: 5, max: 50 },
    critical: { above: 50 },
    filtration: { above: 20 },
    unit: "NTU",
    label: "Turbidity",
  },
  flowRate: {
    safe: { min: 0.5, max: 2.0 },
    warning: { belowSafeMin: 0.5, aboveSafeMax: 2.0, max: 3.0 },
    critical: { above: 3.0 },
    unit: "L/min",
    label: "Flow Rate",
  },
} as const;

export function classifyPh(ph: number): SafetyLevel {
  if (ph < THRESHOLDS.ph.critical.below || ph > THRESHOLDS.ph.critical.above)
    return "critical";
  if (ph >= THRESHOLDS.ph.safe.min && ph <= THRESHOLDS.ph.safe.max)
    return "safe";
  return "warning";
}

export function classifyTds(tds: number): SafetyLevel {
  if (tds > THRESHOLDS.tds.critical.above) return "critical";
  if (tds < THRESHOLDS.tds.safe.max) return "safe";
  return "warning";
}

export function classifyTurbidity(turbidity: number): SafetyLevel {
  if (turbidity > THRESHOLDS.turbidity.critical.above) return "critical";
  if (turbidity < THRESHOLDS.turbidity.safe.max) return "safe";
  return "warning";
}

export function classifyFlow(flow: number): SafetyLevel {
  if (flow > THRESHOLDS.flowRate.critical.above) return "critical";
  if (
    flow >= THRESHOLDS.flowRate.safe.min &&
    flow <= THRESHOLDS.flowRate.safe.max
  )
    return "safe";
  return "warning";
}

export function classifyParam(key: ParamKey, value: number): SafetyLevel {
  switch (key) {
    case "ph":
      return classifyPh(value);
    case "tds":
      return classifyTds(value);
    case "turbidity":
      return classifyTurbidity(value);
    case "flowRate":
      return classifyFlow(value);
  }
}

/** Receipt-age policy; no acquisition timestamp is currently transmitted. */
export const SENSOR_FRESHNESS_MS = 10_000;

export type SensorValues = { ph: number; tds: number; turbidity: number };

/** Reject partial/disconnected, nonnumeric and physically invalid input. */
export function isValidSensorValues(value: unknown): value is SensorValues {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const reading = value as Record<string, unknown>;
  return (
    typeof reading.ph === "number" &&
    Number.isFinite(reading.ph) &&
    reading.ph >= 0 &&
    reading.ph <= 14 &&
    typeof reading.tds === "number" &&
    Number.isFinite(reading.tds) &&
    reading.tds >= 0 &&
    typeof reading.turbidity === "number" &&
    Number.isFinite(reading.turbidity) &&
    reading.turbidity >= 0
  );
}

export function isFreshTimestamp(
  timestamp: string | undefined,
  now = Date.now(),
): boolean {
  const age = timestamp === undefined ? NaN : now - Date.parse(timestamp);
  return Number.isFinite(age) && age >= 0 && age <= SENSOR_FRESHNESS_MS;
}

/** Prototype response only; pumping does not establish treatment effectiveness. */
export function automaticPumpTarget(reading: SensorValues): {
  mode: "auto" | "emergency";
  pumpOn: boolean;
} {
  if (
    !isValidSensorValues(reading) ||
    classifyPh(reading.ph) === "critical" ||
    classifyTurbidity(reading.turbidity) === "critical"
  ) {
    return { mode: "emergency", pumpOn: false };
  }
  return {
    mode: "auto",
    pumpOn:
      reading.tds > THRESHOLDS.tds.critical.above ||
      reading.turbidity > THRESHOLDS.turbidity.filtration.above,
  };
}
