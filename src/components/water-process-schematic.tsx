import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { Activity, Brain, ChevronDown } from "lucide-react";
import { openEthmQuestion } from "@/lib/ethm-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { classifyPh, classifyTds, classifyTurbidity } from "@/lib/dwms-safety";
import type { WaterReading } from "@/lib/monitoring";

type ProcessNode = "source" | "sensors" | "controller" | "pump" | "filter" | "monitor";
type ProcessProps = {
  demo: boolean; connected: boolean; pumpOn: boolean | null; emergency: boolean;
  reading?: (WaterReading & { flowRate?: number }) | null;
  history?: Array<{ turbidity: number }>;
  mode?: string;
};
const BLUE = "#087EA4";
const CYAN = "#18C5D9";
const NAVY = "#142B40";
const MUTED = "#6B8193";
const NODES: ProcessNode[] = ["source", "sensors", "controller", "pump", "filter", "monitor"];
const LABELS: Record<ProcessNode, string> = { source: "Water source", sensors: "Sensor array", controller: "Arduino controller", pump: "Pump response", filter: "Filtration", monitor: "Monitoring platform" };

/** An interactive engineering schematic, with conceptual treatment separated from measured telemetry. */
export default function WaterProcessSchematic({ demo, connected, pumpOn, emergency, reading, history = [], mode = "auto" }: ProcessProps) {
  const [selected, setSelected] = useState<ProcessNode>("pump");
  const [showDetails, setShowDetails] = useState(false);
  const id = useId().replace(/:/g, "");
  const outputLabel = emergency ? "STOP LATCHED" : pumpOn === null ? "UNKNOWN" : pumpOn ? "PUMP ON" : "PUMP OFF";
  const responseColor = emergency ? "#D14343" : pumpOn ? BLUE : MUTED;
  const telemetryColor = connected ? BLUE : "#ADBCC7";
  const value = (key: keyof WaterReading, digits = 1) => connected && reading && Number.isFinite(reading[key]) ? reading[key].toFixed(digits) : "—";
  const severityColor = (key: keyof WaterReading) => {
    if (!connected || !reading || !Number.isFinite(reading[key])) return MUTED;
    const status = key === "ph" ? classifyPh(reading.ph) : key === "tds" ? classifyTds(reading.tds) : classifyTurbidity(reading.turbidity);
    return status === "critical" ? "#D14343" : status === "warning" ? "#B77917" : BLUE;
  };
  const graph = history.slice(-12).filter((point) => Number.isFinite(point.turbidity));
  const highest = Math.max(5, ...graph.map((point) => point.turbidity));
  const graphPoints = graph.map((point, index) => `${20 + index / Math.max(graph.length - 1, 1) * 72},${56 - point.turbidity / highest * 31}`).join(" ");
  const descriptions: Record<ProcessNode, string> = {
    source: "A sampling point in a water network, reservoir or reuse system. The tank is a process symbol; no water-level measurement is available.",
    sensors: `pH ${value("ph", 2)}, TDS ${value("tds", 0)} ppm, turbidity ${value("turbidity")} NTU. ${demo ? "These are the current scenario inputs." : "Values are available only with fresh device telemetry; probe accuracy requires calibration evidence."}`,
    controller: `${mode.toUpperCase()} mode${emergency ? "; emergency latched" : ""}. Arduino interlocks and deterministic backend rules govern commands. USB serial and the Python HTTPS bridge connect the controller to Convex.`,
    pump: `${outputLabel}. ${demo ? "This is the scenario response; no relay is operated." : "This state comes from controller software acknowledgement, not a pump-motion or relay-contact sensor."}`,
    filter: "Prototype treatment concept. The pump/filtration response is shown for demonstration; installed treatment equipment, removal efficiency and water-safety outcomes require physical validation.",
    monitor: "Convex validates and stores device readings and streams dashboard updates. The small trend uses available recorded turbidity points. Ethm interprets monitoring evidence for operators; independent deterministic controls enforce safety.",
  };
  const activate = (node: ProcessNode) => { setSelected(node); setShowDetails(true); };
  const keyActivate = (event: KeyboardEvent<SVGGElement>, node: ProcessNode) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(node); }
  };
  function nodeShape(node: ProcessNode, diagramId: string): ReactNode {
    switch (node) {
      case "source": return <>
        <rect x="11" y="7" width="88" height="64" rx="7" fill={`url(#${diagramId}-water)`} stroke={BLUE} strokeWidth="1.8" />
        <path d="M12 38Q26 31 40 38T68 38T98 38M12 51Q26 44 40 51T68 51T98 51" fill="none" stroke={CYAN} strokeWidth="1.5" />
        <path d="M7 74H103M23 75V81M87 75V81" stroke={MUTED} strokeWidth="2" />
        <path d="M35 14H76" stroke="white" strokeWidth="3" opacity=".8" />
      </>;
      case "sensors": return <>
        <path d="M10 43H100" stroke="#CFDFE8" strokeWidth="15" strokeLinecap="round" />
        <path d="M10 43H100" stroke={CYAN} strokeWidth="5" strokeLinecap="round" />
        {[{ x: 27, name: "pH", key: "ph" as const }, { x: 55, name: "TDS", key: "tds" as const }, { x: 83, name: "NTU", key: "turbidity" as const }].map((channel) => <g key={channel.key}>
          <rect x={channel.x - 10} y="4" width="20" height="25" rx="4" fill="#F3F8FB" stroke={severityColor(channel.key)} strokeWidth="1.6" />
          <path d={`M${channel.x} 29V43`} stroke={severityColor(channel.key)} strokeWidth="3" />
          <circle cx={channel.x} cy="43" r="3" fill={severityColor(channel.key)} />
          <text x={channel.x} y="-4" textAnchor="middle" fontSize="10" fill={MUTED}>{channel.name}</text>
          <text x={channel.x} y="21" textAnchor="middle" fontSize="9" fontWeight="600" fill={severityColor(channel.key)}>{value(channel.key, channel.key === "tds" ? 0 : 1)}</text>
        </g>)}
      </>;
      case "controller": return <>
        <rect x="9" y="9" width="92" height="64" rx="7" fill="#EAF4F7" stroke={telemetryColor} strokeWidth="1.8" />
        <rect x="37" y="23" width="36" height="33" rx="3" fill="#0B2039" />
        {[0, 1, 2, 3].map((pin) => <g key={pin}><path d={`M${43 + pin * 8} 18V24M${43 + pin * 8} 56V62M31 ${29 + pin * 7}H37M73 ${29 + pin * 7}H79`} stroke={BLUE} strokeWidth="2" /></g>)}
        <circle cx="22" cy="22" r="3" fill={emergency ? "#D14343" : connected ? "#27A578" : MUTED} />
        <text x="55" y="44" textAnchor="middle" fontSize="10" fill="white" fontWeight="600">UNO</text>
        <rect x="14" y="53" width="12" height="10" rx="2" fill="#B4C8D5" />
        <rect x="86" y="53" width="9" height="10" rx="2" fill="#B4C8D5" />
      </>;
      case "pump": return <>
        <path d="M8 43H29M81 43H103" stroke="#C4D9E5" strokeWidth="13" /><path d="M8 43H29M81 43H103" stroke={responseColor} strokeWidth="4" />
        <path d="M26 78H85M36 65L31 77M74 65L79 77" stroke={NAVY} strokeWidth="2" />
        <circle cx="55" cy="43" r="27" fill="#F0F7FA" stroke={responseColor} strokeWidth="2" />
        <circle cx="55" cy="43" r="20" fill="white" stroke="#C9DDE7" />
        <g className={demo && pumpOn && !emergency ? "dwms-pump-rotor" : ""} style={{ transformOrigin: "55px 43px" }}>
          <path d="M55 43C34 31 47 20 55 28V43C76 31 80 47 67 50L55 43C55 68 38 62 42 51Z" fill={responseColor} opacity=".8" />
        </g>
        <circle cx="55" cy="43" r="5" fill={responseColor} />
      </>;
      case "filter": return <>
        <path d="M4 43H31M79 43H106" stroke="#C4D9E5" strokeWidth="13" /><path d="M4 43H31M79 43H106" stroke={BLUE} strokeWidth="4" />
        <rect x="31" y="5" width="48" height="72" rx="17" fill="#F0F7FA" stroke={BLUE} strokeWidth="1.8" />
        <path d="M33 24H77M32 52H78" stroke="#B2CCD9" />
        <rect x="34" y="29" width="42" height="19" fill={`url(#${diagramId}-media)`} />
        <path d="M45 78L41 84M65 78L69 84" stroke={MUTED} strokeWidth="2" />
        <path d="M40 12H69" stroke="white" strokeWidth="3" />
      </>;
      case "monitor": return <>
        <rect x="7" y="9" width="97" height="62" rx="6" fill="white" stroke={telemetryColor} strokeWidth="1.8" />
        <rect x="14" y="16" width="83" height="45" rx="2" fill="#F0F7FA" />
        <path d="M18 30H93M18 43H93M18 56H93" stroke="#D7E6ED" strokeWidth=".7" />
        {graph.length > 1 ? <polyline points={graphPoints} fill="none" stroke={BLUE} strokeWidth="2" strokeLinejoin="round" /> : <><circle cx="55" cy="43" r="4" fill={telemetryColor} /><text x="55" y="57" textAnchor="middle" fontSize="8" fill={MUTED}>{graph.length ? "1 recorded point" : "Awaiting data"}</text></>}
        <path d="M55 72V82M35 83H75" stroke={MUTED} strokeWidth="2" />
      </>;
    }
  }
  function schematic(mobile: boolean) {
    const diagramId = `${id}-${mobile ? "mobile" : "desktop"}`;
    const positions: Record<ProcessNode, { x: number; y: number }> = mobile
      ? { source: { x: 13, y: 20 }, sensors: { x: 204, y: 20 }, controller: { x: 13, y: 143 }, pump: { x: 204, y: 143 }, filter: { x: 13, y: 266 }, monitor: { x: 204, y: 266 } }
      : { source: { x: 20, y: 148 }, sensors: { x: 183, y: 148 }, controller: { x: 354, y: 22 }, pump: { x: 354, y: 148 }, filter: { x: 534, y: 148 }, monitor: { x: 720, y: 22 } };
    const waterPath = mobile ? "M123 63H214M304 63H316V186H304M214 186H174Q156 186 156 211V283Q156 309 130 309H123" : "M119 191H364M455 191H544M640 191H807";
    const telemetryPath = mobile ? "M231 35V12H154Q139 12 139 31V125Q139 153 111 164M124 184H204M124 184H145Q167 184 167 208V286Q167 306 191 306H211" : "M238 162V61H363M455 61H727M409 95V164";
    return <svg className={`block h-auto w-full ${mobile ? "sm:hidden" : "hidden sm:block"}`} viewBox={mobile ? "0 0 330 392" : "0 0 860 277"} role="group" aria-label="Interactive water monitoring engineering schematic">
      <defs>
        <linearGradient id={`${diagramId}-water`} x1="0" y1="0" x2="0" y2="1"><stop offset="35%" stopColor="#F4FAFC" /><stop offset="36%" stopColor="#C6EFF3" /><stop offset="100%" stopColor="#E1F3F8" /></linearGradient>
        <pattern id={`${diagramId}-media`} width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#DAEDF4" /><circle cx="2" cy="2" r="1.1" fill="#7DB9CF" /></pattern>
        <marker id={`${diagramId}-arrow`} markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke={BLUE} strokeWidth="1.2" /></marker>
      </defs>
      <path d={waterPath} fill="none" stroke="#D4E5EE" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
      <path d={waterPath} fill="none" stroke={emergency ? "#B6C9D5" : CYAN} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {demo && pumpOn && !emergency && <path d={waterPath} className="dwms-process-flow" fill="none" stroke="white" strokeWidth="2" strokeDasharray="4 13" strokeLinecap="round" />}
      <path d={telemetryPath} fill="none" stroke={telemetryColor} strokeWidth="1.5" strokeDasharray="4 4" strokeLinejoin="round" markerEnd={`url(#${diagramId}-arrow)`} />
      {!mobile && <><text x="527" y="49" fill={MUTED} fontSize="11">USB bridge / authenticated HTTPS</text><text x="715" y="211" fill={MUTED} fontSize="10">conceptual outlet</text></>}
      {NODES.map((node) => {
        const position = positions[node];
        const active = selected === node;
        return <g key={node} transform={`translate(${position.x} ${position.y})`} role="button" tabIndex={0} aria-label={`${LABELS[node]}. ${node === "pump" ? outputLabel : "Select for component details"}`} aria-pressed={active} onClick={() => activate(node)} onKeyDown={(event) => keyActivate(event, node)} className="dwms-process-node cursor-pointer outline-none">
          <title>{`${LABELS[node]}: ${descriptions[node]}`}</title>
          <rect x="0" y="0" width="112" height="87" rx="8" fill={active ? "#E4F3F8" : "transparent"} stroke={active ? "#90C7DA" : "transparent"} strokeWidth="1" />
          {nodeShape(node, diagramId)}
          <text x="55" y="104" textAnchor="middle" fontSize={mobile ? 12 : 12} fontWeight="600" fill={NAVY}>{LABELS[node]}</text>
          {node === "pump" && <text x="55" y="119" textAnchor="middle" fontSize="10" fontWeight="600" fill={responseColor}>{outputLabel}</text>}
          {node === "filter" && <text x="55" y="119" textAnchor="middle" fontSize="10" fill={MUTED}>prototype concept</text>}
        </g>;
      })}
    </svg>;
  }
  return <Card id="process" className="min-w-0 gap-2 scroll-mt-24 overflow-hidden shadow-none">
    <style>{`@keyframes dwms-flow{to{stroke-dashoffset:-34}}@keyframes dwms-rotor{to{transform:rotate(360deg)}}.dwms-process-node:focus-visible>rect:first-of-type{stroke:#087EA4;stroke-width:2}.dwms-process-flow{animation:dwms-flow 1.8s linear infinite}.dwms-pump-rotor{animation:dwms-rotor 2s linear infinite}@media(prefers-reduced-motion:reduce){.dwms-process-flow,.dwms-pump-rotor{animation:none}}`}</style>
    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 pb-0"><CardTitle className="text-sm">Water process & intelligence</CardTitle><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Activity className="h-3 w-3" />{demo ? "Scenario state" : connected ? "Recent telemetry" : "Awaiting telemetry"}</span></CardHeader>
    <CardContent className="px-3 pb-3">
      {schematic(false)}{schematic(true)}
      <button type="button" className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-left text-xs font-medium" aria-expanded={showDetails} onClick={() => setShowDetails(!showDetails)}><span>{LABELS[selected]} · details</span><ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} /></button>
      {showDetails && <div className="space-y-2 px-3 pt-2"><p className="text-xs leading-relaxed text-muted-foreground">{descriptions[selected]}</p><button type="button" className="inline-flex min-h-10 items-center gap-2 text-xs font-medium text-primary hover:underline" onClick={() => openEthmQuestion(`Explain the ${LABELS[selected].toLowerCase()} in this workspace using available evidence. Distinguish observed state, possible causes and operator checks; do not imply unverified physical operation.`)}><Brain className="h-3.5 w-3.5" />Ask Ethm about this component</button></div>}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground"><span><span className="mr-1.5 inline-block h-0.5 w-4 bg-cyan-500 align-middle" />Conceptual water path</span><span><span className="mr-1.5 inline-block w-4 border-t border-dashed border-primary align-middle" />Telemetry / control</span><span>{demo && reading?.flowRate !== undefined ? `Example flow ${reading.flowRate.toFixed(1)} L/min` : "Measured flow unavailable"}</span></div>
    </CardContent>
  </Card>;
}
