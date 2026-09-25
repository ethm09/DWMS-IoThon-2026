import { useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  Brain, Wrench, AlertTriangle, CheckCircle, Clock, TrendingDown,
  Cpu, Droplets, Wind, FlaskConical, Power, Activity, Calendar,
  ArrowRight, Gauge, ShieldAlert, Zap, BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, ReferenceLine,
} from "recharts";
import { addDays, format } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────

type RiskLevel = "low" | "medium" | "high" | "critical";
type ComponentId = "tds_sensor" | "turbidity_sensor" | "ph_sensor" | "pump" | "filter" | "controller";

type PredictiveComponent = {
  id: ComponentId;
  name: string;
  sublabel: string;
  icon: React.FC<{ className?: string }>;
  healthScore: number; // 0-100
  remainingLife: number; // days
  failureProbability: number; // 0-1, next 30 days
  lastMaintenance: string; // ISO date
  nextMaintenance: string; // predicted ISO date
  riskLevel: RiskLevel;
  degradationRate: number; // % per month
  operatingHours: number;
  meanTimeBetweenFailures: number; // hours
  recommendations: string[];
};

type DegradationPoint = {
  day: number;
  health: number;
  predicted: number;
  threshold: number;
};

// ── Constants ──────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string; border: string; label: string }> = {
  low: { color: "#22c55e", bg: "#22c55e0d", border: "#22c55e44", label: "LOW" },
  medium: { color: "#eab308", bg: "#eab3080d", border: "#eab30844", label: "MEDIUM" },
  high: { color: "#f97316", bg: "#f973160d", border: "#f9731644", label: "HIGH" },
  critical: { color: "#ef4444", bg: "#ef44440d", border: "#ef444444", label: "CRITICAL" },
};

// ── Predictive Model (simulated) ───────────────────────────────────────────

function computeRiskLevel(failureProb: number, healthScore: number): RiskLevel {
  if (failureProb > 0.7 || healthScore < 30) return "critical";
  if (failureProb > 0.4 || healthScore < 55) return "high";
  if (failureProb > 0.2 || healthScore < 75) return "medium";
  return "low";
}

function generateDegradationCurve(currentHealth: number, degradationRate: number): DegradationPoint[] {
  const points: DegradationPoint[] = [];
  const dailyRate = degradationRate / 30;

  for (let day = 0; day <= 90; day += 3) {
    const actualHealth = Math.max(0, currentHealth - day * dailyRate * (1 + day * 0.002));
    // Predicted uses exponential degradation model
    const predictedHealth = Math.max(0, currentHealth * Math.exp(-day * dailyRate * 0.015));
    points.push({
      day,
      health: Math.round(actualHealth * 10) / 10,
      predicted: Math.round(predictedHealth * 10) / 10,
      threshold: 40, // Maintenance threshold
    });
  }
  return points;
}

