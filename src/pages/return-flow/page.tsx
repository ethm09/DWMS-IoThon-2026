import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RotateCcw, ArrowRight, CheckCircle, AlertTriangle, Droplets, Activity, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type FlowState = "normal" | "returning" | "under_treatment";
type ReturnReason = "high_tds" | "high_turbidity" | "ph_imbalance" | null;

interface ReturnEvent {
  id: number;
  timestamp: string;
  reason: string;
  tds: number;
  turbidity: number;
  ph: number;
  cycleNumber: number;
}

function getFlowState(tds: number, turbidity: number, ph: number): FlowState {
  const isBad = tds > 500 || turbidity > 20 || ph < 6.5 || ph > 8.5;
  const isMarginal = tds > 300 || turbidity > 5 || ph < 7.0 || ph > 8.0;
  if (isBad) return "returning";
  if (isMarginal) return "under_treatment";
  return "normal";
}

function getReturnReason(tds: number, turbidity: number, ph: number): ReturnReason {
  if (tds > 500) return "high_tds";
  if (turbidity > 20) return "high_turbidity";
  if (ph < 6.5 || ph > 8.5) return "ph_imbalance";
  return null;
}

// Animated arrow showing direction
function FlowArrow({ direction, color, active }: { direction: "forward" | "return"; color: string; active: boolean }) {
  return (
    <motion.div
      className="flex items-center gap-1"
      animate={{ opacity: active ? 1 : 0.3 }}
    >
      {direction === "forward" ? (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rotate-45 border-r-2 border-b-2"
              style={{ borderColor: color }}
              animate={{ opacity: active ? [0.3, 1, 0.3] : 0.2 }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.25 }}
            />
          ))}
        </>
      ) : (
        <>
          {[2, 1, 0].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rotate-[225deg] border-r-2 border-b-2"
              style={{ borderColor: color }}
              animate={{ opacity: active ? [0.3, 1, 0.3] : 0.2 }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.25 }}
            />
          ))}
        </>
      )}
    </motion.div>
  );
}

// Pipe segment with animated flow
function AnimatedPipe({
  active,
  color,
  width = 80,
  reverse = false,
}: {
  active: boolean;
  color: string;
  width?: number;
  reverse?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-full border-2"
      style={{
        width,
        height: 18,
        borderColor: active ? color : "#374151",
        background: active ? `${color}22` : "#111827",
        boxShadow: active ? `0 0 10px ${color}55` : "none",
        transition: "all 0.5s",
      }}
    >
      {active && (
        <motion.div
          className="absolute inset-y-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}cc, transparent)`,
            width: "50%",
            left: reverse ? undefined : undefined,
          }}
          animate={{ x: reverse ? [`${width}px`, "-60%"] : ["-60%", `${width}px`] }}
          transition={{ duration: 1.0, repeat: Infinity, ease: "linear" as const }}
        />
      )}
    </div>
  );
}

const FLOW_CONFIG: Record<FlowState, { label: string; sublabel: string; color: string; icon: React.ReactNode; bg: string }> = {
  normal: {
    label: "NORMAL FLOW",
    sublabel: "Clean water flowing to output",
    color: "#22c55e",
    icon: <CheckCircle className="w-5 h-5" />,
    bg: "#22c55e12",
  },
  returning: {
    label: "RETURN FLOW ACTIVE",
    sublabel: "Water redirected back to filtration unit",
    color: "#ef4444",
    icon: <RotateCcw className="w-5 h-5" />,
    bg: "#ef444412",
  },
  under_treatment: {
    label: "UNDER TREATMENT",
    sublabel: "Marginal quality — additional processing in progress",
    color: "#eab308",
    icon: <Activity className="w-5 h-5" />,
    bg: "#eab30812",
  },
};

