import { Brain, ChevronDown, Clock3, MessageSquareText, ShieldCheck } from "lucide-react";
import { analyzeIntelligence, type IntelligenceReading } from "@/lib/intelligence";
import { IntelligenceReport } from "@/components/intelligence-report";
import { openEthmQuestion } from "@/lib/ethm-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  readings: IntelligenceReading[];
  demo: boolean;
  now?: number;
  connected?: boolean;
  deviceId?: string;
  deviceName?: string;
  site?: string;
  emergencyLatched?: boolean;
};

const metricNames = { ph: "pH", tds: "TDS", turbidity: "Turbidity", flowRate: "Flow" } as const;
const metricUnits = { ph: "", tds: "ppm", turbidity: "NTU", flowRate: "L/min" } as const;

/** Telemetry facts and statistical indicators are distinct from requested model interpretations. */
export default function EthmIntelligencePanel({ readings, demo, now, connected, deviceId, deviceName, site, emergencyLatched = false }: Props) {
  const options = { source: demo ? "DEMO" as const : "LIVE" as const, now, connected, deviceId, site, emergencyLatched };
  const analysis = analyzeIntelligence(readings, options);
  const insights = analysis.insights.slice(0, 2);
  const primary = insights.find(item => item.severity === "critical") ?? insights.find(item => item.severity === "warning") ?? insights[0];
  const primaryAction = primary?.recommendation ?? (emergencyLatched
    ? "Preserve the emergency interlock and verify recovered evidence before an authorized operator acknowledges recovery."
    : "Review the available evidence and keep sensor calibration and maintenance records current.");
  const evidenceTime = analysis.evidenceTimestamp ? new Date(analysis.evidenceTimestamp) : null;
  const evidenceLabel = evidenceTime && Number.isFinite(evidenceTime.getTime()) ? evidenceTime.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "No timestamp available";
  const stateClass = emergencyLatched || analysis.quality === "critical" ? "border-red-200 bg-red-50 text-red-800" : analysis.quality === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-primary/20 bg-primary/5 text-foreground";
  const availableForecasts = Object.entries(analysis.forecasts).filter(([, forecast]) => forecast.status === "available");
  const prompts = emergencyLatched
    ? [{ label: "Explain incident", question: "Explain this incident and why recovery remains interlocked." }, { label: "Recovery checks", question: "What evidence should the operator verify before recovery?" }]
    : [{ label: "Explain changes", question: "Explain the current readings and significant changes." }, { label: "Possible causes", question: "What possible causes and operator checks fit the available evidence?" }];

  return <Card className="min-w-0 gap-4 overflow-hidden border-primary/25 shadow-none" aria-label="Ethm water intelligence">
    <CardHeader className="gap-3 px-4 pb-0 sm:px-5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white"><Brain className="h-5 w-5" /></span><div><CardTitle className="text-base">Ethm · Water Intelligence Engine</CardTitle><p className="mt-0.5 text-xs text-muted-foreground">Evidence first. Contextual AI when you ask.</p></div></div>
        <Button size="sm" className="min-h-10" onClick={() => openEthmQuestion("Assess the current water conditions, active incidents and operator priorities. Separate observed facts, possible causes and recommended checks.")}><MessageSquareText className="h-4 w-4" />Ask Ethm</Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{deviceName ?? deviceId ?? "No device selected"}{site ? ` · ${site}` : ""}</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{analysis.freshness.toUpperCase()} · {evidenceLabel}</span></div>
    </CardHeader>
    <CardContent className="space-y-4 px-4 pb-4 sm:px-5">
      <div className={`rounded-xl border px-3 py-3 ${stateClass}`}><p className="text-sm font-semibold">{analysis.summary}</p><p className="mt-1 text-sm leading-relaxed opacity-90">{analysis.operationalAssessment}</p></div>
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <section className="min-w-0"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Significant evidence</h3>{insights.length ? <ul className="mt-2 space-y-2">{insights.map(insight => <li className="border-l-2 border-primary/25 pl-3 text-sm leading-relaxed" key={insight.id}>{insight.fact}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No supported change assessment is available from the current records.</p>}</section>
        <section className="min-w-0"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operator priority</h3><p className="mt-2 text-sm leading-relaxed">{primaryAction}</p><p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />Recommendations are read-only. Independent deterministic controls enforce safety.</p></section>
      </div>
      <div className="flex flex-wrap gap-2">{prompts.map(prompt => <button key={prompt.label} type="button" className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm text-primary hover:bg-primary/5" onClick={() => openEthmQuestion(prompt.question)}><span>{prompt.label}</span><MessageSquareText className="h-3.5 w-3.5 shrink-0" /></button>)}</div>
      <details className="rounded-lg border border-border bg-muted/20 px-3 py-2.5"><summary className="flex min-h-7 cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium">Trend estimates & evidence limits<ChevronDown className="h-3.5 w-3.5" /></summary><div className="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground">
        {availableForecasts.length ? <>{availableForecasts.map(([key, forecast]) => <p key={key}><strong className="font-semibold text-foreground">{metricNames[key as keyof typeof metricNames]} estimate:</strong> {forecast.estimate?.toFixed(key === "ph" ? 2 : 1)} {metricUnits[key as keyof typeof metricUnits]} · nominal interval {forecast.lower?.toFixed(key === "ph" ? 2 : 1)}–{forecast.upper?.toFixed(key === "ph" ? 2 : 1)}. {forecast.estimatedAt ? `Estimated for ${new Date(forecast.estimatedAt).toLocaleTimeString()}. ` : ""}Based on {forecast.sampleCount} timestamped samples. This is not a measured future value.</p>)}<p>Local linear estimates use a nominal 95% residual-based interval; sensor accuracy and calibration uncertainty are not included. Future process changes may invalidate the model. No field predictive accuracy is established.</p></> : <p>Forecast unavailable: {analysis.forecasts.ph.reason} {demo ? "Short scenario sequences do not establish predictive performance." : "The current evidence window does not support an estimate."}</p>}
        {primary?.possibleCause && <p><strong className="font-semibold text-foreground">Possible cause, not a diagnosis:</strong> {primary.possibleCause}</p>}
        <p>{demo ? "These observations use isolated simulated scenario data." : "These observations use available device records; calibration and physical response remain separate validation steps."} Prototype operating bands are not regulatory limits or a drinking-water safety certification. This panel uses transparent statistical rules; model-generated interpretations appear separately in conversation.</p>
      </div></details>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><span className="text-xs text-muted-foreground">{readings.length} available {demo ? "scenario" : "stored"} samples · AI on request</span><IntelligenceReport readings={readings} {...options} /></div>
    </CardContent>
  </Card>;
}