function buildComponents(readings: { ph: number | null; tds: number | null; turbidity: number | null; flowRate: number | null }): PredictiveComponent[] {
  const now = new Date();

  // Base health influenced by current readings
  const phStress = readings.ph !== null ? Math.abs(readings.ph - 7.0) / 3.5 : 0;
  const tdsStress = readings.tds !== null ? Math.min(1, readings.tds / 1500) : 0;
  const turbStress = readings.turbidity !== null ? Math.min(1, readings.turbidity / 50) : 0;
  const flowStress = readings.flowRate !== null ? Math.min(1, readings.flowRate / 3.0) : 0;

  const components: PredictiveComponent[] = [
    {
      id: "tds_sensor",
      name: "TDS Sensor",
      sublabel: "Conductivity probe — electrode degradation model",
      icon: Droplets,
      healthScore: Math.round(92 - tdsStress * 15 - Math.random() * 5),
      remainingLife: Math.round(180 - tdsStress * 60 - Math.random() * 20),
      failureProbability: 0.05 + tdsStress * 0.15,
      lastMaintenance: format(addDays(now, -45), "yyyy-MM-dd"),
      nextMaintenance: format(addDays(now, Math.round(90 - tdsStress * 30)), "yyyy-MM-dd"),
      riskLevel: "low",
      degradationRate: 2.1 + tdsStress * 1.5,
      operatingHours: 4320 + Math.round(Math.random() * 200),
      meanTimeBetweenFailures: 8760,
      recommendations: [
        "Calibrate sensor weekly with standard solution",
        "Replace electrode every 12 months",
        tdsStress > 0.5 ? "High TDS causing accelerated electrode wear — consider pre-filtration" : "Current operating conditions are within normal parameters",
      ],
    },
    {
      id: "turbidity_sensor",
      name: "Turbidity Sensor",
      sublabel: "Optical nephelometer — lens fouling model",
      icon: Wind,
      healthScore: Math.round(88 - turbStress * 25 - Math.random() * 5),
      remainingLife: Math.round(150 - turbStress * 80 - Math.random() * 15),
      failureProbability: 0.08 + turbStress * 0.25,
      lastMaintenance: format(addDays(now, -30), "yyyy-MM-dd"),
      nextMaintenance: format(addDays(now, Math.round(60 - turbStress * 25)), "yyyy-MM-dd"),
      riskLevel: "low",
      degradationRate: 3.2 + turbStress * 3.0,
      operatingHours: 4320 + Math.round(Math.random() * 200),
      meanTimeBetweenFailures: 6570,
      recommendations: [
        "Clean optical lens bi-weekly to prevent fouling buildup",
        "Check LED intensity monthly — replace if <70% rated output",
        turbStress > 0.3 ? "Elevated particulates accelerating lens fouling — increase cleaning frequency" : "Lens condition satisfactory",
      ],
    },
    {
      id: "ph_sensor",
      name: "pH Sensor",
      sublabel: "Glass electrode — reference junction model",
      icon: FlaskConical,
      healthScore: Math.round(85 - phStress * 20 - Math.random() * 8),
      remainingLife: Math.round(120 - phStress * 50 - Math.random() * 20),
      failureProbability: 0.1 + phStress * 0.2,
      lastMaintenance: format(addDays(now, -60), "yyyy-MM-dd"),
      nextMaintenance: format(addDays(now, Math.round(45 - phStress * 20)), "yyyy-MM-dd"),
      riskLevel: "medium",
      degradationRate: 4.0 + phStress * 2.5,
      operatingHours: 4320 + Math.round(Math.random() * 200),
      meanTimeBetweenFailures: 5840,
      recommendations: [
        "Store in KCl solution when not in use",
        "Calibrate with pH 4.0 and 7.0 buffers weekly",
        "Reference junction lifespan is ~18 months — schedule replacement",
        phStress > 0.4 ? "Extreme pH exposure accelerating glass membrane degradation" : "Glass membrane within expected wear profile",
      ],
    },
    {
      id: "pump",
      name: "Main Pump",
      sublabel: "Centrifugal pump — bearing wear model",
      icon: Power,
      healthScore: Math.round(94 - flowStress * 12 - Math.random() * 4),
      remainingLife: Math.round(365 - flowStress * 100 - Math.random() * 30),
      failureProbability: 0.03 + flowStress * 0.1,
      lastMaintenance: format(addDays(now, -90), "yyyy-MM-dd"),
      nextMaintenance: format(addDays(now, Math.round(180 - flowStress * 60)), "yyyy-MM-dd"),
      riskLevel: "low",
      degradationRate: 1.2 + flowStress * 1.8,
      operatingHours: 4320 + Math.round(Math.random() * 200),
      meanTimeBetweenFailures: 17520,
      recommendations: [
        "Check bearing temperature quarterly — replace if >80C",
        "Inspect impeller for cavitation damage every 6 months",
        flowStress > 0.5 ? "Sustained high flow rate increasing bearing wear — review duty cycle" : "Operating within rated parameters",
      ],
    },
    {
      id: "filter",
      name: "Filter Media",
      sublabel: "Sand/carbon — media saturation model",
      icon: Activity,
      healthScore: Math.round(78 - (tdsStress + turbStress) * 15 - Math.random() * 6),
      remainingLife: Math.round(90 - (tdsStress + turbStress) * 30 - Math.random() * 10),
      failureProbability: 0.15 + (tdsStress + turbStress) * 0.15,
      lastMaintenance: format(addDays(now, -21), "yyyy-MM-dd"),
      nextMaintenance: format(addDays(now, Math.round(30 - (tdsStress + turbStress) * 10)), "yyyy-MM-dd"),
      riskLevel: "medium",
      degradationRate: 5.5 + (tdsStress + turbStress) * 3.0,
      operatingHours: 4320 + Math.round(Math.random() * 200),
      meanTimeBetweenFailures: 4380,
      recommendations: [
        "Backwash weekly to prevent channeling",
        "Replace activated carbon every 6 months",
        "Monitor differential pressure — replace media at >15 PSI delta",
        (tdsStress + turbStress) > 0.6 ? "Heavy load accelerating media saturation — consider backwash frequency increase" : "Media capacity within acceptable range",
      ],
    },
    {
      id: "controller",
      name: "MCU / Controller",
      sublabel: "Arduino Mega — firmware & connectivity model",
      icon: Cpu,
      healthScore: 98 - Math.round(Math.random() * 3),
      remainingLife: 730 + Math.round(Math.random() * 100),
      failureProbability: 0.01,
      lastMaintenance: format(addDays(now, -120), "yyyy-MM-dd"),
      nextMaintenance: format(addDays(now, 365), "yyyy-MM-dd"),
      riskLevel: "low",
      degradationRate: 0.3,
      operatingHours: 4320 + Math.round(Math.random() * 200),
      meanTimeBetweenFailures: 43800,
      recommendations: [
        "Update firmware quarterly for security patches",
        "Check flash memory wear leveling annually",
        "Verify watchdog timer function monthly",
      ],
    },
  ];

  // Compute risk levels
  return components.map((c) => ({
    ...c,
    riskLevel: computeRiskLevel(c.failureProbability, c.healthScore),
  }));
}

