import {
  THRESHOLDS,
  classifyPh,
  classifyTds,
  classifyTurbidity,
  type SafetyLevel,
} from "./safetyPolicy";

export type AgentReading = {
  ph: number;
  tds: number;
  turbidity: number;
  timestamp: string;
};

const severity: Record<SafetyLevel, number> = {
  safe: 0,
  warning: 1,
  critical: 2,
};

export function analyzeWaterQuality(reading: AgentReading | null) {
  if (!reading) {
    return {
      available: false,
      overall: "unknown" as const,
      parameters: [],
      summary: "No sensor reading is stored for this device.",
    };
  }

  const parameters = [
    { key: "ph", label: "pH", value: reading.ph, unit: "", level: classifyPh(reading.ph) },
    { key: "tds", label: "TDS", value: reading.tds, unit: "ppm", level: classifyTds(reading.tds) },
    {
      key: "turbidity",
      label: "Turbidity",
      value: reading.turbidity,
      unit: "NTU",
      level: classifyTurbidity(reading.turbidity),
    },
  ];
  const overall = parameters.reduce<SafetyLevel>(
    (worst, parameter) =>
      severity[parameter.level] > severity[worst] ? parameter.level : worst,
    "safe",
  );
  const outOfRange = parameters.filter((parameter) => parameter.level !== "safe");
  const summary = outOfRange.length
    ? `${outOfRange.length} of 3 measured parameters are outside the configured safe range.`
    : "All three measured parameters are within the configured safe ranges.";

  return { available: true, overall, parameters, summary, timestamp: reading.timestamp };
}

export function evaluateSafetyState(reading: AgentReading | null) {
  if (!reading) {
    return {
      available: false,
      state: "unknown" as const,
      reason: "No persisted sensor reading is available for safety evaluation.",
      pumpStartAllowed: false,
      automaticFiltrationRequested: false,
    };
  }

  const phLevel = classifyPh(reading.ph);
  const tdsLevel = classifyTds(reading.tds);
  const turbidityLevel = classifyTurbidity(reading.turbidity);
  const pumpStartAllowed = phLevel !== "critical" && turbidityLevel !== "critical";
  const automaticFiltrationRequested =
    reading.tds > THRESHOLDS.tds.critical.above ||
    reading.turbidity > THRESHOLDS.turbidity.filtration.above;
  const levels = [phLevel, tdsLevel, turbidityLevel];
  const state = levels.reduce<SafetyLevel>(
    (worst, level) => (severity[level] > severity[worst] ? level : worst),
    "safe",
  );

  return {
    available: true,
    state,
    reason: pumpStartAllowed
      ? "The backend pump-start interlock is clear for the current pH and turbidity values."
      : "The backend interlock blocks pump start while pH or turbidity is critical.",
    pumpStartAllowed,
    automaticFiltrationRequested,
    automaticFiltrationRules: {
      tdsAbovePpm: THRESHOLDS.tds.critical.above,
      turbidityAboveNtu: THRESHOLDS.turbidity.filtration.above,
      source: "convex/devices.ts automatic control policy",
    },
    parameters: [
      { key: "ph", value: reading.ph, level: phLevel },
      { key: "tds", value: reading.tds, level: tdsLevel },
      { key: "turbidity", value: reading.turbidity, level: turbidityLevel },
    ],
    limitations: [
      "No flow-rate value is stored by the hardware ingestion schema.",
      "The tool reports sensor/interlock state; it does not actuate the pump.",
    ],
    timestamp: reading.timestamp,
  };
}

export function analyzeSensorTrends(readings: AgentReading[]) {
  const ordered = [...readings].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  );
  if (ordered.length < 3) {
    return {
      available: false,
      count: ordered.length,
      summary: "At least three persisted readings are needed to estimate a trend.",
      trends: [],
    };
  }

  const first = ordered[0];
  const latest = ordered[ordered.length - 1];
  const trends = ([
    { key: "ph", unit: "", noiseFloor: 0.2 },
    { key: "tds", unit: "ppm", noiseFloor: Math.max(1, Math.abs(first.tds) * 0.05) },
    {
      key: "turbidity",
      unit: "NTU",
      noiseFloor: Math.max(0.25, Math.abs(first.turbidity) * 0.05),
    },
  ] as const).map(({ key, unit, noiseFloor }) => {
    const start = first[key];
    const end = latest[key];
    const delta = end - start;
    const direction =
      Math.abs(delta) < noiseFloor ? "stable" : delta > 0 ? "increasing" : "decreasing";
    return { key, direction, start, latest: end, delta, unit, observations: ordered.length };
  });

  const changes = trends.filter((trend) => trend.direction !== "stable");
  const summary = changes.length
    ? `Measured changes across ${ordered.length} readings: ${changes.map((trend) => `${trend.key} ${trend.direction}`).join(", ")}.`
    : `No change exceeded the configured trend noise floor across ${ordered.length} readings.`;
  return {
    available: true,
    count: ordered.length,
    from: first.timestamp,
    through: latest.timestamp,
    trends,
    summary,
  };
}
