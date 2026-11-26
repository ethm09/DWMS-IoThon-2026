import { THRESHOLDS } from "@/lib/dwms-safety.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ThresholdsPage() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl">
      <h1 className="text-xl font-bold">Deterministic safety rules</h1>
      <p className="text-sm text-muted-foreground">These are the deployed source-code defaults shared by the dashboard and backend. Site-specific limits require engineering review and a backend deployment. Browser settings cannot change them.</p>
      <Card><CardHeader><CardTitle>Prototype thresholds</CardTitle></CardHeader><CardContent className="overflow-x-auto">
        <table className="w-full text-sm text-left"><thead><tr><th className="p-2">Parameter</th><th className="p-2">Normal band</th><th className="p-2">Critical</th></tr></thead>
          <tbody>
            <tr><td className="p-2">pH</td><td className="p-2">{THRESHOLDS.ph.safe.min}–{THRESHOLDS.ph.safe.max}</td><td className="p-2">Below {THRESHOLDS.ph.critical.below} or above {THRESHOLDS.ph.critical.above}</td></tr>
            <tr><td className="p-2">TDS (ppm)</td><td className="p-2">Below {THRESHOLDS.tds.safe.max}</td><td className="p-2">Above {THRESHOLDS.tds.critical.above}</td></tr>
            <tr><td className="p-2">Turbidity (NTU)</td><td className="p-2">Below {THRESHOLDS.turbidity.safe.max}</td><td className="p-2">Above {THRESHOLDS.turbidity.critical.above}</td></tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">Readings between normal and critical bands raise a warning. Critical limits use strict inequalities; exact critical limits remain warnings.</p>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Response order</CardTitle></CardHeader><CardContent className="text-sm space-y-3">
        <p>1. Missing, invalid or stale readings cannot authorize a start. Fresh hardware data means a complete server-received reading no older than 10 seconds.</p>
        <p>2. Critical pH or turbidity requests pump OFF and latches Emergency. Recovery requires a fresh noncritical reading and operator acknowledgement.</p>
        <p>3. Auto requests pump ON when TDS exceeds {THRESHOLDS.tds.critical.above} ppm or turbidity exceeds {THRESHOLDS.turbidity.filtration.above} NTU, provided no emergency interlock applies. It requests OFF when those triggers clear.</p>
        <p>4. Manual starts require operator/admin authorization, fresh data and no critical pH or turbidity. OFF requests remain available during disconnection.</p>
        <p>5. A command is a request until the controller acknowledges it. Commands expire after 20 seconds. A software relay acknowledgement does not prove water flow or pump motion.</p>
      </CardContent></Card>
      <p className="rounded border border-amber-500/40 p-3 text-sm text-amber-500">Prototype operational rules, not drinking-water compliance limits. pH, TDS and turbidity do not establish microbiological safety or suitability for reuse. Filtration effectiveness, sensor calibration, relay polarity and fail-safe operation require physical validation.</p>
    </div>
  );
}
