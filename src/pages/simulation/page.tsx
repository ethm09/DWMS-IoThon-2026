import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Power, Zap, Droplets, Wind, FlaskConical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SensorStatus = "normal" | "warning" | "danger";

function getWaterColor(tds: number, turbidity: number): string {
  if (turbidity > 4 || tds > 600) return "#dc2626"; // red/dirty
  if (turbidity > 1 || tds > 300) return "#ca8a04"; // orange/warning
  return "#22c55e"; // clean green
}

function getStatus(value: number, type: "tds" | "turbidity" | "ph"): SensorStatus {
  if (type === "tds") return value < 300 ? "normal" : value < 600 ? "warning" : "danger";
  if (type === "turbidity") return value < 1 ? "normal" : value < 4 ? "warning" : "danger";
  return value >= 6.5 && value <= 8.5 ? "normal" : value >= 5.5 && value <= 9.5 ? "warning" : "danger";
}

const STATUS_COLOR: Record<SensorStatus, string> = {
  normal: "#22c55e",
  warning: "#eab308",
  danger: "#ef4444",
};

// Particle component floating in the water pipe
type Particle = { id: number; y: number; size: number; speed: number; opacity: number };

function WaterPipe({
  flowing,
  color,
  width = 120,
  showParticles,
  label,
}: {
  flowing: boolean;
  color: string;
  width?: number;
  showParticles: boolean;
  label?: string;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (!flowing) {
      setParticles([]);
      return;
    }
    const interval = setInterval(() => {
      idRef.current += 1;
      const p: Particle = {
        id: idRef.current,
        y: 4 + Math.random() * 12,
        size: showParticles ? 2 + Math.random() * 3 : 1,
        speed: 0.8 + Math.random() * 0.6,
        opacity: 0.4 + Math.random() * 0.5,
      };
      setParticles((prev) => [...prev.slice(-12), p]);
    }, 120);
    return () => clearInterval(interval);
  }, [flowing, showParticles]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative overflow-hidden rounded-full border-2"
        style={{
          width,
          height: 24,
          borderColor: flowing ? color : "#374151",
          background: flowing ? `${color}22` : "#111827",
          boxShadow: flowing ? `0 0 12px ${color}55` : "none",
          transition: "all 0.5s",
        }}
      >
        {/* Flow stream */}
        {flowing && (
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: `linear-gradient(90deg, transparent, ${color}99, ${color}, ${color}99, transparent)`, width: "60%" }}
            animate={{ x: ["-60%", `${width}px`] }}
            transition={{ duration: 1.2 / 1, repeat: Infinity, ease: "linear" as const }}
          />
        )}
        {/* Particles */}
        <AnimatePresence>
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                top: p.y,
                background: showParticles ? "#92400e" : color,
                opacity: p.opacity,
              }}
              initial={{ x: 0 }}
              animate={{ x: width + 10 }}
              exit={{ opacity: 0 }}
              transition={{ duration: p.speed, ease: "linear" as const }}
            />
          ))}
        </AnimatePresence>
      </div>
      {label && <span className="text-[9px] text-muted-foreground tracking-wider font-mono">{label}</span>}
    </div>
  );
}

type ComponentNode = {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  active: boolean;
  color: string;
  pulse?: boolean;
};

