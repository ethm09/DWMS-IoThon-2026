import { useState, useCallback } from "react";
import { motion } from "motion/react";
import {
  Droplets, ArrowDown, ArrowUp, Minus, Camera, RotateCcw,
  TrendingUp, Activity, Filter, Clock, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProcessMode, type Readings } from "@/hooks/use-process-mode.ts";
import {
  classifyTds, classifyTurbidity, classifyPh,
  LEVEL_COLOR, LEVEL_LABEL, type SafetyLevel,
} from "@/lib/dwms-safety.ts";

type FiltrationSnapshot = {
  ph: number | null;
  tds: number | null;
  turbidity: number | null;
  capturedAt: string;
};

type ComparisonStatus = "improved" | "unchanged" | "degraded";

type ComparisonRow = {
  parameter: string;
  unit: string;
  before: number | null;
  after: number | null;
  improvement: number | null;
  status: ComparisonStatus;
  beforeLevel: SafetyLevel;
  afterLevel: SafetyLevel;
};

function getStatus(before: number | null, after: number | null, lowerIsBetter: boolean): ComparisonStatus {
  if (before === null || after === null) return "unchanged";
  const diff = after - before;
  const threshold = Math.abs(before) * 0.02; // 2% tolerance
  if (Math.abs(diff) <= threshold) return "unchanged";
  if (lowerIsBetter) return diff < 0 ? "improved" : "degraded";
  return diff > 0 ? "improved" : "degraded";
}

function getPhStatus(before: number | null, after: number | null): ComparisonStatus {
  if (before === null || after === null) return "unchanged";
  // pH is optimal at 7.0, closer to 7 is better
  const beforeDist = Math.abs(before - 7);
  const afterDist = Math.abs(after - 7);
  const threshold = 0.1;
  if (Math.abs(afterDist - beforeDist) <= threshold) return "unchanged";
  return afterDist < beforeDist ? "improved" : "degraded";
}

function getImprovement(before: number | null, after: number | null, lowerIsBetter: boolean): number | null {
  if (before === null || after === null || before === 0) return null;
  const diff = before - after;
  const pct = (diff / Math.abs(before)) * 100;
  return lowerIsBetter ? pct : -pct;
}

function getPhImprovement(before: number | null, after: number | null): number | null {
  if (before === null || after === null) return null;
  const beforeDist = Math.abs(before - 7);
  const afterDist = Math.abs(after - 7);
  if (beforeDist === 0) return afterDist === 0 ? 0 : -100;
  return ((beforeDist - afterDist) / beforeDist) * 100;
}

const STATUS_CONFIG = {
  improved: { color: "#22c55e", icon: ArrowUp, label: "IMPROVED", bg: "#22c55e" },
  unchanged: { color: "#6b7280", icon: Minus, label: "UNCHANGED", bg: "#6b7280" },
  degraded: { color: "#ef4444", icon: ArrowDown, label: "DEGRADED", bg: "#ef4444" },
} as const;

function StatusBadge({ status }: { status: ComparisonStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest"
      style={{ color: cfg.color, background: `${cfg.bg}15`, border: `1px solid ${cfg.bg}33` }}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </div>
  );
}

