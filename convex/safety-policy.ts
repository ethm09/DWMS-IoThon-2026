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
  if (ph < THRESHOLDS.ph.critical.below || ph > THRESHOLDS.ph.critical.above) return "critical";
  if (ph >= THRESHOLDS.ph.safe.min && ph <= THRESHOLDS.ph.safe.max) return "safe";
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
  if (flow >= THRESHOLDS.flowRate.safe.min && flow <= THRESHOLDS.flowRate.safe.max) return "safe";
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