function SystemNode({ node, waterColor }: { node: ComponentNode; waterColor: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        className="relative w-16 h-16 rounded-2xl border-2 flex items-center justify-center"
        animate={{
          borderColor: node.active ? node.color : "#374151",
          boxShadow: node.active ? `0 0 18px ${node.color}55, inset 0 0 10px ${node.color}22` : "none",
          backgroundColor: node.active ? `${node.color}15` : "#0f172a",
        }}
        transition={{ duration: 0.4 }}
      >
        {/* Spinning ring for pump */}
        {node.id === "pump" && node.active && (
          <motion.div
            className="absolute inset-1 rounded-xl border-2 border-dashed"
            style={{ borderColor: node.color }}
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" as const }}
          />
        )}
        {/* Pulse ring */}
        {node.pulse && node.active && (
          <motion.div
            className="absolute inset-0 rounded-2xl border-2"
            style={{ borderColor: node.color }}
            animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
        <div style={{ color: node.active ? node.color : "#4b5563", position: "relative", zIndex: 1 }}>
          {node.icon}
        </div>
        {/* Water color dot */}
        {node.id === "output" && node.active && (
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full border border-background"
            animate={{ backgroundColor: waterColor, boxShadow: `0 0 8px ${waterColor}` }}
          />
        )}
      </motion.div>
      <div className="text-center">
        <div className="text-[10px] font-bold tracking-widest" style={{ color: node.active ? node.color : "#6b7280" }}>
          {node.label.toUpperCase()}
        </div>
        <div className="text-[9px] text-muted-foreground tracking-wider">{node.sublabel}</div>
      </div>
    </div>
  );
}

export default function Simulation() {
  const [pumpOn, setPumpOn] = useState(true);
  const [tds, setTds] = useState(245);
  const [turbidity, setTurbidity] = useState(0.8);
  const [ph, setPh] = useState(7.2);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTds((v) => Math.max(50, Math.min(900, v + (Math.random() - 0.5) * 25)));
      setTurbidity((v) => Math.max(0, Math.min(10, v + (Math.random() - 0.5) * 0.4)));
      setPh((v) => Math.max(4, Math.min(11, v + (Math.random() - 0.5) * 0.12)));
      setTick((t) => t + 1);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const waterColor = getWaterColor(tds, turbidity);
  const isDirty = turbidity > 1 || tds > 300;
  const isReturning = tds > 500 || turbidity > 20 || ph < 6.5 || ph > 8.5;
  const showParticles = turbidity > 2;

  const tdsStatus = getStatus(tds, "tds");
  const turbStatus = getStatus(turbidity, "turbidity");
  const phStatus = getStatus(ph, "ph");

  const nodes: ComponentNode[] = [
    {
      id: "tank",
      label: "Water Tank",
      sublabel: isDirty ? "Raw Water" : "Source",
      icon: <Droplets className="w-7 h-7" />,
      active: true,
      color: isDirty ? "#dc2626" : "#22c55e",
    },
    {
      id: "filter",
      label: "Filter",
      sublabel: pumpOn ? "Active" : "Standby",
      icon: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M3 4h18l-7 8v6l-4-2V12L3 4z" />
        </svg>
      ),
      active: pumpOn,
      color: "#8b5cf6",
      pulse: true,
    },
    {
      id: "sensors",
      label: "Sensors",
      sublabel: "Monitoring",
      icon: <Wind className="w-7 h-7" />,
      active: pumpOn,
      color: "#eab308",
      pulse: true,
    },
    {
      id: "pump",
      label: "Pump",
      sublabel: pumpOn ? "Running" : "Stopped",
      icon: <Zap className="w-7 h-7" />,
      active: pumpOn,
      color: pumpOn ? "#22c55e" : "#ef4444",
    },
    {
      id: "output",
      label: "Output",
      sublabel: isReturning ? "Return Flow" : isDirty ? "Treatment Req." : "Clean Water",
      icon: (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 2C6 2 2 8 2 14a10 10 0 0020 0C22 8 18 2 12 2z" />
          <path d="M12 6v8m0 0l-3-3m3 3l3-3" />
        </svg>
      ),
      active: pumpOn,
      color: isReturning ? "#ef4444" : isDirty ? "#dc2626" : "#22c55e",
    },
  ];

  const pipeProps = {
    flowing: pumpOn,
    color: waterColor,
    showParticles,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-widest text-primary uppercase">Real-Time Operation View</h2>
          <p className="text-xs text-muted-foreground tracking-wider">
            Live visualization of the water treatment process — similar to industrial SCADA systems
          </p>
        </div>
        <Button
          onClick={() => setPumpOn((v) => !v)}
          className="shrink-0 font-bold tracking-widest cursor-pointer text-xs"
          style={{
            background: pumpOn ? "#ef444422" : "#22c55e22",
            color: pumpOn ? "#ef4444" : "#22c55e",
            border: `1px solid ${pumpOn ? "#ef4444" : "#22c55e"}`,
          }}
        >
          <Power className="w-3.5 h-3.5 mr-1.5" />
          {pumpOn ? "STOP PUMP" : "START PUMP"}
        </Button>
      </div>

      {/* System status banner */}
      <motion.div
        className="rounded-lg border px-4 py-2 flex items-center gap-3"
        animate={{
          borderColor: pumpOn ? (isDirty ? "#eab308" : "#22c55e") : "#ef4444",
          background: pumpOn ? (isDirty ? "#eab30812" : "#22c55e12") : "#ef444412",
        }}
      >
        <motion.div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          animate={{
            backgroundColor: pumpOn ? (isDirty ? "#eab308" : "#22c55e") : "#ef4444",
            boxShadow: pumpOn ? `0 0 8px ${isDirty ? "#eab308" : "#22c55e"}` : "0 0 8px #ef4444",
            opacity: [1, 0.4, 1],
          }}
          transition={{ opacity: { duration: 1, repeat: Infinity } }}
        />
        <span
          className="text-xs font-bold tracking-widest"
          style={{ color: pumpOn ? (isDirty ? "#eab308" : "#22c55e") : "#ef4444" }}
        >
          {!pumpOn
            ? "PUMP STOPPED — SYSTEM IDLE"
            : isDirty
              ? "SYSTEM ACTIVE — WATER TREATMENT IN PROGRESS"
              : "SYSTEM ACTIVE — OUTPUT CLEAN"}
        </span>
      </motion.div>

      {/* Main flow diagram */}
      <Card className="overflow-x-auto">
        <CardContent className="pt-6 pb-6">
          {/* Desktop horizontal layout */}
          <div className="hidden md:flex items-center justify-between gap-0 min-w-[700px]">
            {nodes.map((node, i) => (
              <div key={node.id} className="flex items-center gap-0">
                <SystemNode node={node} waterColor={waterColor} />
                {i < nodes.length - 1 && (
                  <div className="mx-2 mt-[-18px]">
                    <WaterPipe {...pipeProps} width={80} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile vertical layout */}
          <div className="flex md:hidden flex-col items-center gap-0">
            {nodes.map((node, i) => (
              <div key={node.id} className="flex flex-col items-center">
                <SystemNode node={node} waterColor={waterColor} />
                {i < nodes.length - 1 && (
                  <div className="my-1 rotate-90">
                    <WaterPipe {...pipeProps} width={60} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Water quality indicator */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">WATER QUALITY INDICATOR</div>
          <div className="flex items-center gap-4">
            <motion.div
              className="w-16 h-16 rounded-full border-4 flex items-center justify-center shrink-0"
              animate={{
                borderColor: waterColor,
                boxShadow: `0 0 24px ${waterColor}66, inset 0 0 16px ${waterColor}33`,
                background: `${waterColor}22`,
              }}
              transition={{ duration: 0.5 }}
            >
              <Droplets className="w-7 h-7" style={{ color: waterColor }} />
            </motion.div>
            <div className="flex-1">
              <motion.div
                className="font-bold tracking-widest text-sm"
                animate={{ color: waterColor }}
              >
                {turbidity > 4 || tds > 600
                  ? "CONTAMINATED — TREATMENT REQUIRED"
                  : turbidity > 1 || tds > 300
                    ? "MARGINAL — WITHIN TREATMENT RANGE"
                    : "CLEAN — SAFE FOR OUTPUT"}
              </motion.div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { label: "TDS", value: `${tds.toFixed(0)} ppm`, status: tdsStatus },
                  { label: "Turbidity", value: `${turbidity.toFixed(2)} NTU`, status: turbStatus },
                  { label: "pH", value: ph.toFixed(2), status: phStatus },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-[9px] tracking-widest text-muted-foreground">{s.label}</div>
                    <div className="font-mono text-sm font-bold" style={{ color: STATUS_COLOR[s.status] }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Return flow indicator */}
      <AnimatePresence>
        {isReturning && pumpOn && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-lg border border-red-500/40 bg-red-500/8 p-3 flex items-center gap-3"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" as const }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </motion.div>
            <div className="flex-1">
              <div className="text-xs font-bold tracking-widest text-red-400">RETURN FLOW ACTIVE</div>
              <div className="text-[10px] text-muted-foreground">
                Water quality below threshold — recirculating back to filter unit for re-treatment
              </div>
            </div>
            <div className="text-[9px] font-mono text-red-300 shrink-0 hidden sm:block">
              TDS:{tds.toFixed(0)} | NTU:{turbidity.toFixed(2)} | pH:{ph.toFixed(2)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Treatment stages legend */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { stage: "01", label: "INTAKE", desc: "Raw water collected from source", color: isDirty ? "#dc2626" : "#22c55e", active: true },
          { stage: "02", label: "FILTRATION", desc: "Suspended particles removed", color: "#8b5cf6", active: pumpOn },
          { stage: "03", label: "SENSING", desc: "TDS, turbidity & pH measured", color: "#eab308", active: pumpOn },
          { stage: "04", label: "PUMPING", desc: "Water pressurized and moved", color: pumpOn ? "#22c55e" : "#ef4444", active: pumpOn },
          { stage: "05", label: "OUTPUT", desc: "Treated water delivered", color: isDirty ? "#dc2626" : "#22c55e", active: pumpOn },
        ].map((s) => (
          <div
            key={s.stage}
            className="rounded-lg border p-3"
            style={{
              borderColor: s.active ? `${s.color}55` : "oklch(0.25 0.04 145)",
              background: s.active ? `${s.color}0d` : "transparent",
            }}
          >
            <div className="text-[9px] tracking-widest font-bold" style={{ color: s.active ? s.color : "#4b5563" }}>
              STAGE {s.stage} — {s.label}
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* Turbidity particles visualizer */}
      {showParticles && pumpOn && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-lg border border-orange-500/30 bg-orange-500/8 p-3 flex items-center gap-3"
        >
          <FlaskConical className="w-4 h-4 text-orange-400 shrink-0" />
          <div>
            <div className="text-xs font-bold tracking-widest text-orange-400">HIGH TURBIDITY DETECTED</div>
            <div className="text-[10px] text-muted-foreground">
              Suspended particles visible in water flow. Turbidity: {turbidity.toFixed(2)} NTU — filtration active.
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
