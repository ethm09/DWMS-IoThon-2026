import EthmAssistant from "@/components/ethm-assistant";
import { useProcessMode } from "@/hooks/use-process-mode";
import { useDemo } from "@/hooks/use-demo";
import { Brain, BookOpen, ShieldCheck } from "lucide-react";
import { WorkspaceLink as Link } from "@/components/workspace-link";
import { ETHM_KNOWLEDGE_SOURCES } from "../../../convex/knowledge";

export default function AIDecision() {
  const { dataMode, selectedDeviceId, sensorData } = useProcessMode();
  const { state } = useDemo();
  const demo = dataMode === "demo";
  const timestamp = demo ? state.updatedAt : sensorData?.timestamp;
  return <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
    <div className="flex items-start gap-3"><Brain className="mt-1 h-7 w-7 shrink-0 text-primary" /><div><p className="text-sm text-muted-foreground">DWMS intelligence core</p><h1 className="text-2xl font-semibold">Ethm · Water Intelligence Engine</h1><p className="mt-2 text-sm text-muted-foreground">Understand readings, investigate incidents and identify the next evidence to check.</p></div></div>
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm"><span>{demo ? `Scenario: ${state.scenario} · ${state.response.mode}` : selectedDeviceId ? `Selected device: ${selectedDeviceId}` : "No device selected · readings unavailable"}</span><span className="text-xs text-muted-foreground">{timestamp ? `Evidence updated ${new Date(timestamp).toLocaleString()}` : "Awaiting device evidence"}</span></div>
    <EthmAssistant embedded />
    <details className="rounded-xl border border-border bg-card px-4 py-3"><summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><BookOpen className="h-4 w-4 text-primary" />Reviewed reference library</summary><p className="mt-3 text-sm text-muted-foreground">Background references, not confirmation that every source was used in a response. Prototype operating bands are not regulatory limits. The applicable Saudi numerical standard, site permit and identified sensor manuals must be confirmed for the intended use.</p><ul className="mt-3 space-y-3 text-sm">{ETHM_KNOWLEDGE_SOURCES.map(source => <li key={source.id}><a className="text-primary underline underline-offset-2" href={source.url} target="_blank" rel="noopener noreferrer">{source.authority} · {source.title}</a><p className="mt-1 text-xs text-muted-foreground">{source.scope} · reference reviewed {source.reviewedAt}</p></li>)}</ul></details>
    <p className="flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Independent deterministic controls enforce safety. AI interpretations support operators; they cannot operate equipment or establish drinking-water safety.</p>
    <Link className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4" to="/dashboard">Return to monitoring</Link>
  </div>;
}
