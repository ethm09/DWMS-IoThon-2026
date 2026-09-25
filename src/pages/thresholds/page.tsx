import { useState, useCallback } from "react";
import { motion } from "motion/react";
import {
  SlidersHorizontal, RotateCcw, Save, Shield, Clock, User,
  AlertTriangle, CheckCircle2, FlaskConical, Droplets, Wind, Activity,
  Info, Wrench, FileText, Gauge,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRole } from "@/hooks/use-user-role.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import { toast } from "sonner";
import { LEVEL_COLOR } from "@/lib/dwms-safety.ts";

// ── Threshold types & defaults ──────────────────────────────────────────────

type ThresholdConfig = {
  phMin: number;
  phMax: number;
  tdsMax: number;
  turbidityMax: number;
  flowRateMax: number;
  phCriticalLow: number;
  phCriticalHigh: number;
  tdsCritical: number;
  turbidityCritical: number;
  flowRateCritical: number;
};

type ThresholdMeta = {
  lastChangedBy: string;
  lastChangedAt: string;
};

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  phMin: 6.5,
  phMax: 8.5,
  tdsMax: 500,
  turbidityMax: 5,
  flowRateMax: 2.0,
  phCriticalLow: 5.5,
  phCriticalHigh: 10.0,
  tdsCritical: 1500,
  turbidityCritical: 50,
  flowRateCritical: 3.0,
};

const STORAGE_KEY = "ldwms.thresholds";
const META_KEY = "ldwms.thresholdsMeta";

function loadThresholds(): ThresholdConfig {
  if (typeof window === "undefined") return DEFAULT_THRESHOLDS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THRESHOLDS;
    return { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

function loadMeta(): ThresholdMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ThresholdMeta;
  } catch {
    return null;
  }
}

// ── Calibration types ────────────────────────────────────────────────────────

type CalibrationStatus = "calibrated" | "due" | "overdue";

type SensorCalibration = {
  sensor: string;
  status: CalibrationStatus;
  lastCalibrationDate: string;
  calibratedBy: string;
  notes: string;
  nextDueDate: string;
};

const CALIBRATION_KEY = "ldwms.calibrations";