// ── AI Recommendation Engine ───────────────────────────────────────────────

function generateAIInsights(components: PredictiveComponent[]): string[] {
  const insights: string[] = [];
  const criticalComps = components.filter((c) => c.riskLevel === "critical");
  const highComps = components.filter((c) => c.riskLevel === "high");
  const nearMaint = components.filter((c) => c.remainingLife < 30);

  if (criticalComps.length > 0) {
    insights.push(
      `URGENT: ${criticalComps.map((c) => c.name).join(", ")} ${criticalComps.length > 1 ? "are" : "is"} in critical condition. Immediate maintenance required to prevent system failure.`
    );
  }

  if (highComps.length > 0) {
    insights.push(
      `Schedule maintenance for ${highComps.map((c) => c.name).join(", ")} within the next 2 weeks. Degradation rate exceeds normal parameters.`
    );
  }

  if (nearMaint.length > 0) {
    insights.push(
      `${nearMaint.map((c) => c.name).join(", ")} ${nearMaint.length > 1 ? "have" : "has"} less than 30 days of estimated remaining useful life.`
    );
  }

  const avgHealth = components.reduce((sum, c) => sum + c.healthScore, 0) / components.length;
  if (avgHealth > 85) {
    insights.push("Overall system health is good. Continue standard preventive maintenance schedule.");
  } else if (avgHealth > 70) {
    insights.push("System health is moderate. Consider accelerating maintenance intervals by 20% to prevent cascading failures.");
  } else {
    insights.push("System health is below optimal. Multiple components showing wear. Comprehensive maintenance window recommended within 7 days.");
  }

  // Correlation insight
  const filterComp = components.find((c) => c.id === "filter");
  const pumpComp = components.find((c) => c.id === "pump");
  if (filterComp && pumpComp && filterComp.healthScore < 80) {
    insights.push(
      "Correlation detected: Filter media degradation is causing increased pump load. Replacing filter media will extend pump bearing life by an estimated 15-25%."
    );
  }

  return insights;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function HealthRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - score / 100);
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="oklch(0.15 0.02 145)" strokeWidth="5" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut" as const }}
          style={{ filter: `drop-shadow(0 0 4px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold font-mono" style={{ color }}>{score}%</span>
      </div>
    </div>
  );
}

function ComponentCard({ component }: { component: PredictiveComponent }) {
  const riskCfg = RISK_CONFIG[component.riskLevel];
  const Icon = component.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-4 space-y-3"
      style={{ borderColor: riskCfg.border, background: riskCfg.bg }}
    >
      <div className="flex items-start gap-3">
        <HealthRing score={component.healthScore} size={64} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span style={{ color: riskCfg.color }}><Icon className="w-4 h-4" /></span>
            <span className="text-xs font-bold tracking-widest">{component.name}</span>
            <span
              className="text-[8px] font-bold tracking-widest px-1.5 py-0.5 rounded-full ml-auto"
              style={{ color: riskCfg.color, background: `${riskCfg.color}20`, border: `1px solid ${riskCfg.border}` }}
            >
              {riskCfg.label} RISK
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{component.sublabel}</p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
            <div>
              <span className="text-[9px] text-muted-foreground">Remaining Life</span>
              <div className="text-xs font-bold font-mono" style={{ color: component.remainingLife < 30 ? "#ef4444" : component.remainingLife < 60 ? "#eab308" : "#22c55e" }}>
                {component.remainingLife} days
              </div>
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground">Failure Prob (30d)</span>
              <div className="text-xs font-bold font-mono" style={{ color: component.failureProbability > 0.3 ? "#ef4444" : component.failureProbability > 0.15 ? "#eab308" : "#22c55e" }}>
                {(component.failureProbability * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground">Degradation Rate</span>
              <div className="text-xs font-bold font-mono text-foreground">{component.degradationRate.toFixed(1)}%/mo</div>
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground">Next Maintenance</span>
              <div className="text-xs font-bold font-mono text-foreground">{format(new Date(component.nextMaintenance), "MMM d")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-1 pt-2 border-t border-border/40">
        <div className="text-[9px] font-bold tracking-widest text-muted-foreground flex items-center gap-1">
          <Brain className="w-3 h-3" /> AI RECOMMENDATIONS
        </div>
        {component.recommendations.map((rec, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <ArrowRight className="w-3 h-3 text-primary shrink-0 mt-0.5" />
            <span className="text-[10px] text-muted-foreground leading-relaxed">{rec}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function DegradationChart({ component }: { component: PredictiveComponent }) {
  const data = useMemo(
    () => generateDegradationCurve(component.healthScore, component.degradationRate),
    [component.healthScore, component.degradationRate]
  );

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.02 145)" />
          <XAxis
            dataKey="day"
            stroke="oklch(0.4 0.02 145)"
            tick={{ fontSize: 9 }}
            label={{ value: "Days from now", position: "bottom", fontSize: 9, fill: "oklch(0.4 0.02 145)" }}
          />
          <YAxis
            stroke="oklch(0.4 0.02 145)"
            tick={{ fontSize: 9 }}
            domain={[0, 100]}
            label={{ value: "Health %", angle: -90, position: "insideLeft", fontSize: 9, fill: "oklch(0.4 0.02 145)" }}
          />
          <Tooltip
            contentStyle={{ background: "oklch(0.12 0.02 145)", border: "1px solid oklch(0.2 0.02 145)", borderRadius: "8px", fontSize: "10px" }}
            labelStyle={{ color: "oklch(0.6 0.02 145)" }}
          />
          <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Maintenance Threshold", fill: "#ef4444", fontSize: 9 }} />
          <Area type="monotone" dataKey="health" stroke="#22c55e" fill="#22c55e15" strokeWidth={2} name="Actual Health" />
          <Area type="monotone" dataKey="predicted" stroke="#06b6d4" fill="#06b6d415" strokeWidth={2} strokeDasharray="4 4" name="Predicted" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MaintenanceSchedule({ components }: { components: PredictiveComponent[] }) {
  const sorted = [...components].sort(
    (a, b) => new Date(a.nextMaintenance).getTime() - new Date(b.nextMaintenance).getTime()
  );

  return (
    <div className="space-y-2">
      {sorted.map((comp) => {
        const daysUntil = Math.round(
          (new Date(comp.nextMaintenance).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        const urgencyColor = daysUntil < 14 ? "#ef4444" : daysUntil < 30 ? "#eab308" : "#22c55e";
        const Icon = comp.icon;

        return (
          <div
            key={comp.id}
            className="flex items-center gap-3 p-3 rounded-lg border"
            style={{ borderColor: `${urgencyColor}44`, background: `${urgencyColor}08` }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${urgencyColor}15` }}>
              <span style={{ color: urgencyColor }}><Icon className="w-5 h-5" /></span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold tracking-wider">{comp.name}</div>
              <div className="text-[10px] text-muted-foreground">
                Last: {format(new Date(comp.lastMaintenance), "MMM d, yyyy")}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold font-mono" style={{ color: urgencyColor }}>
                {format(new Date(comp.nextMaintenance), "MMM d")}
              </div>
              <div className="text-[9px] text-muted-foreground">
                {daysUntil > 0 ? `in ${daysUntil} days` : "OVERDUE"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Maintenance() {
  const { readings } = useProcessMode();
  const [selectedComponent, setSelectedComponent] = useState<ComponentId | null>(null);

  const components = useMemo(() => buildComponents(readings), [readings]);
  const aiInsights = useMemo(() => generateAIInsights(components), [components]);

  const avgHealth = Math.round(components.reduce((sum, c) => sum + c.healthScore, 0) / components.length);
  const criticalCount = components.filter((c) => c.riskLevel === "critical").length;
  const highCount = components.filter((c) => c.riskLevel === "high").length;
  const nearestMaint = [...components].sort(
    (a, b) => new Date(a.nextMaintenance).getTime() - new Date(b.nextMaintenance).getTime()
  )[0];
  const daysToNext = nearestMaint
    ? Math.round((new Date(nearestMaint.nextMaintenance).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const selected = selectedComponent ? components.find((c) => c.id === selectedComponent) : null;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold tracking-widest text-primary uppercase">Predictive Maintenance AI</h2>
        </div>
        <p className="text-xs text-muted-foreground tracking-wider mt-0.5">
          AI-powered failure prediction, degradation analysis, and maintenance scheduling
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "SYSTEM HEALTH", value: `${avgHealth}%`, color: avgHealth >= 80 ? "#22c55e" : avgHealth >= 60 ? "#eab308" : "#ef4444", icon: Gauge },
          { label: "CRITICAL ALERTS", value: `${criticalCount + highCount}`, color: criticalCount > 0 ? "#ef4444" : highCount > 0 ? "#eab308" : "#22c55e", icon: ShieldAlert },
          { label: "NEXT MAINTENANCE", value: daysToNext > 0 ? `${daysToNext}d` : "NOW", color: daysToNext < 14 ? "#ef4444" : daysToNext < 30 ? "#eab308" : "#22c55e", icon: Calendar },
          { label: "PREDICTIONS", value: `${components.length} active`, color: "#06b6d4", icon: Zap },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <span style={{ color: k.color }}><Icon className="w-4 h-4" /></span>
                  <span className="text-[9px] font-bold tracking-widest text-muted-foreground">{k.label}</span>
                </div>
                <div className="font-mono font-bold text-lg mt-1" style={{ color: k.color }}>{k.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* AI Insights Panel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
            <Brain className="w-4 h-4" /> ETHM AI — MAINTENANCE INSIGHTS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {aiInsights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-2 p-2.5 rounded-lg border border-primary/20 bg-primary/5"
              >
                <Brain className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-foreground leading-relaxed">{insight}</p>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="components">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="components" className="cursor-pointer text-xs tracking-widest font-bold gap-1">
            <Wrench className="w-3.5 h-3.5" /> COMPONENTS
          </TabsTrigger>
          <TabsTrigger value="degradation" className="cursor-pointer text-xs tracking-widest font-bold gap-1">
            <TrendingDown className="w-3.5 h-3.5" /> DEGRADATION
          </TabsTrigger>
          <TabsTrigger value="schedule" className="cursor-pointer text-xs tracking-widest font-bold gap-1">
            <Calendar className="w-3.5 h-3.5" /> SCHEDULE
          </TabsTrigger>
          <TabsTrigger value="analytics" className="cursor-pointer text-xs tracking-widest font-bold gap-1">
            <BarChart3 className="w-3.5 h-3.5" /> ANALYTICS
          </TabsTrigger>
        </TabsList>

        {/* Components tab */}
        <TabsContent value="components" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {components.map((comp) => (
              <ComponentCard key={comp.id} component={comp} />
            ))}
          </div>
        </TabsContent>

        {/* Degradation tab */}
        <TabsContent value="degradation" className="mt-4 space-y-4">
          {/* Component selector */}
          <div className="flex flex-wrap gap-2">
            {components.map((comp) => {
              const riskCfg = RISK_CONFIG[comp.riskLevel];
              const Icon = comp.icon;
              return (
                <button
                  key={comp.id}
                  onClick={() => setSelectedComponent(comp.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest border cursor-pointer transition-all"
                  style={{
                    color: selectedComponent === comp.id ? "#0f172a" : riskCfg.color,
                    background: selectedComponent === comp.id ? riskCfg.color : riskCfg.bg,
                    borderColor: riskCfg.border,
                  }}
                >
                  <Icon className="w-3 h-3" />
                  {comp.name.toUpperCase()}
                </button>
              );
            })}
          </div>

          {selected ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" /> {selected.name.toUpperCase()} — 90-DAY DEGRADATION FORECAST
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DegradationChart component={selected} />
                <div className="flex items-center gap-4 mt-3 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 rounded-full bg-green-500" />
                    <span className="text-muted-foreground">Actual Health</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 rounded-full bg-cyan-500" style={{ borderBottom: "1px dashed" }} />
                    <span className="text-muted-foreground">AI Predicted</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 rounded-full bg-red-500" style={{ borderBottom: "1px dashed" }} />
                    <span className="text-muted-foreground">Maintenance Threshold (40%)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingDown className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground tracking-wider">Select a component above to view its degradation forecast</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Schedule tab */}
        <TabsContent value="schedule" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
                <Calendar className="w-4 h-4" /> PREDICTED MAINTENANCE SCHEDULE
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MaintenanceSchedule components={components} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics tab */}
        <TabsContent value="analytics" className="mt-4 space-y-4">
          {/* Risk distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> RISK DISTRIBUTION
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                {(["low", "medium", "high", "critical"] as const).map((level) => {
                  const count = components.filter((c) => c.riskLevel === level).length;
                  const cfg = RISK_CONFIG[level];
                  return (
                    <div key={level} className="text-center p-3 rounded-lg border" style={{ borderColor: cfg.border, background: cfg.bg }}>
                      <div className="text-2xl font-bold font-mono" style={{ color: cfg.color }}>{count}</div>
                      <div className="text-[9px] font-bold tracking-widest" style={{ color: cfg.color }}>{cfg.label}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* MTBF comparison */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
                <Clock className="w-4 h-4" /> MEAN TIME BETWEEN FAILURES (MTBF)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {components.map((comp) => {
                  const maxMtbf = Math.max(...components.map((c) => c.meanTimeBetweenFailures));
                  const pct = (comp.meanTimeBetweenFailures / maxMtbf) * 100;
                  const Icon = comp.icon;
                  const riskCfg = RISK_CONFIG[comp.riskLevel];

                  return (
                    <div key={comp.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span style={{ color: riskCfg.color }}><Icon className="w-3.5 h-3.5" /></span>
                          <span className="text-[10px] font-bold tracking-wider">{comp.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {(comp.meanTimeBetweenFailures / 24).toFixed(0)} days ({comp.meanTimeBetweenFailures.toLocaleString()}h)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-border overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" as const }}
                          style={{ background: riskCfg.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Operating hours */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
                <Power className="w-4 h-4" /> OPERATING HOURS & UTILIZATION
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {components.map((comp) => {
                  const Icon = comp.icon;
                  const utilization = (comp.operatingHours / comp.meanTimeBetweenFailures) * 100;
                  const utilizationColor = utilization > 80 ? "#ef4444" : utilization > 60 ? "#eab308" : "#22c55e";

                  return (
                    <div key={comp.id} className="p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-muted-foreground"><Icon className="w-3.5 h-3.5" /></span>
                        <span className="text-[10px] font-bold tracking-wider truncate">{comp.name}</span>
                      </div>
                      <div className="text-lg font-bold font-mono text-foreground">
                        {comp.operatingHours.toLocaleString()}h
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <div className="h-1 flex-1 rounded-full bg-border overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, utilization)}%`, background: utilizationColor }} />
                        </div>
                        <span className="text-[9px] font-mono" style={{ color: utilizationColor }}>{utilization.toFixed(0)}%</span>
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">of MTBF cycle</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
