// ─────────────────────────────────────────────────────────────────────────────
// DWMS Safety Engine — shared threshold classification and UI decisions.
// The browser and Convex backend use the same policy module so alerts and
// operator-facing decisions agree on what is safe, unsafe, or critical.
// ─────────────────────────────────────────────────────────────────────────────

import {
  MAX_FILTER_CAPACITY,
  THRESHOLDS,
  classifyFlow,
  classifyParam,
  classifyPh,
  classifyTds,
  classifyTurbidity,
} from "../../convex/safetyPolicy";
import type { ParamKey, SafetyLevel } from "../../convex/safetyPolicy";

export {
  MAX_FILTER_CAPACITY,
  THRESHOLDS,
  classifyFlow,
  classifyParam,
  classifyPh,
  classifyTds,
  classifyTurbidity,
};
export type { ParamKey, SafetyLevel } from "../../convex/safetyPolicy";

export type SystemMode = "auto" | "manual" | "emergency";
export type DataMode = "demo" | "hardware";

// ── Overall water quality ─────────────────────────────────────────────────────

export type Readings = {
  ph?: number | null;
  tds?: number | null;
  turbidity?: number | null;
  flowRate?: number | null;
};

export function overallQuality(r: Readings): SafetyLevel {
  const levels: SafetyLevel[] = [];
  if (r.ph != null) levels.push(classifyPh(r.ph));
  if (r.tds != null) levels.push(classifyTds(r.tds));
  if (r.turbidity != null) levels.push(classifyTurbidity(r.turbidity));
  if (r.flowRate != null) levels.push(classifyFlow(r.flowRate));
  if (levels.includes("critical")) return "critical";
  if (levels.includes("warning")) return "warning";
  return "safe";
}

// ── Safety decision (used by store + pop-ups + assistant) ─────────────────────

export type DecisionKind =
  | "none"
  | "advisory" // Level 1: slightly outside recommended range
  | "correction" // Level 2: unsafe but auto-correctable
  | "emergency"; // Level 3: critical, trigger shutdown

export type SafetyDecision = {
  kind: DecisionKind;
  parameter: string;
  riskLevel: SafetyLevel;
  reason: string;
  recommendation: string;
  /** For corrections — the value Ethm AI proposes/applies. */
  correctedValue?: number;
  /** True when filtration should auto-start (Auto mode only). */
  startFiltration?: boolean;
  /** True when the system must enter Emergency Shutdown. */
  emergency?: boolean;
};

/**
 * Evaluate the FULL current state against the rule book and return the single
 * most severe decision. Used continuously by the store so the same rules drive
 * the dashboard, pop-ups, and Ethm AI.
 */