const DEFAULT_CALIBRATIONS: SensorCalibration[] = [
  {
    sensor: "pH Sensor",
    status: "calibrated",
    lastCalibrationDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    calibratedBy: "System Admin",
    notes: "Calibrated using pH 4.0, 7.0, and 10.0 buffer solutions",
    nextDueDate: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    sensor: "TDS Sensor",
    status: "due",
    lastCalibrationDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    calibratedBy: "System Admin",
    notes: "Calibrated using 342 ppm NaCl standard solution",
    nextDueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    sensor: "Turbidity Sensor",
    status: "calibrated",
    lastCalibrationDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    calibratedBy: "System Admin",
    notes: "Zero-point baseline set with distilled water",
    nextDueDate: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    sensor: "Flow Rate Sensor",
    status: "calibrated",
    lastCalibrationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    calibratedBy: "System Admin",
    notes: "Verified against volumetric measurement at 1.0 L/min reference",
    nextDueDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function loadCalibrations(): SensorCalibration[] {
  if (typeof window === "undefined") return DEFAULT_CALIBRATIONS;
  try {
    const raw = localStorage.getItem(CALIBRATION_KEY);
    if (!raw) return DEFAULT_CALIBRATIONS;
    return JSON.parse(raw) as SensorCalibration[];
  } catch {
    return DEFAULT_CALIBRATIONS;
  }
}

const STATUS_COLORS: Record<CalibrationStatus, string> = {
  calibrated: "#22c55e",
  due: "#eab308",
  overdue: "#ef4444",
};

const SENSOR_ICONS: Record<string, React.ElementType> = {
  "pH Sensor": FlaskConical,
  "TDS Sensor": Droplets,
  "Turbidity Sensor": Wind,
  "Flow Rate Sensor": Activity,
};

// ── Threshold Row Component ──────────────────────────────────────────────────

function ThresholdRow({
  label,
  icon: Icon,
  unit,
  fields,
  values,
  onChange,
  disabled,
}: {
  label: string;
  icon: React.ElementType;
  unit: string;
  fields: { key: keyof ThresholdConfig; label: string; color: string }[];
  values: ThresholdConfig;
  onChange: (key: keyof ThresholdConfig, value: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "oklch(0.26 0.04 145)" }}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-bold text-foreground">{label}</div>
          <div className="text-[9px] text-muted-foreground tracking-widest">UNIT: {unit}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="text-[9px] font-bold tracking-widest block mb-1" style={{ color: field.color }}>
              {field.label}
            </label>
            <Input
              type="number"
              step="0.1"
              value={values[field.key]}
              onChange={(e) => onChange(field.key, parseFloat(e.target.value) || 0)}
              disabled={disabled}
              className="h-8 font-mono text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Calibration Card Component ───────────────────────────────────────────────

function CalibrationCard({
  cal,
  isAdmin,
  onUpdate,
}: {
  cal: SensorCalibration;
  isAdmin: boolean;
  onUpdate: (sensor: string, updates: Partial<SensorCalibration>) => void;
}) {
  const Icon = SENSOR_ICONS[cal.sensor] ?? Gauge;
  const statusColor = STATUS_COLORS[cal.status];
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(cal.notes);
  const [calibratedBy, setCalibratedBy] = useState(cal.calibratedBy);

  const handleMarkCalibrated = () => {
    const now = new Date();
    const nextDue = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    onUpdate(cal.sensor, {
      status: "calibrated",
      lastCalibrationDate: now.toISOString(),
      calibratedBy,
      notes,
      nextDueDate: nextDue.toISOString(),
    });
    setEditing(false);
    toast.success(`${cal.sensor} marked as calibrated`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-4 space-y-3"
      style={{ borderColor: `${statusColor}33`, background: `${statusColor}05` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${statusColor}18` }}>
            <Icon className="w-4.5 h-4.5" style={{ color: statusColor }} />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{cal.sensor}</div>
            <div className="text-[9px] tracking-widest font-bold" style={{ color: statusColor }}>
              {cal.status.toUpperCase()}
            </div>
          </div>
        </div>
        {isAdmin && !editing && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
            className="text-[9px] font-bold tracking-widest cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <Wrench className="w-3 h-3 mr-1" /> EDIT
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/30 p-2.5">
          <div className="text-[8px] font-bold tracking-widest text-muted-foreground flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" /> LAST CALIBRATION
          </div>
          <div className="font-mono text-xs font-bold text-foreground mt-1">
            {new Date(cal.lastCalibrationDate).toLocaleDateString()}
          </div>
        </div>
        <div className="rounded-lg bg-muted/30 p-2.5">
          <div className="text-[8px] font-bold tracking-widest text-muted-foreground flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" /> NEXT DUE
          </div>
          <div className="font-mono text-xs font-bold mt-1" style={{ color: statusColor }}>
            {new Date(cal.nextDueDate).toLocaleDateString()}
          </div>
        </div>
        <div className="rounded-lg bg-muted/30 p-2.5">
          <div className="text-[8px] font-bold tracking-widest text-muted-foreground flex items-center gap-1">
            <User className="w-2.5 h-2.5" /> CALIBRATED BY
          </div>
          <div className="text-xs font-bold text-foreground mt-1">{cal.calibratedBy}</div>
        </div>
        <div className="rounded-lg bg-muted/30 p-2.5">
          <div className="text-[8px] font-bold tracking-widest text-muted-foreground flex items-center gap-1">
            <FileText className="w-2.5 h-2.5" /> NOTES
          </div>
          <div className="text-[10px] text-foreground/80 mt-1 line-clamp-2">{cal.notes}</div>
        </div>
      </div>

      {/* Edit panel */}
      {editing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="border-t border-border pt-3 space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold tracking-widest text-muted-foreground block mb-1">
                CALIBRATED BY
              </label>
              <Input
                value={calibratedBy}
                onChange={(e) => setCalibratedBy(e.target.value)}
                className="h-8 text-sm"
                placeholder="Operator name"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold tracking-widest text-muted-foreground block mb-1">
                NOTES
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-8 text-sm"
                placeholder="Calibration notes..."
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleMarkCalibrated}
              className="font-bold tracking-widest cursor-pointer"
              style={{ background: "oklch(0.6 0.17 145)", color: "oklch(0.1 0.02 145)" }}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> MARK CALIBRATED
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
              className="font-bold tracking-widest cursor-pointer text-muted-foreground"
            >
              CANCEL
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ThresholdsPage() {
  const { isAdmin } = useUserRole();
  const { user } = useAuth();

  const [thresholds, setThresholds] = useState<ThresholdConfig>(loadThresholds);
  const [meta, setMeta] = useState<ThresholdMeta | null>(loadMeta);
  const [calibrations, setCalibrations] = useState<SensorCalibration[]>(loadCalibrations);
  const [hasChanges, setHasChanges] = useState(false);

  const handleThresholdChange = useCallback((key: keyof ThresholdConfig, value: number) => {
    setThresholds((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  }, []);

  const saveThresholds = useCallback(() => {
    const newMeta: ThresholdMeta = {
      lastChangedBy: user?.profile.name ?? user?.profile.email ?? "Unknown",
      lastChangedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds));
    localStorage.setItem(META_KEY, JSON.stringify(newMeta));
    setMeta(newMeta);
    setHasChanges(false);
    toast.success("Thresholds saved successfully");
  }, [thresholds, user]);

  const restoreDefaults = useCallback(() => {
    setThresholds(DEFAULT_THRESHOLDS);
    setHasChanges(true);
    toast.info("Defaults restored — click Save to apply");
  }, []);

  const updateCalibration = useCallback((sensor: string, updates: Partial<SensorCalibration>) => {
    setCalibrations((prev) => {
      const next = prev.map((c) => (c.sensor === sensor ? { ...c, ...updates } : c));
      localStorage.setItem(CALIBRATION_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const canEdit = isAdmin;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-widest text-primary uppercase flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5" /> Thresholds & Calibration
          </h2>
          <p className="text-xs text-muted-foreground tracking-wider mt-0.5">
            Configure safety thresholds and manage sensor calibration
          </p>
        </div>
        {!canEdit && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-bold tracking-widest"
            style={{ color: "#eab308", borderColor: "#eab30844", background: "#eab3080d" }}>
            <Shield className="w-3 h-3" /> ADMIN ACCESS REQUIRED TO EDIT
          </div>
        )}
      </div>

      <Tabs defaultValue="thresholds" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="thresholds" className="cursor-pointer font-bold tracking-widest text-xs">
            THRESHOLDS
          </TabsTrigger>
          <TabsTrigger value="calibration" className="cursor-pointer font-bold tracking-widest text-xs">
            CALIBRATION
          </TabsTrigger>
        </TabsList>

        {/* ── THRESHOLDS TAB ── */}
        <TabsContent value="thresholds" className="space-y-4">
          {/* Meta info */}
          {meta && (
            <div className="flex items-center gap-4 flex-wrap text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> Last changed by: <strong className="text-foreground">{meta.lastChangedBy}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {new Date(meta.lastChangedAt).toLocaleString()}
              </span>
            </div>
          )}

          {/* Threshold rows */}
          <ThresholdRow
            label="pH Level"
            icon={FlaskConical}
            unit="pH"
            values={thresholds}
            onChange={handleThresholdChange}
            disabled={!canEdit}
            fields={[
              { key: "phMin", label: "SAFE MIN", color: LEVEL_COLOR.safe },
              { key: "phMax", label: "SAFE MAX", color: LEVEL_COLOR.safe },
              { key: "phCriticalLow", label: "CRITICAL LOW", color: LEVEL_COLOR.critical },
              { key: "phCriticalHigh", label: "CRITICAL HIGH", color: LEVEL_COLOR.critical },
            ]}
          />

          <ThresholdRow
            label="TDS (Total Dissolved Solids)"
            icon={Droplets}
            unit="ppm"
            values={thresholds}
            onChange={handleThresholdChange}
            disabled={!canEdit}
            fields={[
              { key: "tdsMax", label: "SAFE MAX", color: LEVEL_COLOR.safe },
              { key: "tdsCritical", label: "CRITICAL MAX", color: LEVEL_COLOR.critical },
            ]}
          />

          <ThresholdRow
            label="Turbidity"
            icon={Wind}
            unit="NTU"
            values={thresholds}
            onChange={handleThresholdChange}
            disabled={!canEdit}
            fields={[
              { key: "turbidityMax", label: "SAFE MAX", color: LEVEL_COLOR.safe },
              { key: "turbidityCritical", label: "CRITICAL MAX", color: LEVEL_COLOR.critical },
            ]}
          />

          <ThresholdRow
            label="Flow Rate"
            icon={Activity}
            unit="L/min"
            values={thresholds}
            onChange={handleThresholdChange}
            disabled={!canEdit}
            fields={[
              { key: "flowRateMax", label: "SAFE MAX", color: LEVEL_COLOR.safe },
              { key: "flowRateCritical", label: "CRITICAL MAX", color: LEVEL_COLOR.critical },
            ]}
          />

          {/* Actions */}
          {canEdit && (
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={saveThresholds}
                disabled={!hasChanges}
                className="font-bold tracking-widest cursor-pointer"
                style={hasChanges ? { background: "oklch(0.6 0.17 145)", color: "oklch(0.1 0.02 145)" } : undefined}
              >
                <Save className="w-4 h-4 mr-1.5" /> SAVE THRESHOLDS
              </Button>
              <Button
                onClick={restoreDefaults}
                variant="ghost"
                className="font-bold tracking-widest cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" /> RESTORE DEFAULTS
              </Button>
            </div>
          )}

          {/* Default values reference */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
                <Info className="w-4 h-4" /> DEFAULT REFERENCE VALUES
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3" style={{ borderColor: "oklch(0.26 0.04 145)" }}>
                  <div className="text-[9px] font-bold tracking-widest text-muted-foreground">pH SAFE RANGE</div>
                  <div className="font-mono text-sm font-bold text-primary mt-1">6.5 — 8.5</div>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: "oklch(0.26 0.04 145)" }}>
                  <div className="text-[9px] font-bold tracking-widest text-muted-foreground">TDS MAX</div>
                  <div className="font-mono text-sm font-bold text-primary mt-1">500 ppm</div>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: "oklch(0.26 0.04 145)" }}>
                  <div className="text-[9px] font-bold tracking-widest text-muted-foreground">TURBIDITY MAX</div>
                  <div className="font-mono text-sm font-bold text-primary mt-1">5 NTU</div>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: "oklch(0.26 0.04 145)" }}>
                  <div className="text-[9px] font-bold tracking-widest text-muted-foreground">FLOW RATE MAX</div>
                  <div className="font-mono text-sm font-bold text-primary mt-1">2.0 L/min</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CALIBRATION TAB ── */}
        <TabsContent value="calibration" className="space-y-4">
          {/* Calibration status summary */}
          <div className="grid grid-cols-3 gap-3">
            {(["calibrated", "due", "overdue"] as CalibrationStatus[]).map((status) => {
              const count = calibrations.filter((c) => c.status === status).length;
              return (
                <div key={status} className="rounded-lg border p-3 text-center" style={{ borderColor: `${STATUS_COLORS[status]}44`, background: `${STATUS_COLORS[status]}08` }}>
                  <div className="text-[9px] font-bold tracking-widest text-muted-foreground">{status.toUpperCase()}</div>
                  <div className="font-mono text-xl font-bold mt-1" style={{ color: STATUS_COLORS[status] }}>{count}</div>
                </div>
              );
            })}
          </div>

          {/* Calibration cards */}
          <div className="space-y-3">
            {calibrations.map((cal) => (
              <CalibrationCard
                key={cal.sensor}
                cal={cal}
                isAdmin={canEdit}
                onUpdate={updateCalibration}
              />
            ))}
          </div>

          {/* Calibration Instructions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold tracking-widest text-primary flex items-center gap-2">
                <FileText className="w-4 h-4" /> CALIBRATION INSTRUCTIONS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "oklch(0.26 0.04 145)" }}>
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-primary" />
                  <div className="text-xs font-bold text-foreground">pH Sensor Calibration</div>
                </div>
                <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside ml-6">
                  <li>Prepare buffer solutions: <strong>pH 4.0</strong>, <strong>pH 7.0</strong>, and <strong>pH 10.0</strong></li>
                  <li>Rinse probe with distilled water between each solution</li>
                  <li>Immerse probe in pH 7.0 buffer, wait for stable reading, set zero point</li>
                  <li>Immerse in pH 4.0 buffer, wait for stability, set slope (acidic)</li>
                  <li>Immerse in pH 10.0 buffer, wait for stability, set slope (alkaline)</li>
                  <li>Verify by re-testing pH 7.0 — reading should be within ±0.05</li>
                </ol>
              </div>

              <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "oklch(0.26 0.04 145)" }}>
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-primary" />
                  <div className="text-xs font-bold text-foreground">TDS Sensor Calibration</div>
                </div>
                <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside ml-6">
                  <li>Prepare a <strong>342 ppm NaCl</strong> standard calibration solution</li>
                  <li>Ensure solution temperature is at <strong>25°C</strong> (reference temp)</li>
                  <li>Rinse probe with distilled water, dry gently</li>
                  <li>Immerse probe fully in standard solution, wait 30 seconds</li>
                  <li>Set calibration point to 342 ppm, verify stable reading</li>
                  <li>Cross-check with distilled water (should read 0–5 ppm)</li>
                </ol>
              </div>

              <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "oklch(0.26 0.04 145)" }}>
                <div className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-primary" />
                  <div className="text-xs font-bold text-foreground">Turbidity Sensor Calibration</div>
                </div>
                <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside ml-6">
                  <li>Clean sensor lens with lint-free cloth and distilled water</li>
                  <li>Fill vial with <strong>distilled water</strong> for zero-point baseline</li>
                  <li>Set zero-point reading (should be 0.0 NTU)</li>
                  <li>Optionally use a <strong>20 NTU Formazin</strong> standard for span calibration</li>
                  <li>Verify reading matches standard within ±2 NTU</li>
                  <li>Wipe sensor dry and reinstall in measurement chamber</li>
                </ol>
              </div>

              <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: "oklch(0.26 0.04 145)" }}>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <div className="text-xs font-bold text-foreground">Flow Rate Sensor Calibration</div>
                </div>
                <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside ml-6">
                  <li>Set system to a known flow rate using a <strong>calibrated valve</strong></li>
                  <li>Collect water in a graduated container for <strong>60 seconds</strong></li>
                  <li>Calculate actual flow rate (volume / time)</li>
                  <li>Compare sensor reading with measured value</li>
                  <li>Adjust sensor K-factor if deviation exceeds ±5%</li>
                  <li>Repeat at <strong>1.0 L/min</strong> and <strong>2.0 L/min</strong> reference points</li>
                </ol>
              </div>

              {/* Warning */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg border p-3 flex items-start gap-2"
                style={{ borderColor: "#eab30844", background: "#eab3080a" }}
              >
                <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-[10px] text-muted-foreground">
                  <strong className="text-yellow-500">Important:</strong> Always wear appropriate PPE during calibration.
                  Ensure the system is in Manual mode and pump is OFF before removing sensors for calibration.
                  Record all calibration activities in the notes field.
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
