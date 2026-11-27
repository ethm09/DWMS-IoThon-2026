import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { buildIntelligenceReport, downloadIntelligencePdf, intelligenceReportCsv, type IntelligenceReportScope } from "@/lib/intelligence-report";
import type { IntelligenceOptions, IntelligenceReading } from "@/lib/intelligence";

type Props = Omit<IntelligenceOptions,"now"> & {readings: readonly IntelligenceReading[];now?:number};
const scopes: {value:IntelligenceReportScope;label:string}[]=[{value:"summary",label:"Water quality summary"},{value:"daily",label:"Daily report"},{value:"weekly",label:"Weekly report"},{value:"incident",label:"Incident review"},{value:"trends",label:"Historical trends"},{value:"device",label:"Device performance review"}];

/** Uses available evidence only; no backend fetch, AI spend or equipment action. */
export function IntelligenceReport({readings,...options}:Props) {
  const [open,setOpen]=useState(false), [scope,setScope]=useState<IntelligenceReportScope>("summary"), [busy,setBusy]=useState(false);
  const now=options.now??Date.now();
  const report=buildIntelligenceReport({...options,readings,now,scope});
  async function download(format:"csv"|"pdf") {
    if(busy)return;
    setBusy(true);
    try {
      if(format==="pdf") await downloadIntelligencePdf(report);
      else {
        const blob=new Blob([intelligenceReportCsv(report)],{type:"text/csv;charset=utf-8"});
        const url=URL.createObjectURL(blob),anchor=document.createElement("a");
        anchor.href=url;anchor.download=`DWMS-${scope}-${report.generatedAt.slice(0,10)}.csv`;
        document.body.append(anchor);anchor.click();anchor.remove();
        window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
      toast.success(`${format.toUpperCase()} report exported`);
    } catch { toast.error("The report could not be exported. Try again."); }
    finally {setBusy(false);}
  }
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm" className="min-h-11 gap-2"><FileDown className="h-4 w-4"/>Export report</Button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Ethm evidence report</DialogTitle><DialogDescription>Analytical summaries of available records. No equipment commands or AI requests are made.</DialogDescription></DialogHeader>
      <label className="grid gap-2 text-sm font-medium">Report type<select aria-label="Report type" className="min-h-11 rounded-lg border border-border bg-background px-3" value={scope} onChange={event=>setScope(event.target.value as IntelligenceReportScope)}>{scopes.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
      <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
        <p className="font-semibold">{options.source==="DEMO"?"Simulated demonstration evidence":"Device-reported Live evidence"}</p>
        <p>{report.coverageNote}</p>
        <p className="text-muted-foreground">{report.assessment.samples.length} valid timestamped records · {report.assessment.freshness}. Missing channels remain unavailable. Forecasts, when supported, are experimental estimates.</p>
        <p>{report.assessment.summary}</p>
      </div>
      <p className="text-sm text-muted-foreground">PDF uses English report labels; CSV preserves Unicode identifiers. Neither format certifies water safety or physical device performance.</p>
      <div className="flex flex-wrap gap-3"><Button className="min-h-11 gap-2" disabled={busy} onClick={()=>void download("pdf")}>{busy&&<Loader2 className="h-4 w-4 animate-spin"/>}Download PDF</Button><Button className="min-h-11" variant="outline" disabled={busy} onClick={()=>void download("csv")}>Download CSV</Button></div>
    </DialogContent>
  </Dialog>;
}
