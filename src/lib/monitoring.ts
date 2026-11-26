import { classifyPh, classifyTds, classifyTurbidity, THRESHOLDS, type SafetyLevel } from "../../convex/safetyPolicy";

export type WaterReading = { ph: number; tds: number; turbidity: number };
export type ReadingFreshness = "fresh" | "stale" | "offline" | "missing" | "invalid";

/** Receipt freshness is distinct from water quality and does not attest probe calibration. */
export function readingFreshness(timestamp: string | null | undefined, now: number): ReadingFreshness {
  if (!timestamp) return "missing";
  const age = now - Date.parse(timestamp);
  if (!Number.isFinite(age) || age < 0) return "invalid";
  if (age > 30_000) return "offline";
  if (age > 10_000) return "stale";
  return "fresh";
}

export function validWaterReading(reading: WaterReading | null | undefined): reading is WaterReading {
  return !!reading && Number.isFinite(reading.ph) && reading.ph >= 0 && reading.ph <= 14
    && Number.isFinite(reading.tds) && reading.tds >= 0
    && Number.isFinite(reading.turbidity) && reading.turbidity >= 0;
}

export function waterQuality(reading: WaterReading | null | undefined, freshness: ReadingFreshness): SafetyLevel | "unknown" {
  if (freshness !== "fresh" || !validWaterReading(reading)) return "unknown";
  const levels = [classifyPh(reading.ph), classifyTds(reading.tds), classifyTurbidity(reading.turbidity)];
  return levels.includes("critical") ? "critical" : levels.includes("warning") ? "warning" : "safe";
}

export const DEMO_SCENARIOS = {
  normal: { label: "1 · Normal", ph: 7.2, tds: 300, turbidity: 2 },
  warning: { label: "2 · Warning", ph: 7.2, tds: 650, turbidity: 8 },
  filtration: { label: "3 · Response", ph: 7.2, tds: 300, turbidity: 25 },
  critical: { label: "4 · Critical", ph: 4.5, tds: 300, turbidity: 2 },
  recovery: { label: "5 · Recovery", ph: 7.2, tds: 300, turbidity: 2 },
} as const;
export type DemoScenario = keyof typeof DEMO_SCENARIOS;
export type DemoControl = { emergency: boolean; pumpOn: boolean };

/** Mirrors the prototype's auto rule ordering; this state never reaches hardware. */
export function demoResponse(reading: WaterReading, previous: DemoControl, acknowledge = false): DemoControl {
  const critical = !validWaterReading(reading) || classifyPh(reading.ph) === "critical" || classifyTurbidity(reading.turbidity) === "critical";
  if (critical || (previous.emergency && !acknowledge)) return { emergency: true, pumpOn: false };
  return {
    emergency: false,
    pumpOn: reading.tds > THRESHOLDS.tds.critical.above || reading.turbidity > THRESHOLDS.turbidity.filtration.above,
  };
}