function ParameterCard({ row }: { row: ComparisonRow }) {
  const statusCfg = STATUS_CONFIG[row.status];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-4 space-y-3"
      style={{ borderColor: `${statusCfg.color}33`, background: `${statusCfg.color}05` }}
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold tracking-widest text-foreground">{row.parameter}</div>
        <StatusBadge status={row.status} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Before */}
        <div className="text-center">
          <div className="text-[9px] font-bold tracking-widest text-muted-foreground mb-1">BEFORE</div>
          <div className="font-mono text-lg font-bold" style={{ color: LEVEL_COLOR[row.beforeLevel] }}>
            {row.before !== null ? row.before.toFixed(1) : "—"}
          </div>
          <div className="text-[8px] tracking-widest text-muted-foreground">{row.unit}</div>
          <div
            className="text-[8px] font-bold mt-1 px-1.5 py-0.5 rounded-full inline-block"
            style={{ color: LEVEL_COLOR[row.beforeLevel], background: `${LEVEL_COLOR[row.beforeLevel]}15` }}
          >
            {LEVEL_LABEL[row.beforeLevel]}
          </div>
        </div>

        {/* Arrow + Improvement */}
        <div className="flex flex-col items-center justify-center">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center mb-1"
            style={{ background: `${statusCfg.color}18` }}
          >
            <TrendingUp className="w-4 h-4" style={{ color: statusCfg.color }} />
          </div>
          {row.improvement !== null && (
            <div className="font-mono text-sm font-bold" style={{ color: statusCfg.color }}>
              {row.improvement > 0 ? "+" : ""}{row.improvement.toFixed(1)}%
            </div>
          )}
        </div>

        {/* After */}
        <div className="text-center">
          <div className="text-[9px] font-bold tracking-widest text-muted-foreground mb-1">AFTER</div>
          <div className="font-mono text-lg font-bold" style={{ color: LEVEL_COLOR[row.afterLevel] }}>
            {row.after !== null ? row.after.toFixed(1) : "—"}
          </div>
          <div className="text-[8px] tracking-widest text-muted-foreground">{row.unit}</div>
          <div
            className="text-[8px] font-bold mt-1 px-1.5 py-0.5 rounded-full inline-block"
            style={{ color: LEVEL_COLOR[row.afterLevel], background: `${LEVEL_COLOR[row.afterLevel]}15` }}
          >
            {LEVEL_LABEL[row.afterLevel]}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SummaryPanel({ rows }: { rows: ComparisonRow[] }) {
  const improved = rows.filter((r) => r.status === "improved").length;
  const degraded = rows.filter((r) => r.status === "degraded").length;
  const unchanged = rows.filter((r) => r.status === "unchanged").length;

  const avgImprovement = rows
    .map((r) => r.improvement)
    .filter((v): v is number => v !== null);
  const avg = avgImprovement.length > 0
    ? avgImprovement.reduce((a, b) => a + b, 0) / avgImprovement.length
    : 0;

  const overallStatus: ComparisonStatus =
    improved > degraded ? "improved" : degraded > improved ? "degraded" : "unchanged";
  const overallColor = STATUS_CONFIG[overallStatus].color;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
          <Activity className="w-4 h-4" /> FILTRATION PERFORMANCE SUMMARY
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3 text-center" style={{ borderColor: `${overallColor}44`, background: `${overallColor}08` }}>
            <div className="text-[9px] font-bold tracking-widest text-muted-foreground">OVERALL</div>
            <div className="font-mono text-xl font-bold mt-1" style={{ color: overallColor }}>
              {avg > 0 ? "+" : ""}{avg.toFixed(1)}%
            </div>
          </div>
          <div className="rounded-lg border p-3 text-center" style={{ borderColor: "#22c55e44", background: "#22c55e08" }}>
            <div className="text-[9px] font-bold tracking-widest text-muted-foreground">IMPROVED</div>
            <div className="font-mono text-xl font-bold mt-1 text-green-500">{improved}</div>
          </div>
          <div className="rounded-lg border p-3 text-center" style={{ borderColor: "#6b728044", background: "#6b728008" }}>
            <div className="text-[9px] font-bold tracking-widest text-muted-foreground">UNCHANGED</div>
            <div className="font-mono text-xl font-bold mt-1 text-gray-500">{unchanged}</div>
          </div>
          <div className="rounded-lg border p-3 text-center" style={{ borderColor: "#ef444444", background: "#ef444408" }}>
            <div className="text-[9px] font-bold tracking-widest text-muted-foreground">DEGRADED</div>
            <div className="font-mono text-xl font-bold mt-1 text-red-500">{degraded}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FiltrationComparison() {
  const { readings, filterStatus, pumpStatus } = useProcessMode();

  const [preFiltration, setPreFiltration] = useState<FiltrationSnapshot | null>(null);
  const [postFiltration, setPostFiltration] = useState<FiltrationSnapshot | null>(null);

  const capturePreFiltration = useCallback(() => {
    setPreFiltration({
      ph: readings.ph,
      tds: readings.tds,
      turbidity: readings.turbidity,
      capturedAt: new Date().toISOString(),
    });
  }, [readings]);

  const capturePostFiltration = useCallback(() => {
    setPostFiltration({
      ph: readings.ph,
      tds: readings.tds,
      turbidity: readings.turbidity,
      capturedAt: new Date().toISOString(),
    });
  }, [readings]);

  const resetComparison = useCallback(() => {
    setPreFiltration(null);
    setPostFiltration(null);
  }, []);

  // Build comparison rows
  const buildRows = (): ComparisonRow[] => {
    const before = preFiltration;
    const after = postFiltration ?? {
      ph: readings.ph,
      tds: readings.tds,
      turbidity: readings.turbidity,
      capturedAt: new Date().toISOString(),
    };

    if (!before) return [];

    return [
      {
        parameter: "TDS (Total Dissolved Solids)",
        unit: "ppm",
        before: before.tds,
        after: after.tds,
        improvement: getImprovement(before.tds, after.tds, true),
        status: getStatus(before.tds, after.tds, true),
        beforeLevel: classifyTds(before.tds ?? 0),
        afterLevel: classifyTds(after.tds ?? 0),
      },
      {
        parameter: "Turbidity",
        unit: "NTU",
        before: before.turbidity,
        after: after.turbidity,
        improvement: getImprovement(before.turbidity, after.turbidity, true),
        status: getStatus(before.turbidity, after.turbidity, true),
        beforeLevel: classifyTurbidity(before.turbidity ?? 0),
        afterLevel: classifyTurbidity(after.turbidity ?? 0),
      },
      {
        parameter: "pH Level",
        unit: "pH",
        before: before.ph,
        after: after.ph,
        improvement: getPhImprovement(before.ph, after.ph),
        status: getPhStatus(before.ph, after.ph),
        beforeLevel: classifyPh(before.ph ?? 7),
        afterLevel: classifyPh(after.ph ?? 7),
      },
    ];
  };

  const rows = buildRows();
  const hasComparison = preFiltration !== null;
  const isFilterActive = filterStatus || pumpStatus;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-widest text-primary uppercase flex items-center gap-2">
            <Filter className="w-5 h-5" /> Filtration Comparison
          </h2>
          <p className="text-xs text-muted-foreground tracking-wider mt-0.5">
            Before vs after filtration analysis — pH, TDS, turbidity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-bold tracking-widest"
            style={{
              color: isFilterActive ? "#22c55e" : "#6b7280",
              borderColor: isFilterActive ? "#22c55e44" : "#6b728044",
              background: isFilterActive ? "#22c55e0d" : "#6b72800d",
            }}
          >
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: isFilterActive ? "#22c55e" : "#6b7280" }}
              animate={isFilterActive ? { opacity: [1, 0.3, 1] } : { opacity: 0.5 }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            FILTER {isFilterActive ? "ACTIVE" : "INACTIVE"}
          </div>
        </div>
      </div>

      {/* Capture Controls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
            <Camera className="w-4 h-4" /> CAPTURE READINGS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pre-Filtration Capture */}
            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "oklch(0.26 0.04 145)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-bold tracking-widest text-muted-foreground">STEP 1</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">Pre-Filtration Snapshot</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Capture readings before starting filtration
                  </div>
                </div>
                {preFiltration && (
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                )}
              </div>

              {preFiltration && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <div className="text-[8px] tracking-widest text-muted-foreground">pH</div>
                    <div className="font-mono text-sm font-bold text-foreground">
                      {preFiltration.ph?.toFixed(2) ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <div className="text-[8px] tracking-widest text-muted-foreground">TDS</div>
                    <div className="font-mono text-sm font-bold text-foreground">
                      {preFiltration.tds?.toFixed(0) ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <div className="text-[8px] tracking-widest text-muted-foreground">TURB</div>
                    <div className="font-mono text-sm font-bold text-foreground">
                      {preFiltration.turbidity?.toFixed(2) ?? "—"}
                    </div>
                  </div>
                </div>
              )}

              {preFiltration && (
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Captured: {new Date(preFiltration.capturedAt).toLocaleTimeString()}
                </div>
              )}

              <Button
                onClick={capturePreFiltration}
                size="sm"
                className="w-full font-bold tracking-widest cursor-pointer"
                style={{ background: "oklch(0.6 0.17 145)", color: "oklch(0.1 0.02 145)" }}
              >
                <Camera className="w-3.5 h-3.5 mr-1.5" />
                {preFiltration ? "RECAPTURE" : "CAPTURE"} PRE-FILTRATION
              </Button>
            </div>

            {/* Post-Filtration Capture */}
            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "oklch(0.26 0.04 145)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-bold tracking-widest text-muted-foreground">STEP 2</div>
                  <div className="text-sm font-bold text-foreground mt-0.5">Post-Filtration Snapshot</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Capture readings after filtration cycle completes
                  </div>
                </div>
                {postFiltration && (
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                )}
              </div>

              {postFiltration && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <div className="text-[8px] tracking-widest text-muted-foreground">pH</div>
                    <div className="font-mono text-sm font-bold text-foreground">
                      {postFiltration.ph?.toFixed(2) ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <div className="text-[8px] tracking-widest text-muted-foreground">TDS</div>
                    <div className="font-mono text-sm font-bold text-foreground">
                      {postFiltration.tds?.toFixed(0) ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-2 text-center">
                    <div className="text-[8px] tracking-widest text-muted-foreground">TURB</div>
                    <div className="font-mono text-sm font-bold text-foreground">
                      {postFiltration.turbidity?.toFixed(2) ?? "—"}
                    </div>
                  </div>
                </div>
              )}

              {postFiltration && (
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Captured: {new Date(postFiltration.capturedAt).toLocaleTimeString()}
                </div>
              )}

              <Button
                onClick={capturePostFiltration}
                size="sm"
                className="w-full font-bold tracking-widest cursor-pointer"
                disabled={!preFiltration}
                style={preFiltration ? { background: "oklch(0.6 0.17 145)", color: "oklch(0.1 0.02 145)" } : undefined}
              >
                <Camera className="w-3.5 h-3.5 mr-1.5" />
                {postFiltration ? "RECAPTURE" : "CAPTURE"} POST-FILTRATION
              </Button>
            </div>
          </div>

          {/* Reset */}
          {hasComparison && (
            <div className="flex justify-end mt-3">
              <Button
                onClick={resetComparison}
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground font-bold tracking-widest cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> RESET COMPARISON
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info banner when no pre-filtration captured */}
      {!hasComparison && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border p-4 flex items-start gap-3"
          style={{ borderColor: "oklch(0.6 0.17 145 / 0.3)", background: "oklch(0.6 0.17 145 / 0.05)" }}
        >
          <Droplets className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-primary">How to use Filtration Comparison</div>
            <ol className="text-xs text-muted-foreground mt-2 space-y-1 list-decimal list-inside">
              <li>Capture a <strong>pre-filtration snapshot</strong> of your current water quality readings</li>
              <li>Start or wait for the filtration cycle to complete</li>
              <li>Capture a <strong>post-filtration snapshot</strong> (or view live comparison against current readings)</li>
              <li>Review the improvement percentages and status indicators below</li>
            </ol>
          </div>
        </motion.div>
      )}

      {/* Comparison Results */}
      {hasComparison && (
        <>
          {/* Summary */}
          <SummaryPanel rows={rows} />

          {/* Live indicator */}
          {!postFiltration && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: "#3b82f644", background: "#3b82f60d" }}>
              <motion.div
                className="w-2 h-2 rounded-full bg-blue-500"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <span className="text-[10px] font-bold tracking-widest text-blue-400">
                LIVE COMPARISON — Showing current readings vs pre-filtration snapshot
              </span>
            </div>
          )}

          {/* Comparison Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
                <Filter className="w-4 h-4" /> PARAMETER COMPARISON
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-[9px] font-bold tracking-widest text-muted-foreground py-2 px-3">PARAMETER</th>
                      <th className="text-[9px] font-bold tracking-widest text-muted-foreground py-2 px-3 text-center">BEFORE</th>
                      <th className="text-[9px] font-bold tracking-widest text-muted-foreground py-2 px-3 text-center">AFTER</th>
                      <th className="text-[9px] font-bold tracking-widest text-muted-foreground py-2 px-3 text-center">IMPROVEMENT</th>
                      <th className="text-[9px] font-bold tracking-widest text-muted-foreground py-2 px-3 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const statusCfg = STATUS_CONFIG[row.status];
                      return (
                        <tr key={row.parameter} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                          <td className="py-3 px-3">
                            <div className="text-xs font-bold text-foreground">{row.parameter}</div>
                            <div className="text-[9px] text-muted-foreground">{row.unit}</div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="font-mono text-sm font-bold" style={{ color: LEVEL_COLOR[row.beforeLevel] }}>
                              {row.before?.toFixed(1) ?? "—"}
                            </div>
                            <div className="text-[8px] font-bold" style={{ color: LEVEL_COLOR[row.beforeLevel] }}>
                              {LEVEL_LABEL[row.beforeLevel]}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="font-mono text-sm font-bold" style={{ color: LEVEL_COLOR[row.afterLevel] }}>
                              {row.after?.toFixed(1) ?? "—"}
                            </div>
                            <div className="text-[8px] font-bold" style={{ color: LEVEL_COLOR[row.afterLevel] }}>
                              {LEVEL_LABEL[row.afterLevel]}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="font-mono text-sm font-bold" style={{ color: statusCfg.color }}>
                              {row.improvement !== null
                                ? `${row.improvement > 0 ? "+" : ""}${row.improvement.toFixed(1)}%`
                                : "—"}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <StatusBadge status={row.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden space-y-3">
                {rows.map((row) => (
                  <ParameterCard key={row.parameter} row={row} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Warning if degraded */}
          {rows.some((r) => r.status === "degraded") && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border p-4 flex items-start gap-3"
              style={{ borderColor: "#ef444444", background: "#ef44440a" }}
            >
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-red-400">Parameter Degradation Detected</div>
                <div className="text-xs text-muted-foreground mt-1">
                  One or more parameters show degradation after filtration. This may indicate filter saturation,
                  contamination bypass, or sensor calibration issues. Check filter condition and consider maintenance.
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
