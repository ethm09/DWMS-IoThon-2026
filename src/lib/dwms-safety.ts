// ─────────────────────────────────────────────────────────────────────────────
// DWMS Safety Engine — single source of truth for all thresholds and decisions.
// The persistent store, the Ethm AI assistant, and the interactive pop-ups all
// import from here so they ALWAYS agree on what is safe, unsafe, or critical.
// ─────────────────────────────────────────────────────────────────────────────

export type SystemMode = "auto" | "manual" | "emergency";
export type DataMode = "demo" | "hardware";
export type SafetyLevel = "safe" | "warning" | "critical";
export type ParamKey = "ph" | "tds" | "turbidity" | "flowRate";

/** Maximum flow the filter can safely handle (L/min). */
export const MAX_FILTER_CAPACITY = 2.0;

// ── Thresholds (demo values from the DWMS spec) ───────────────────────────────

export const THRESHOLDS = {
  ph: {
    safe: { min: 6.5, max: 8.5 },
    warning: [
      { min: 6.0, max: 6.4 },
      { min: 8.6, max: 9.0 },
    ],
    critical: { below: 5.5, above: 10.0 },
    unit: "",
    label: "pH",
  },
  tds: {
    safe: { max: 500 },
    warning: { min: 500, max: 1000 },
    critical: { above: 1500 },
    unit: "ppm",
    label: "TDS",
  },
  turbidity: {
    safe: { max: 5 },
    warning: { min: 5, max: 20 },
    critical: { above: 50 },
    unit: "NTU",
    label: "Turbidity",
  },
  flowRate: {
    safe: { min: 0.5, max: 2.0 },
    warning: { min: 2.1, max: 3.0 },
    critical: { above: 3.0 },
    unit: "L/min",
    label: "Flow Rate",
  },
} as const;

// ── Per-parameter classification ──────────────────────────────────────────────

export function classifyPh(ph: number): SafetyLevel {
  if (ph < 5.5 || ph > 10.0) return "critical";
  if (ph >= 6.5 && ph <= 8.5) return "safe";
  return "warning";
}

export function classifyTds(tds: number): SafetyLevel {
  if (tds > 1500) return "critical";
  if (tds < 500) return "safe";
  return "warning";
}

export function classifyTurbidity(turbidity: number): SafetyLevel {
  if (turbidity > 50) return "critical";
  if (turbidity < 5) return "safe";
  return "warning";
}

export function classifyFlow(flow: number): SafetyLevel {
  if (flow > 3.0) return "critical";
  if (flow >= 0.5 && flow <= 2.0) return "safe";
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
  if (flow !== undefined && flow > 3.0) {
    return {
      kind: "emergency",
      parameter: "Flow Rate",
      riskLevel: "critical",
      reason: `Flow rate is ${flow.toFixed(2)} L/min, above the critical limit of 3.0 L/min.`,
      recommendation: "Pump stopped immediately to protect the system. Acknowledge to restart.",
      emergency: true,
    };
  }
  if (ph !== undefined && (ph < 5.5 || ph > 10.0)) {
    return {
      kind: "emergency",
      parameter: "pH",
      riskLevel: "critical",
      reason: `pH is ${ph.toFixed(2)}, outside the critical safety band (5.5–10.0).`,
      recommendation: "Pump stopped to prevent corrosion or contamination. Acknowledge to restart.",
      emergency: true,
    };
  }
  if (turb !== undefined && turb > 50 && flow !== undefined && flow > 2.0) {
    return {
      kind: "emergency",
      parameter: "Turbidity",
      riskLevel: "critical",
      reason: `Turbidity is ${turb.toFixed(1)} NTU with flow ${flow.toFixed(2)} L/min — filter breach risk.`,
      recommendation: "Pump stopped to protect the filter media. Acknowledge to restart.",
      emergency: true,
    };
  }

  // ── Level 2 — Auto-correction (flow above filter capacity) ──
  if (flow !== undefined && flow > MAX_FILTER_CAPACITY && flow <= 3.0) {
    return {
      kind: "correction",
      parameter: "Flow Rate",
      riskLevel: "warning",
      reason: `Flow rate ${flow.toFixed(2)} L/min exceeds the filter capacity of ${MAX_FILTER_CAPACITY} L/min.`,
      recommendation: "Ethm AI can reduce the flow rate to protect filter performance.",
      correctedValue: MAX_FILTER_CAPACITY,
    };
  }

  // ── Critical sensor levels that demand filtration in Auto ──
  if (tds !== undefined && tds > 1500) {
    return {
      kind: "correction",
      parameter: "TDS",
      riskLevel: "critical",
      reason: `TDS is ${tds.toFixed(0)} ppm, above the critical limit of 1500 ppm.`,
      recommendation: "Start filtration immediately to dilute dissolved solids.",
      startFiltration: true,
    };
  }
  if (turb !== undefined && turb > 20) {
    return {
      kind: "correction",
      parameter: "Turbidity",
      riskLevel: turb > 50 ? "critical" : "warning",
      reason: `Turbidity is ${turb.toFixed(1)} NTU, above the 20 NTU action threshold.`,
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
      reason: `Flow rate ${flow.toFixed(2)} L/min is above the recommended 2.0 L/min.`,
      recommendation: "This setting may reduce filtration efficiency.",
      correctedValue: MAX_FILTER_CAPACITY,
    };
  }
  if (ph !== undefined && classifyPh(ph) === "warning") {
    return {
      kind: "advisory",
      parameter: "pH",
      riskLevel: "warning",
      reason: `pH is ${ph.toFixed(2)}, outside the optimal 6.5–8.5 range.`,
      recommendation: "Consider adjusting chemical dosing to restore balance.",
    };
  }
  if (tds !== undefined && classifyTds(tds) === "warning") {
    return {
      kind: "advisory",
      parameter: "TDS",
      riskLevel: "warning",
      reason: `TDS is ${tds.toFixed(0)} ppm, above the recommended 500 ppm.`,
      recommendation: "Monitor closely and consider increasing filtration.",
    };
  }
  if (turb !== undefined && classifyTurbidity(turb) === "warning") {
    return {
      kind: "advisory",
      parameter: "Turbidity",
      riskLevel: "warning",
      reason: `Turbidity is ${turb.toFixed(1)} NTU, above the recommended 5 NTU.`,
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
    if (value > 3.0) {
      return {
        kind: "emergency",
        parameter: "Flow Rate",
        riskLevel: "critical",
        reason: `Flow rate ${value.toFixed(2)} L/min exceeds the critical limit of 3.0 L/min.`,
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
        recommendation: "Ethm AI can auto-correct the flow rate to protect filter performance.",
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
