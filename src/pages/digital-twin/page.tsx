import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Droplets, Activity, Zap, AlertTriangle, CheckCircle,
  Thermometer, RotateCcw, Eye, EyeOff, Maximize2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─── Types ───────────────────────────────────────────────────────────────────

type ComponentStatus = "normal" | "warning" | "danger" | "offline";

interface PlantComponent {
  id: string;
  label: string;
  sublabel: string;
  x: number; // percent of SVG viewBox
  y: number;
  status: ComponentStatus;
  value: string;
  unit: string;
}

interface FlowPath {
  id: string;
  points: string; // SVG polyline points
  active: boolean;
  isReturn: boolean;
  color: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ComponentStatus, string> = {
  normal: "#22c55e",
  warning: "#eab308",
  danger: "#ef4444",
  offline: "#4b5563",
};

const STATUS_GLOW: Record<ComponentStatus, string> = {
  normal: "0 0 18px #22c55e66",
  warning: "0 0 18px #eab30866",
  danger: "0 0 20px #ef444488",
  offline: "none",
};

function componentStatus(value: number, type: "tds" | "turbidity" | "ph" | "temp" | "flow" | "pressure"): ComponentStatus {
  if (type === "tds") return value < 300 ? "normal" : value < 500 ? "warning" : "danger";
  if (type === "turbidity") return value < 1 ? "normal" : value < 20 ? "warning" : "danger";
  if (type === "ph") return (value >= 6.5 && value <= 8.5) ? "normal" : (value >= 5.5 && value <= 9.5) ? "warning" : "danger";
  if (type === "temp") return value < 30 ? "normal" : value < 40 ? "warning" : "danger";
  if (type === "flow") return value > 60 ? "normal" : value > 30 ? "warning" : "danger";
  if (type === "pressure") return (value >= 2 && value <= 6) ? "normal" : "warning";
  return "normal";
}

// ─── SVG Animated Flow Pipe ───────────────────────────────────────────────────

function FlowPipe({
  x1, y1, x2, y2,
  active,
  isReturn = false,
  color,
  dashed = false,
}: {
  x1: number; y1: number; x2: number; y2: number;
  active: boolean;
  isReturn?: boolean;
  color: string;
  dashed?: boolean;
}) {
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

  return (
    <g>
      {/* Pipe body */}
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={active ? color : "#1f2937"}
        strokeWidth={active ? 6 : 4}
        strokeDasharray={dashed ? "8 6" : undefined}
        strokeLinecap="round"
        style={{
          filter: active ? `drop-shadow(0 0 4px ${color}88)` : undefined,
          transition: "stroke 0.4s, filter 0.4s",
        }}
      />
      {/* Animated flow dot */}
      {active && (
        <motion.circle
          r={4}
          fill={color}
          style={{ filter: `drop-shadow(0 0 5px ${color})` }}
          initial={{ cx: x1, cy: y1 }}
          animate={{ cx: isReturn ? [x2, x1] : [x1, x2], cy: isReturn ? [y2, y1] : [y1, y2] }}
          transition={{ duration: len / 80, repeat: Infinity, ease: "linear" as const }}
        />
      )}
    </g>
  );
}

// ─── Component Node (SVG) ─────────────────────────────────────────────────────

function TwinNode({
  cx, cy, label, sublabel, status, value, unit, icon, showLabels, pulse, spin,
}: {
  cx: number; cy: number;
  label: string; sublabel: string;
  status: ComponentStatus;
  value: string; unit: string;
  icon: React.ReactNode;
  showLabels: boolean;
  pulse?: boolean;
  spin?: boolean;
}) {
  const color = STATUS_COLOR[status];
  const glow = STATUS_GLOW[status];
  const r = 28;

  return (
    <g>
      {/* Pulse ring */}
      {pulse && status !== "offline" && (
        <motion.circle
          cx={cx} cy={cy} r={r + 4}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          animate={{ r: [r + 4, r + 14], opacity: [0.6, 0] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
      )}

      {/* Node body */}
      <motion.rect
        x={cx - r} y={cy - r}
        width={r * 2} height={r * 2}
        rx={10}
        fill={status !== "offline" ? `${color}18` : "#0f172a"}
        stroke={color}
        strokeWidth={2}
        animate={{ stroke: color }}
        style={{ filter: glow }}
      />

      {/* Spin ring for pump */}
      {spin && status !== "offline" && (
        <motion.rect
          x={cx - r + 4} y={cy - r + 4}
          width={(r - 4) * 2} height={(r - 4) * 2}
          rx={7}
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeDasharray="4 4"
          animate={{ rotate: 360 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" as const }}
        />
      )}

      {/* Danger flash */}
      {status === "danger" && (
        <motion.rect
          x={cx - r} y={cy - r}
          width={r * 2} height={r * 2}
          rx={10}
          fill={color}
          fillOpacity={0}
          animate={{ fillOpacity: [0, 0.12, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}

      {/* Foreign object for lucide icon */}
      <foreignObject x={cx - 12} y={cy - 12} width={24} height={24}>
        <div
          style={{ color, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}
        >
          {icon}
        </div>
      </foreignObject>

      {/* Labels */}
      {showLabels && (
        <>
          <text x={cx} y={cy + r + 14} textAnchor="middle" fontSize={9} fontWeight={700} letterSpacing={1.2} fill={color} fontFamily="Share Tech Mono, monospace">
            {label}
          </text>
          <text x={cx} y={cy + r + 24} textAnchor="middle" fontSize={8} fill="#6b7280" fontFamily="Share Tech Mono, monospace">
            {sublabel}
          </text>
          <text x={cx} y={cy - r - 8} textAnchor="middle" fontSize={9} fontWeight={700} fill={color} fontFamily="Share Tech Mono, monospace">
            {value} {unit}
          </text>
        </>
      )}
    </g>
  );
}

// ─── Anomaly Overlay ──────────────────────────────────────────────────────────

function AnomalyBadge({ cx, cy, message }: { cx: number; cy: number; message: string }) {
  return (
    <g>
      <motion.circle
        cx={cx + 22} cy={cy - 22} r={7}
        fill="#ef4444"
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 0.8, repeat: Infinity }}
        style={{ transformOrigin: `${cx + 22}px ${cy - 22}px` }}
      />
      <text x={cx + 22} y={cy - 19} textAnchor="middle" fontSize={8} fontWeight={900} fill="white" fontFamily="monospace">!</text>
    </g>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DigitalTwin() {
  const [tds, setTds] = useState(265);
  const [turbidity, setTurbidity] = useState(0.9);
  const [ph, setPh] = useState(7.1);
  const [temp, setTemp] = useState(22.5);
  const [flow, setFlow] = useState(78);
  const [pressure, setPressure] = useState(3.8);
  const [pumpOn, setPumpOn] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Simulate live data
  useEffect(() => {
    const id = setInterval(() => {
      setTds(v => Math.max(50, Math.min(800, v + (Math.random() - 0.46) * 28)));
      setTurbidity(v => Math.max(0, Math.min(35, v + (Math.random() - 0.46) * 2)));
      setPh(v => Math.max(4.5, Math.min(10, v + (Math.random() - 0.5) * 0.12)));
      setTemp(v => Math.max(15, Math.min(50, v + (Math.random() - 0.5) * 0.5)));
      setFlow(v => Math.max(10, Math.min(100, v + (Math.random() - 0.48) * 6)));
      setPressure(v => Math.max(0.5, Math.min(8, v + (Math.random() - 0.5) * 0.3)));
      setTick(t => t + 1);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const isReturning = pumpOn && (tds > 500 || turbidity > 20 || ph < 6.5 || ph > 8.5);
  const tankStatus = componentStatus(turbidity, "turbidity");
  const filterStatus: ComponentStatus = !pumpOn ? "offline" : componentStatus(tds, "tds");
  const sensorStatus: ComponentStatus = !pumpOn ? "offline" : "normal";
  const pumpStatus: ComponentStatus = !pumpOn ? "offline" : componentStatus(flow, "flow");
  const outputStatus: ComponentStatus = !pumpOn ? "offline" : isReturning ? "danger" : componentStatus(tds, "tds");
  const tempStatus = componentStatus(temp, "temp");

  // Node definitions (SVG coords in 800x400 viewBox)
  const nodes: Array<{ id: string; cx: number; cy: number; label: string; sublabel: string; status: ComponentStatus; value: string; unit: string; icon: React.ReactNode; pulse: boolean; spin: boolean }> = [
    { id: "reservoir", cx: 80, cy: 120, label: "RESERVOIR", sublabel: "Raw Source", status: tankStatus, value: turbidity.toFixed(2), unit: "NTU", icon: <Droplets size={20} />, pulse: false, spin: false },
    { id: "intake", cx: 200, cy: 120, label: "INTAKE PUMP", sublabel: pumpOn ? "Running" : "Stopped", status: pumpStatus, value: flow.toFixed(0), unit: "L/min", icon: <Zap size={20} />, pulse: false, spin: pumpOn },
    { id: "filter1", cx: 340, cy: 80, label: "PRE-FILTER", sublabel: "Stage 1", status: filterStatus, value: tds.toFixed(0), unit: "ppm", icon: <Activity size={20} />, pulse: pumpOn, spin: false },
    { id: "filter2", cx: 340, cy: 200, label: "POST-FILTER", sublabel: "Stage 2", status: filterStatus, value: turbidity.toFixed(2), unit: "NTU", icon: <Activity size={20} />, pulse: pumpOn, spin: false },
    { id: "sensor", cx: 490, cy: 140, label: "SENSOR ARRAY", sublabel: "Monitoring", status: sensorStatus, value: ph.toFixed(2), unit: "pH", icon: <Thermometer size={20} />, pulse: pumpOn, spin: false },
    { id: "pump", cx: 620, cy: 140, label: "MAIN PUMP", sublabel: pumpOn ? "Active" : "Offline", status: pumpStatus, value: pressure.toFixed(1), unit: "bar", icon: <Zap size={20} />, pulse: false, spin: pumpOn },
    { id: "output", cx: 740, cy: 140, label: "OUTPUT", sublabel: isReturning ? "Blocked" : "Delivering", status: outputStatus, value: isReturning ? "RETURN" : "CLEAN", unit: "", icon: <Droplets size={20} />, pulse: isReturning, spin: false },
    { id: "return", cx: 490, cy: 320, label: "RETURN LINE", sublabel: isReturning ? "Active" : "Standby", status: isReturning ? "danger" as ComponentStatus : "offline" as ComponentStatus, value: isReturning ? "ON" : "OFF", unit: "", icon: <RotateCcw size={20} />, pulse: isReturning, spin: false },
  ];

  // Flow pipes
  const pipes = [
    { id: "r-i", x1: 108, y1: 120, x2: 172, y2: 120, active: true, isReturn: false, color: tankStatus === "danger" ? "#ef4444" : "#22c55e" },
    { id: "i-f1", x1: 228, y1: 110, x2: 312, y2: 88, active: pumpOn, isReturn: false, color: "#8b5cf6" },
    { id: "i-f2", x1: 228, y1: 130, x2: 312, y2: 192, active: pumpOn, isReturn: false, color: "#8b5cf6" },
    { id: "f1-s", x1: 368, y1: 88, x2: 462, y2: 130, active: pumpOn, isReturn: false, color: "#8b5cf6" },
    { id: "f2-s", x1: 368, y1: 200, x2: 462, y2: 150, active: pumpOn, isReturn: false, color: "#8b5cf6" },
    { id: "s-p", x1: 518, y1: 140, x2: 592, y2: 140, active: pumpOn, isReturn: false, color: "#eab308" },
    { id: "p-o", x1: 648, y1: 140, x2: 712, y2: 140, active: pumpOn, isReturn: false, color: isReturning ? "#ef444466" : "#22c55e" },
    // Return line (dashed, bottom)
    { id: "ret-pump", x1: 620, y1: 168, x2: 620, y2: 290, active: isReturning, isReturn: true, color: "#ef4444" },
    { id: "ret-horiz", x1: 620, y1: 290, x2: 340, y2: 290, active: isReturning, isReturn: true, color: "#ef4444" },
    { id: "ret-up", x1: 340, y1: 290, x2: 340, y2: 228, active: isReturning, isReturn: true, color: "#ef4444" },
  ];

  // Anomaly nodes
  const anomalies = nodes.filter(n => n.status === "danger");

  // Selected node detail
  const detail = selectedNode ? nodes.find(n => n.id === selectedNode) : null;

  const detailRows: Record<string, { label: string; val: string; color: string }[]> = {
    reservoir: [
      { label: "Turbidity", val: `${turbidity.toFixed(2)} NTU`, color: STATUS_COLOR[componentStatus(turbidity, "turbidity")] },
      { label: "Temperature", val: `${temp.toFixed(1)} °C`, color: STATUS_COLOR[componentStatus(temp, "temp")] },
      { label: "Status", val: tankStatus.toUpperCase(), color: STATUS_COLOR[tankStatus] },
    ],
    intake: [
      { label: "Flow Rate", val: `${flow.toFixed(0)} L/min`, color: STATUS_COLOR[componentStatus(flow, "flow")] },
      { label: "Pump State", val: pumpOn ? "RUNNING" : "STOPPED", color: pumpOn ? "#22c55e" : "#ef4444" },
    ],
    filter1: [
      { label: "TDS In", val: `${(tds * 1.4).toFixed(0)} ppm`, color: "#eab308" },
      { label: "TDS Out", val: `${tds.toFixed(0)} ppm`, color: STATUS_COLOR[componentStatus(tds, "tds")] },
      { label: "Efficiency", val: "~72%", color: "#22c55e" },
    ],
    filter2: [
      { label: "Turbidity In", val: `${(turbidity * 2.1).toFixed(2)} NTU`, color: "#eab308" },
      { label: "Turbidity Out", val: `${turbidity.toFixed(2)} NTU`, color: STATUS_COLOR[componentStatus(turbidity, "turbidity")] },
      { label: "Efficiency", val: "~88%", color: "#22c55e" },
    ],
    sensor: [
      { label: "TDS", val: `${tds.toFixed(0)} ppm`, color: STATUS_COLOR[componentStatus(tds, "tds")] },
      { label: "Turbidity", val: `${turbidity.toFixed(2)} NTU`, color: STATUS_COLOR[componentStatus(turbidity, "turbidity")] },
      { label: "pH", val: ph.toFixed(2), color: STATUS_COLOR[componentStatus(ph, "ph")] },
      { label: "Temp", val: `${temp.toFixed(1)} °C`, color: STATUS_COLOR[componentStatus(temp, "temp")] },
    ],
    pump: [
      { label: "Pressure", val: `${pressure.toFixed(1)} bar`, color: STATUS_COLOR[componentStatus(pressure, "pressure")] },
      { label: "Flow Out", val: `${flow.toFixed(0)} L/min`, color: STATUS_COLOR[componentStatus(flow, "flow")] },
      { label: "State", val: pumpOn ? "RUNNING" : "OFFLINE", color: pumpOn ? "#22c55e" : "#ef4444" },
    ],
    output: [
      { label: "Quality", val: isReturning ? "FAIL — RETURNING" : tds < 300 ? "CLEAN" : "MARGINAL", color: isReturning ? "#ef4444" : tds < 300 ? "#22c55e" : "#eab308" },
      { label: "TDS", val: `${tds.toFixed(0)} ppm`, color: STATUS_COLOR[componentStatus(tds, "tds")] },
      { label: "pH", val: ph.toFixed(2), color: STATUS_COLOR[componentStatus(ph, "ph")] },
    ],
    return: [
      { label: "Return Active", val: isReturning ? "YES" : "NO", color: isReturning ? "#ef4444" : "#22c55e" },
      { label: "Trigger", val: tds > 500 ? "High TDS" : turbidity > 20 ? "High Turbidity" : ph < 6.5 || ph > 8.5 ? "pH Fault" : "None", color: isReturning ? "#ef4444" : "#6b7280" },
    ],
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-widest text-primary uppercase">Digital Twin</h2>
          <p className="text-xs text-muted-foreground tracking-wider">
            Live 2D replica of the physical treatment plant — click any component for details
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => setShowLabels(v => !v)}
            className="text-[10px] font-bold tracking-widest cursor-pointer"
            style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155" }}
          >
            {showLabels ? <Eye className="w-3.5 h-3.5 mr-1" /> : <EyeOff className="w-3.5 h-3.5 mr-1" />}
            {showLabels ? "LABELS" : "LABELS"}
          </Button>
          <Button
            size="sm"
            onClick={() => setPumpOn(v => !v)}
            className="text-[10px] font-bold tracking-widest cursor-pointer"
            style={{
              background: pumpOn ? "#ef444415" : "#22c55e15",
              color: pumpOn ? "#ef4444" : "#22c55e",
              border: `1px solid ${pumpOn ? "#ef4444" : "#22c55e"}`,
            }}
          >
            {pumpOn ? "STOP SYSTEM" : "START SYSTEM"}
          </Button>
        </div>
      </div>

      {/* Status bar */}
      <motion.div
        className="rounded-lg border px-4 py-2.5 flex items-center gap-3"
        animate={{
          borderColor: !pumpOn ? "#4b5563" : isReturning ? "#ef4444" : "#22c55e",
          background: !pumpOn ? "#1f293733" : isReturning ? "#ef444410" : "#22c55e10",
        }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          animate={{
            backgroundColor: !pumpOn ? "#4b5563" : isReturning ? "#ef4444" : "#22c55e",
            boxShadow: !pumpOn ? "none" : `0 0 8px ${isReturning ? "#ef4444" : "#22c55e"}`,
            opacity: pumpOn ? [1, 0.4, 1] : 1,
          }}
          transition={{ opacity: { duration: 1, repeat: Infinity } }}
        />
        <span className="text-xs font-bold tracking-widest"
          style={{ color: !pumpOn ? "#4b5563" : isReturning ? "#ef4444" : "#22c55e" }}>
          {!pumpOn
            ? "SYSTEM OFFLINE — ALL COMPONENTS IDLE"
            : isReturning
              ? "⚠ RETURN FLOW ACTIVE — QUALITY THRESHOLD EXCEEDED"
              : "ALL SYSTEMS NOMINAL — CLEAN OUTPUT DELIVERING"}
        </span>
        <div className="ml-auto text-[9px] font-mono text-muted-foreground hidden sm:block">
          TICK #{tick} · {new Date().toLocaleTimeString()}
        </div>
      </motion.div>

      {/* Twin SVG diagram */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative w-full" style={{ paddingBottom: "52%" }}>
            <svg
              viewBox="0 0 800 415"
              className="absolute inset-0 w-full h-full"
              style={{ background: "oklch(0.1 0.015 145)" }}
            >
              {/* Grid lines (subtle) */}
              {Array.from({ length: 16 }).map((_, i) => (
                <line key={`vg${i}`} x1={i * 50} y1={0} x2={i * 50} y2={415} stroke="#ffffff06" strokeWidth={1} />
              ))}
              {Array.from({ length: 9 }).map((_, i) => (
                <line key={`hg${i}`} x1={0} y1={i * 50} x2={800} y2={i * 50} stroke="#ffffff06" strokeWidth={1} />
              ))}

              {/* Section labels */}
              <text x={80} y={28} textAnchor="middle" fontSize={8} fill="#374151" fontFamily="Share Tech Mono, monospace" letterSpacing={2}>SOURCE</text>
              <text x={200} y={28} textAnchor="middle" fontSize={8} fill="#374151" fontFamily="Share Tech Mono, monospace" letterSpacing={2}>INTAKE</text>
              <text x={340} y={28} textAnchor="middle" fontSize={8} fill="#374151" fontFamily="Share Tech Mono, monospace" letterSpacing={2}>FILTRATION</text>
              <text x={490} y={28} textAnchor="middle" fontSize={8} fill="#374151" fontFamily="Share Tech Mono, monospace" letterSpacing={2}>SENSORS</text>
              <text x={620} y={28} textAnchor="middle" fontSize={8} fill="#374151" fontFamily="Share Tech Mono, monospace" letterSpacing={2}>PUMP</text>
              <text x={740} y={28} textAnchor="middle" fontSize={8} fill="#374151" fontFamily="Share Tech Mono, monospace" letterSpacing={2}>OUTPUT</text>
              {isReturning && (
                <text x={490} y={390} textAnchor="middle" fontSize={8} fill="#ef444488" fontFamily="Share Tech Mono, monospace" letterSpacing={2}>RETURN LINE</text>
              )}

              {/* Section dividers */}
              {[150, 270, 420, 560, 680].map(x => (
                <line key={x} x1={x} y1={40} x2={x} y2={370} stroke="#ffffff08" strokeWidth={1} strokeDasharray="4 6" />
              ))}

              {/* Pipes */}
              {pipes.map(p => (
                <FlowPipe key={p.id} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} active={p.active} isReturn={p.isReturn} color={p.color} dashed={p.isReturn} />
              ))}

              {/* Nodes */}
              {nodes.map(n => (
                <g
                  key={n.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedNode(s => s === n.id ? null : n.id)}
                >
                  <TwinNode
                    cx={n.cx} cy={n.cy}
                    label={n.label} sublabel={n.sublabel}
                    status={n.status}
                    value={n.value} unit={n.unit}
                    icon={n.icon}
                    showLabels={showLabels}
                    pulse={n.pulse}
                    spin={n.spin}
                  />
                  {n.status === "danger" && <AnomalyBadge cx={n.cx} cy={n.cy} message={n.label} />}
                  {/* Selection ring */}
                  {selectedNode === n.id && (
                    <motion.rect
                      x={n.cx - 36} y={n.cy - 36}
                      width={72} height={72} rx={14}
                      fill="none"
                      stroke="#60a5fa"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      animate={{ rotate: [0, 360] }}
                      style={{ transformOrigin: `${n.cx}px ${n.cy}px` }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" as const }}
                    />
                  )}
                </g>
              ))}

              {/* Return line label badge */}
              {isReturning && (
                <g>
                  <rect x={456} y={282} width={70} height={16} rx={4} fill="#ef444422" stroke="#ef444466" strokeWidth={1} />
                  <text x={491} y={294} textAnchor="middle" fontSize={8} fontWeight={700} fill="#ef4444" fontFamily="Share Tech Mono, monospace" letterSpacing={1.5}>RETURN</text>
                </g>
              )}
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Component detail panel */}
      <AnimatePresence>
        {detail && detailRows[detail.id] && (
          <motion.div
            key={detail.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="rounded-lg border p-4"
            style={{
              borderColor: `${STATUS_COLOR[detail.status]}55`,
              background: `${STATUS_COLOR[detail.status]}08`,
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLOR[detail.status], boxShadow: `0 0 6px ${STATUS_COLOR[detail.status]}` }} />
              <div className="text-xs font-bold tracking-widest" style={{ color: STATUS_COLOR[detail.status] }}>
                {detail.label}
              </div>
              <div className="text-[10px] text-muted-foreground tracking-wider">{detail.sublabel}</div>
              <button onClick={() => setSelectedNode(null)} className="ml-auto text-muted-foreground hover:text-foreground text-xs cursor-pointer">✕</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {detailRows[detail.id].map(row => (
                <div key={row.label} className="rounded-lg bg-background/60 border border-border px-3 py-2">
                  <div className="text-[9px] tracking-widest text-muted-foreground">{row.label}</div>
                  <div className="font-mono text-sm font-bold mt-0.5" style={{ color: row.color }}>{row.val}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: "TDS", value: `${tds.toFixed(0)}`, unit: "ppm", status: componentStatus(tds, "tds") },
          { label: "Turbidity", value: turbidity.toFixed(2), unit: "NTU", status: componentStatus(turbidity, "turbidity") },
          { label: "pH", value: ph.toFixed(2), unit: "", status: componentStatus(ph, "ph") },
          { label: "Temp", value: temp.toFixed(1), unit: "°C", status: componentStatus(temp, "temp") },
          { label: "Flow", value: flow.toFixed(0), unit: "L/min", status: componentStatus(flow, "flow") },
          { label: "Pressure", value: pressure.toFixed(1), unit: "bar", status: componentStatus(pressure, "pressure") },
        ].map(m => {
          const color = STATUS_COLOR[m.status];
          return (
            <div key={m.label} className="rounded-lg border border-border p-3 text-center">
              <div className="text-[9px] tracking-widest text-muted-foreground">{m.label}</div>
              <motion.div className="font-mono text-lg font-bold mt-0.5" animate={{ color }} transition={{ duration: 0.4 }}>
                {m.value}
              </motion.div>
              <div className="text-[9px] text-muted-foreground">{m.unit}</div>
              <motion.div className="mx-auto mt-1.5 w-12 h-1 rounded-full" animate={{ backgroundColor: color }} />
            </div>
          );
        })}
      </div>

      {/* Anomaly list */}
      <AnimatePresence>
        {anomalies.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-lg border border-red-500/30 bg-red-500/6 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <div className="text-xs font-bold tracking-widest text-red-400">ACTIVE ANOMALIES DETECTED</div>
            </div>
            <div className="space-y-2">
              {anomalies.map(a => (
                <div key={a.id} className="flex items-center gap-3 text-[10px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  <div className="text-red-300 font-bold tracking-wider">{a.label}</div>
                  <div className="text-muted-foreground">— {a.sublabel} · {a.value} {a.unit}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[9px] tracking-widest text-muted-foreground">
        {(["normal", "warning", "danger", "offline"] as ComponentStatus[]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border" style={{ borderColor: STATUS_COLOR[s], background: `${STATUS_COLOR[s]}22` }} />
            {s.toUpperCase()}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-1 rounded" style={{ background: "#ef4444", borderTop: "2px dashed #ef4444" }} />
          RETURN LINE
        </div>
        <div className="ml-auto text-[9px] text-muted-foreground">Click any component to inspect</div>
      </div>
    </div>
  );
}