export function evaluateState(r: Readings): SafetyDecision {
  const ph = r.ph ?? undefined;
  const tds = r.tds ?? undefined;
  const turb = r.turbidity ?? undefined;
  const flow = r.flowRate ?? undefined;

  // ── Level 3 — Emergency Shutdown conditions (highest priority) ──
  if (flow !== undefined && flow > THRESHOLDS.flowRate.critical.above) {
    return {
      kind: "emergency",
      parameter: "Flow Rate",
      riskLevel: "critical",
      reason: `Flow rate is ${flow.toFixed(2)} L/min, above the critical limit of ${THRESHOLDS.flowRate.critical.above} L/min.`,
      recommendation:
        "Pump stopped immediately to protect the system. Acknowledge to restart.",
      emergency: true,
    };
  }
  if (
    ph !== undefined &&
    (ph < THRESHOLDS.ph.critical.below || ph > THRESHOLDS.ph.critical.above)
  ) {
    return {
      kind: "emergency",
      parameter: "pH",
      riskLevel: "critical",
      reason: `pH is ${ph.toFixed(2)}, outside the critical safety band (${THRESHOLDS.ph.critical.below}–${THRESHOLDS.ph.critical.above}).`,
      recommendation:
        "Pump stopped to prevent corrosion or contamination. Acknowledge to restart.",
      emergency: true,
    };
  }
  if (
    turb !== undefined &&
    turb > THRESHOLDS.turbidity.critical.above &&
    flow !== undefined &&
    flow > MAX_FILTER_CAPACITY
  ) {
    return {
      kind: "emergency",
      parameter: "Turbidity",
      riskLevel: "critical",
      reason: `Turbidity is ${turb.toFixed(1)} NTU with flow ${flow.toFixed(2)} L/min — filter breach risk.`,
      recommendation:
        "Pump stopped to protect the filter media. Acknowledge to restart.",
      emergency: true,
    };
  }

  // ── Level 2 — Auto-correction (flow above filter capacity) ──
  if (
    flow !== undefined &&
    flow > MAX_FILTER_CAPACITY &&
    flow <= THRESHOLDS.flowRate.critical.above
  ) {
    return {
      kind: "correction",
      parameter: "Flow Rate",
      riskLevel: "warning",
      reason: `Flow rate ${flow.toFixed(2)} L/min exceeds the filter capacity of ${MAX_FILTER_CAPACITY} L/min.`,
      recommendation:
        "Ethm AI can reduce the flow rate to protect filter performance.",
      correctedValue: MAX_FILTER_CAPACITY,
    };
  }

  // ── Critical sensor levels that demand filtration in Auto ──
  if (tds !== undefined && tds > THRESHOLDS.tds.critical.above) {
    return {
      kind: "correction",
      parameter: "TDS",
      riskLevel: "critical",
      reason: `TDS is ${tds.toFixed(0)} ppm, above the critical limit of ${THRESHOLDS.tds.critical.above} ppm.`,
      recommendation:
        "Start filtration immediately to dilute dissolved solids.",
      startFiltration: true,
    };
  }
  if (turb !== undefined && turb > THRESHOLDS.turbidity.filtration.above) {
    return {
      kind: "correction",
      parameter: "Turbidity",
      riskLevel:
        turb > THRESHOLDS.turbidity.critical.above ? "critical" : "warning",
      reason: `Turbidity is ${turb.toFixed(1)} NTU, above the ${THRESHOLDS.turbidity.filtration.above} NTU filtration threshold.`,
      recommendation: "Start filtration to clear suspended particles.",
      startFiltration: true,
    };
  }

  // ── Level 1 — Advisory warnings ──
  if (flow !== undefined && classifyFlow(flow) === "warning") {
    return {
      kind: "advisory",
      parameter: "Flow Rate",
      riskLevel: "warning",
      reason: `Flow rate ${flow.toFixed(2)} L/min is above the recommended ${MAX_FILTER_CAPACITY} L/min.`,
      recommendation: "This setting may reduce filtration efficiency.",
      correctedValue: MAX_FILTER_CAPACITY,
    };
  }
  if (ph !== undefined && classifyPh(ph) === "warning") {
    return {
      kind: "advisory",
      parameter: "pH",
      riskLevel: "warning",
      reason: `pH is ${ph.toFixed(2)}, outside the optimal ${THRESHOLDS.ph.safe.min}–${THRESHOLDS.ph.safe.max} range.`,
      recommendation: "Consider adjusting chemical dosing to restore balance.",
    };
  }
  if (tds !== undefined && classifyTds(tds) === "warning") {
    return {
      kind: "advisory",
      parameter: "TDS",
      riskLevel: "warning",
      reason: `TDS is ${tds.toFixed(0)} ppm, above the recommended ${THRESHOLDS.tds.safe.max} ppm.`,
      recommendation: "Monitor closely and consider increasing filtration.",
    };
  }
  if (turb !== undefined && classifyTurbidity(turb) === "warning") {
    return {
      kind: "advisory",
      parameter: "Turbidity",
      riskLevel: "warning",
      reason: `Turbidity is ${turb.toFixed(1)} NTU, above the recommended ${THRESHOLDS.turbidity.safe.max} NTU.`,
      recommendation: "Monitor outlet clarity; a backwash may help.",
    };
  }

  return {
    kind: "none",
    parameter: "All Parameters",
    riskLevel: "safe",
    reason: "All parameters are within safe operating range.",
    recommendation: "No action required.",
  };
}

/**
 * Evaluate a single proposed value change (used for interactive pop-ups when
 * the operator drags a slider / sets flow rate). Returns the decision for that
 * one parameter only.
 */
export function evaluateChange(key: ParamKey, value: number): SafetyDecision {
  if (key === "flowRate") {
    if (value > THRESHOLDS.flowRate.critical.above) {
      return {
        kind: "emergency",
        parameter: "Flow Rate",
        riskLevel: "critical",
        reason: `Flow rate ${value.toFixed(2)} L/min exceeds the critical limit of ${THRESHOLDS.flowRate.critical.above} L/min.`,
        recommendation: "Emergency shutdown required to protect the system.",
        emergency: true,
      };
    }
    if (value > MAX_FILTER_CAPACITY) {
      return {
        kind: "correction",
        parameter: "Flow Rate",
        riskLevel: "warning",
        reason: `Flow rate ${value.toFixed(2)} L/min is above the filter capacity of ${MAX_FILTER_CAPACITY} L/min.`,
        recommendation:
          "Ethm AI can auto-correct the flow rate to protect filter performance.",
        correctedValue: MAX_FILTER_CAPACITY,
      };
    }
  }

  const level = classifyParam(key, value);
  const cfg = THRESHOLDS[key];
  if (level === "critical") {
    return {
      kind: "emergency",
      parameter: cfg.label,
      riskLevel: "critical",
      reason: `${cfg.label} value ${value} ${cfg.unit} is in the critical range.`,
      recommendation: "Emergency shutdown required.",
      emergency: true,
    };
  }
  if (level === "warning") {
    return {
      kind: "advisory",
      parameter: cfg.label,
      riskLevel: "warning",
      reason: `${cfg.label} value ${value} ${cfg.unit} is outside the recommended range.`,
      recommendation: "This setting may reduce filtration efficiency.",
    };
  }
  return {
    kind: "none",
    parameter: cfg.label,
    riskLevel: "safe",
    reason: `${cfg.label} value ${value} ${cfg.unit} is within the safe range.`,
    recommendation: "No action required.",
  };
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const LEVEL_COLOR: Record<SafetyLevel, string> = {
  safe: "#22c55e",
  warning: "#eab308",
  critical: "#ef4444",
};

export const LEVEL_LABEL: Record<SafetyLevel, string> = {
  safe: "SAFE",
  warning: "WARNING",
  critical: "CRITICAL",
};

export function riskLabel(level: SafetyLevel): string {
  return level === "critical" ? "High" : level === "warning" ? "Medium" : "Low";
}