export default function ReturnFlowControl() {
  const [tds, setTds] = useState(260);
  const [turbidity, setTurbidity] = useState(4.5);
  const [ph, setPh] = useState(7.1);
  const [returnCycles, setReturnCycles] = useState(0);
  const [efficiency, setEfficiency] = useState(100);
  const [events, setEvents] = useState<ReturnEvent[]>([]);
  const [eventId, setEventId] = useState(0);
  const [prevState, setPrevState] = useState<FlowState>("normal");

  useEffect(() => {
    const interval = setInterval(() => {
      setTds((v) => Math.max(50, Math.min(800, v + (Math.random() - 0.45) * 35)));
      setTurbidity((v) => Math.max(0, Math.min(40, v + (Math.random() - 0.45) * 2.5)));
      setPh((v) => Math.max(4, Math.min(11, v + (Math.random() - 0.5) * 0.15)));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const flowState = getFlowState(tds, turbidity, ph);
  const returnReason = getReturnReason(tds, turbidity, ph);

  // Track return events
  useEffect(() => {
    if (flowState === "returning" && prevState !== "returning") {
      const newCycles = returnCycles + 1;
      setReturnCycles(newCycles);
      setEfficiency((e) => Math.max(60, e - 3 + Math.random() * 6));
      const reasonMap: Record<string, string> = {
        high_tds: `TDS exceeded threshold (${tds.toFixed(0)} ppm > 500 ppm)`,
        high_turbidity: `Turbidity critical (${turbidity.toFixed(1)} NTU > 20 NTU)`,
        ph_imbalance: `pH out of safe range (${ph.toFixed(2)})`,
      };
      const id = eventId + 1;
      setEventId(id);
      setEvents((prev) => [
        {
          id,
          timestamp: new Date().toLocaleTimeString(),
          reason: reasonMap[returnReason ?? "high_tds"] ?? "Quality threshold exceeded",
          tds: Number(tds.toFixed(0)),
          turbidity: Number(turbidity.toFixed(2)),
          ph: Number(ph.toFixed(2)),
          cycleNumber: newCycles,
        },
        ...prev.slice(0, 9),
      ]);
    }
    if (flowState === "normal" && prevState === "returning") {
      setEfficiency((e) => Math.min(100, e + 2));
    }
    setPrevState(flowState);
  }, [flowState]);

  const config = FLOW_CONFIG[flowState];
  const isReturning = flowState === "returning";
  const isNormal = flowState === "normal";

  const REASON_LABELS: Record<string, { label: string; color: string }> = {
    high_tds: { label: "High TDS", color: "#ef4444" },
    high_turbidity: { label: "High Turbidity", color: "#f97316" },
    ph_imbalance: { label: "pH Imbalance", color: "#8b5cf6" },
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold tracking-widest text-primary uppercase">Return Flow Control</h2>
        <p className="text-xs text-muted-foreground tracking-wider">
          Closed-loop recirculation system — water is returned to filtration if quality standards are not met
        </p>
      </div>

      {/* Status Banner */}
      <motion.div
        className="rounded-lg border px-4 py-3 flex items-center gap-3"
        animate={{
          borderColor: config.color,
          background: config.bg,
        }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          animate={{ color: config.color }}
          transition={{ duration: 0.3 }}
        >
          {config.icon}
        </motion.div>
        <div>
          <motion.div
            className="text-sm font-bold tracking-widest"
            animate={{ color: config.color }}
          >
            {config.label}
          </motion.div>
          <div className="text-[10px] text-muted-foreground tracking-wider">{config.sublabel}</div>
        </div>
        <motion.div
          className="ml-auto w-3 h-3 rounded-full shrink-0"
          animate={{
            backgroundColor: config.color,
            boxShadow: `0 0 8px ${config.color}`,
            opacity: [1, 0.3, 1],
          }}
          transition={{ opacity: { duration: 1, repeat: Infinity } }}
        />
      </motion.div>

      {/* Flow Diagram */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-5">FLOW DIRECTION DIAGRAM</div>

          {/* Desktop layout */}
          <div className="hidden md:block">
            {/* Main forward flow row */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {/* Tank */}
              <FlowNode label="WATER TANK" sublabel="Source" color="#22c55e" active={true} icon={<Droplets className="w-6 h-6" />} />
              <AnimatedPipe active={true} color="#22c55e" width={70} />
              {/* Filter */}
              <FlowNode label="FILTER UNIT" sublabel={isReturning ? "Re-processing" : "Active"} color="#8b5cf6" active={true} icon={
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 4h18l-7 8v6l-4-2V12L3 4z" /></svg>
              } pulse={isReturning} />
              <AnimatedPipe active={true} color="#eab308" width={70} />
              {/* Sensors */}
              <FlowNode label="SENSORS" sublabel="Monitoring" color="#eab308" active={true} icon={<Activity className="w-6 h-6" />} pulse={true} />
              <AnimatedPipe active={true} color={isNormal ? "#22c55e" : "#ef444488"} width={70} />
              {/* Pump */}
              <FlowNode label="PUMP" sublabel="Running" color="#22c55e" active={true} icon={
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 3" /></svg>
              } spin={true} />

              {/* Arrow/output based on flow state */}
              <div className="flex items-center gap-1 mx-1">
                <FlowArrow direction="forward" color={isNormal ? "#22c55e" : "#374151"} active={isNormal} />
              </div>

              {/* Output */}
              <motion.div
                className="flex flex-col items-center gap-2"
                animate={{ opacity: isNormal ? 1 : 0.4 }}
              >
                <motion.div
                  className="w-14 h-14 rounded-xl border-2 flex items-center justify-center"
                  animate={{
                    borderColor: isNormal ? "#22c55e" : "#374151",
                    boxShadow: isNormal ? "0 0 14px #22c55e55" : "none",
                    background: isNormal ? "#22c55e15" : "#0f172a",
                  }}
                >
                  <ArrowRight className="w-6 h-6" style={{ color: isNormal ? "#22c55e" : "#4b5563" }} />
                </motion.div>
                <div className="text-center">
                  <div className="text-[10px] font-bold tracking-widest" style={{ color: isNormal ? "#22c55e" : "#4b5563" }}>OUTPUT</div>
                  <div className="text-[9px] text-muted-foreground">{isNormal ? "Clean Water" : "Blocked"}</div>
                </div>
              </motion.div>
            </div>

            {/* Return path */}
            <AnimatePresence>
              {(isReturning) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex items-center justify-center gap-1 mt-1"
                >
                  <div className="text-[9px] text-red-400 tracking-widest font-bold mr-2">RETURN LINE</div>
                  <AnimatedPipe active={true} color="#ef4444" width={260} reverse={true} />
                  <RotateCcw className="w-4 h-4 text-red-400 ml-1" />
                  <div className="text-[9px] text-red-400 tracking-widest ml-1">→ BACK TO FILTER</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile layout */}
          <div className="flex md:hidden flex-col items-center gap-3">
            {[
              { label: "WATER TANK", sub: "Source", color: "#22c55e", icon: <Droplets className="w-5 h-5" /> },
              { label: "FILTER UNIT", sub: isReturning ? "Re-processing" : "Active", color: "#8b5cf6", icon: <RefreshCw className="w-5 h-5" /> },
              { label: "SENSORS", sub: "Monitoring", color: "#eab308", icon: <Activity className="w-5 h-5" /> },
              { label: "PUMP", sub: "Running", color: "#22c55e", icon: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 3" /></svg> },
            ].map((node, i) => (
              <div key={node.label} className="flex flex-col items-center">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ borderColor: `${node.color}55`, background: `${node.color}11` }}>
                  <div style={{ color: node.color }}>{node.icon}</div>
                  <div>
                    <div className="text-[10px] font-bold tracking-widest" style={{ color: node.color }}>{node.label}</div>
                    <div className="text-[9px] text-muted-foreground">{node.sub}</div>
                  </div>
                </div>
                {i < 3 && <div className="w-px h-4 bg-border" />}
              </div>
            ))}
            <motion.div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border"
              animate={{
                borderColor: isNormal ? "#22c55e55" : "#ef444455",
                background: isNormal ? "#22c55e11" : "#ef444411",
              }}
            >
              {isNormal ? (
                <ArrowRight className="w-5 h-5 text-green-400" />
              ) : (
                <RotateCcw className="w-5 h-5 text-red-400" />
              )}
              <div>
                <div className="text-[10px] font-bold tracking-widest" style={{ color: isNormal ? "#22c55e" : "#ef4444" }}>
                  {isNormal ? "OUTPUT" : "RETURNING"}
                </div>
                <div className="text-[9px] text-muted-foreground">
                  {isNormal ? "Clean water delivered" : "Back to filter unit"}
                </div>
              </div>
            </motion.div>
          </div>
        </CardContent>
      </Card>

      {/* Live Sensor Data & Return Reason */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sensor values */}
        <Card>
          <CardContent className="pt-5 pb-4 space-y-3">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground">LIVE SENSOR READINGS</div>
            {[
              { label: "TDS", value: tds.toFixed(0), unit: "ppm", threshold: 500, bad: tds > 500, warn: tds > 300 },
              { label: "Turbidity", value: turbidity.toFixed(2), unit: "NTU", threshold: 20, bad: turbidity > 20, warn: turbidity > 5 },
              { label: "pH Level", value: ph.toFixed(2), unit: "", threshold: null, bad: ph < 6.5 || ph > 8.5, warn: ph < 7.0 || ph > 8.0 },
            ].map((s) => {
              const color = s.bad ? "#ef4444" : s.warn ? "#eab308" : "#22c55e";
              return (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="text-[10px] tracking-widest text-muted-foreground w-20 shrink-0">{s.label}</div>
                  <div className="flex-1 rounded-full h-2 bg-muted/30 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: color }}
                      animate={{ width: s.label === "TDS" ? `${Math.min(100, (tds / 800) * 100)}%` : s.label === "Turbidity" ? `${Math.min(100, (turbidity / 40) * 100)}%` : `${((ph - 4) / 7) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="font-mono text-sm font-bold w-24 text-right" style={{ color }}>
                    {s.value} {s.unit}
                  </div>
                  <motion.div className="w-2 h-2 rounded-full shrink-0" animate={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
                </div>
              );
            })}

            {/* Return reason */}
            <AnimatePresence>
              {returnReason && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-lg border border-red-500/30 bg-red-500/8 p-3 flex items-start gap-2 overflow-hidden"
                >
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] font-bold tracking-widest text-red-400">RETURN TRIGGER DETECTED</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {REASON_LABELS[returnReason]?.label ?? "Quality threshold exceeded"} — water rerouted to filter
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Return counters */}
        <Card>
          <CardContent className="pt-5 pb-4 space-y-4">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground">RETURN FLOW METRICS</div>

            <div className="grid grid-cols-2 gap-3">
              {/* Return cycles */}
              <div className="rounded-lg border border-border p-3 text-center" style={{ borderColor: returnCycles > 0 ? "#ef444455" : undefined, background: returnCycles > 0 ? "#ef444408" : undefined }}>
                <div className="text-2xl font-bold font-mono" style={{ color: returnCycles > 0 ? "#ef4444" : "#6b7280" }}>
                  {returnCycles}
                </div>
                <div className="text-[9px] tracking-widest text-muted-foreground mt-1">RETURN CYCLES</div>
                <div className="text-[9px] text-muted-foreground">Total reprocess events</div>
              </div>

              {/* Efficiency */}
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="text-2xl font-bold font-mono" style={{ color: efficiency >= 90 ? "#22c55e" : efficiency >= 75 ? "#eab308" : "#ef4444" }}>
                  {efficiency.toFixed(0)}%
                </div>
                <div className="text-[9px] tracking-widest text-muted-foreground mt-1">EFFICIENCY</div>
                <div className="text-[9px] text-muted-foreground">System performance</div>
              </div>
            </div>

            {/* Efficiency bar */}
            <div>
              <div className="text-[9px] tracking-widest text-muted-foreground mb-1.5">SYSTEM EFFICIENCY INDICATOR</div>
              <div className="h-3 rounded-full bg-muted/30 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  animate={{
                    width: `${efficiency}%`,
                    backgroundColor: efficiency >= 90 ? "#22c55e" : efficiency >= 75 ? "#eab308" : "#ef4444",
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span>0%</span>
                <span>Optimal ≥ 90%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Logic table */}
            <div>
              <div className="text-[9px] tracking-widest text-muted-foreground mb-2">DECISION LOGIC</div>
              <div className="rounded-lg border border-border overflow-hidden">
                {[
                  { cond: "TDS > 500 ppm", action: "Return to filter", color: "#ef4444" },
                  { cond: "Turbidity > 20 NTU", action: "Return to filter", color: "#ef4444" },
                  { cond: "pH < 6.5 or > 8.5", action: "Return to filter", color: "#ef4444" },
                  { cond: "All within limits", action: "Send to output", color: "#22c55e" },
                ].map((row, i) => (
                  <div key={i} className="flex items-center border-b border-border last:border-0 px-3 py-1.5 gap-3">
                    <div className="text-[9px] font-mono text-muted-foreground flex-1">{row.cond}</div>
                    <div className="text-[9px] font-bold tracking-widest" style={{ color: row.color }}>→ {row.action.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Return event log */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="text-[10px] font-bold tracking-widest text-muted-foreground mb-3">RETURN FLOW EVENT LOG</div>
          {events.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-xs tracking-wider">
              No return events recorded — water quality within acceptable limits
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {events.map((ev) => (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-red-400 tracking-wider">CYCLE #{ev.cycleNumber} — {ev.timestamp}</div>
                      <div className="text-[9px] text-muted-foreground truncate">{ev.reason}</div>
                    </div>
                    <div className="text-[9px] font-mono text-muted-foreground shrink-0 hidden sm:block">
                      TDS:{ev.tds} | NTU:{ev.turbidity} | pH:{ev.ph}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Engineering note */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="text-[10px] font-bold tracking-widest text-primary mb-1">ENGINEERING PRINCIPLE</div>
        <p className="text-xs text-muted-foreground tracking-wide leading-relaxed">
          This system implements a{" "}
          <span className="text-primary font-semibold">closed-loop return flow mechanism</span> — water is
          only released to output once it meets all quality standards. This mirrors real industrial
          closed-loop treatment systems used in defense, municipal, and industrial water management.
        </p>
      </div>
    </div>
  );
}

// Local helper component
function FlowNode({
  label, sublabel, color, active, icon, pulse, spin,
}: {
  label: string;
  sublabel: string;
  color: string;
  active: boolean;
  icon: React.ReactNode;
  pulse?: boolean;
  spin?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.div
        className="relative w-14 h-14 rounded-xl border-2 flex items-center justify-center"
        animate={{
          borderColor: active ? color : "#374151",
          boxShadow: active ? `0 0 14px ${color}55` : "none",
          background: active ? `${color}15` : "#0f172a",
        }}
      >
        {spin && active && (
          <motion.div
            className="absolute inset-1 rounded-lg border-2 border-dashed"
            style={{ borderColor: color }}
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" as const }}
          />
        )}
        {pulse && active && (
          <motion.div
            className="absolute inset-0 rounded-xl border"
            style={{ borderColor: color }}
            animate={{ scale: [1, 1.25], opacity: [0.5, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
        <div style={{ color: active ? color : "#4b5563", position: "relative", zIndex: 1 }}>{icon}</div>
      </motion.div>
      <div className="text-center">
        <div className="text-[9px] font-bold tracking-widest" style={{ color: active ? color : "#6b7280" }}>{label}</div>
        <div className="text-[9px] text-muted-foreground">{sublabel}</div>
      </div>
    </div>
  );
}
