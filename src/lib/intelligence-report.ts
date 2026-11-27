import { analyzeIntelligence, INTELLIGENCE_METRICS, METRIC_DETAILS, type IntelligenceAssessment, type IntelligenceOptions, type IntelligenceReading } from "./intelligence";

export const REPORT_SCOPES = ["summary", "daily", "weekly", "incident", "trends", "device"] as const;
export type IntelligenceReportScope = typeof REPORT_SCOPES[number];
export type IntelligenceReportInput = IntelligenceOptions & { readings: readonly IntelligenceReading[]; scope?: IntelligenceReportScope };
export type IntelligenceReportData = {
  title: string;
  scope: IntelligenceReportScope;
  device: string;
  site: string;
  generatedAt: string;
  sourceLabel: string;
  requestedFrom: string | null;
  requestedTo: string;
  availableFrom: string | null;
  availableTo: string | null;
  coverage: "partial" | "none" | "loaded_window";
  coverageNote: string;
  assessment: IntelligenceAssessment;
  notes: string[];
};
const titles: Record<IntelligenceReportScope,string>={summary:"Water intelligence summary",daily:"Daily water intelligence report",weekly:"Weekly water intelligence report",incident:"Sampled incident report",trends:"Historical trend analysis",device:"Device evidence summary"};

/** Reports use supplied records only; daily/weekly requests never imply complete historical retrieval. */
export function buildIntelligenceReport(input: IntelligenceReportInput): IntelligenceReportData {
  const now=input.now??Date.now(),scope=input.scope??"summary";
  const duration=scope==="daily"?24*60*60_000:scope==="weekly"?7*24*60*60_000:null;
  const from=duration===null?null:now-duration;
  const readings=from===null?input.readings:input.readings.filter(row=>Date.parse(row.timestamp)>=from && Date.parse(row.timestamp)<=now);
  const assessment=analyzeIntelligence(readings,{...input,now});
  const availableFrom=assessment.samples[0]?.timestamp??null,availableTo=assessment.samples[assessment.samples.length - 1]?.timestamp??null;
  const coverage=!assessment.samples.length?"none":duration===null?"loaded_window":"partial";
  return {title:titles[scope],scope,device:input.deviceId||"No device selected",site:input.site||"Not specified",generatedAt:new Date(now).toISOString(),sourceLabel:input.source==="DEMO"?"SIMULATED — browser demonstration records":"LIVE — device-reported telemetry; calibration/physical validity unverified",requestedFrom:from===null?null:new Date(from).toISOString(),requestedTo:new Date(now).toISOString(),availableFrom,availableTo,coverage,coverageNote:coverage==="none"?"No valid records are available in the requested window.":duration===null?"Only the loaded records are included; this is not a complete device audit or retention export.":"Partial coverage: only already-loaded records in this period are included. Full daily/weekly coverage, packet delivery and uptime are not established.",assessment,notes:["Prototype operating bands are not regulatory compliance limits. pH, TDS, turbidity and flow alone cannot establish drinking-water safety.","Summary/insight text is deterministic analytical output, not a model-generated interpretation or confirmed root-cause diagnosis.","Measured means reported Live telemetry; physical calibration/accuracy are not independently validated. Simulated values are synthetic; estimated values are statistical model outputs; blank channels are unavailable.","Flow is Demo-only. Sensor maintenance flags are possible checks, not confirmed faults. No report executes equipment commands.",...(scope==="incident"?["Episode counts come from sampled threshold crossings, not a complete confirmed incident/event log."]:[])]};
}

export function escapeIntelligenceCsv(value: string | number | null | undefined): string {
  let text=value==null || (typeof value==="number" && !Number.isFinite(value))?"":String(value);
  // Quoting alone does not stop spreadsheet formula execution. Numeric values stay numeric.
  const firstVisible=[...text].find(char=>char.charCodeAt(0)>32 && char.charCodeAt(0)!==127 && char.trim()!=="");
  if (typeof value==="string" && firstVisible && "=+-@".includes(firstVisible)) text="'"+text;
  return `"${text.replace(/"/g,'""')}"`;
}
export function intelligenceReportCsv(report: IntelligenceReportData): string {
  const rows:(string|number|null|undefined)[][]=[
    ["DWMS — Ethm Water Intelligence Engine",report.title],["Generated UTC",report.generatedAt],["Source",report.sourceLabel],["Device",report.device],["Site",report.site],
    ["Requested from UTC",report.requestedFrom??"Loaded window"],["Requested to UTC",report.requestedTo],["Available from UTC",report.availableFrom],["Available to UTC",report.availableTo],["Coverage",report.coverageNote],
    ["Current assessment",report.assessment.summary],["Freshness",report.assessment.freshness],["Operational assessment",report.assessment.operationalAssessment],[],
    ["Record type","Evidence UTC","pH","TDS (ppm)","Turbidity (NTU)","Flow (L/min)","Time basis","Server receipt UTC"],
    ...report.assessment.samples.map(row=>[report.assessment.source==="DEMO"?"simulated":"device-reported measurement",row.timestamp,row.ph,row.tds,row.turbidity,row.flowRate,row.timeBasis??(report.assessment.source==="DEMO"?"simulation":"unspecified"),row.receivedAt]),[],
    ["Insight severity","Observed fact","Possible cause (unconfirmed)","Recommended operator check","Evidence UTC"],
    ...report.assessment.insights.map(item=>[item.severity,item.fact,item.possibleCause,item.recommendation,item.evidenceTimes.join("; ")]),[],
    ["Record type","Parameter","Status","Estimated UTC","Estimate","Lower interval","Upper interval","Reason / method"],
    ...INTELLIGENCE_METRICS.map(key=>{const f=report.assessment.forecasts[key];return ["estimated",METRIC_DETAILS[key].label,f.status,f.estimatedAt,f.estimate,f.lower,f.upper,f.reason+(f.method?" "+f.method:"")];}),[],
    ...report.notes.map(note=>["Limitation",note]),
  ];
  return "\uFEFF"+rows.map(row=>row.map(escapeIntelligenceCsv).join(",")).join("\r\n");
}

/** Built-in PDF font is Latin; preserve non-Latin identifiers as explicit code-point escapes rather than corrupt text. CSV preserves exact Unicode. */
export function pdfEvidenceText(text: string): string {
  return [...text].map(char=>{const code=char.codePointAt(0)!;return code>=32&&code<=126?char:char==="\n"?char:`\\u{${code.toString(16)}}`;}).join("");
}
export async function downloadIntelligencePdf(report: IntelligenceReportData) {
  const {default:jsPDF}=await import("jspdf");
  const {default:autoTable}=await import("jspdf-autotable");
  const doc=new jsPDF({unit:"mm",format:"a4"});
  const left=15,width=180;
  let y=18;
  const line=(text:string,size=9,bold=false)=>{
    doc.setFont("helvetica",bold?"bold":"normal");doc.setFontSize(size);doc.setTextColor(20,43,64);
    const wrapped=doc.splitTextToSize(pdfEvidenceText(text),width) as string[];
    for(const part of wrapped){if(y>275){doc.addPage();y=18;}doc.text(part,left,y);y+=size*0.43+1.6;}
    y+=2;
  };
  line("DWMS | Ethm Water Intelligence Engine",17,true);line(report.title,13,true);line(report.sourceLabel,9,true);
  line(`Generated UTC: ${report.generatedAt}`);line(`Device: ${report.device} | Site: ${report.site}`);
  line(`Loaded evidence: ${report.availableFrom??"unavailable"} to ${report.availableTo??"unavailable"}`);
  line(report.coverageNote);line(report.assessment.summary,11,true);line(`Freshness: ${report.assessment.freshness}`);line(report.assessment.operationalAssessment);
  line("Observed evidence and operator checks",11,true);
  if(!report.assessment.insights.length)line("No analytical flag is supported by the loaded samples. This does not establish water safety.");
  for(const insight of report.assessment.insights){line(`${insight.severity.toUpperCase()}: ${insight.fact}`,9,true);if(insight.possibleCause)line(`Possible cause: ${insight.possibleCause}`);line(`Operator check: ${insight.recommendation}`);line(`Evidence UTC: ${insight.evidenceTimes.join(", ")||"unavailable"}`,8);}
  line("Statistical estimates (not measurements)",11,true);
  for(const key of INTELLIGENCE_METRICS){const f=report.assessment.forecasts[key];line(`${METRIC_DETAILS[key].label}: ${f.status==="available"?`${f.estimate!.toFixed(3)} ${METRIC_DETAILS[key].unit} at ${f.estimatedAt}; interval ${f.lower!.toFixed(3)} to ${f.upper!.toFixed(3)}`:f.status}. ${f.reason}`);if(f.method)line(f.method,8);}
  line("Limitations",11,true);for(const note of report.notes)line(note,8);
  if(/[^\x20-\x7E]/u.test(report.device+report.site))line("Non-Latin identifiers appear as explicit Unicode code-point escapes in this PDF; CSV preserves their exact original text.",8);
  if(report.assessment.samples.length){
    doc.addPage();y=18;line("Loaded evidence table",12,true);
    autoTable(doc,{startY:y,head:[["Evidence UTC","pH","TDS ppm","NTU","Flow L/min","Provenance"]],body:report.assessment.samples.map(row=>[row.timestamp,row.ph??"Unavailable",row.tds??"Unavailable",row.turbidity??"Unavailable",row.flowRate??"Unavailable",report.assessment.source==="DEMO"?"Simulated":"Reported telemetry"]),styles:{fontSize:7,textColor:[20,43,64],cellPadding:2},headStyles:{fillColor:[11,32,57],textColor:[255,255,255]},alternateRowStyles:{fillColor:[243,247,250]},margin:{left:15,right:15,top:18,bottom:20}});
  }
  for(let page=1;page<=doc.getNumberOfPages();page++){doc.setPage(page);doc.setFontSize(7);doc.setTextColor(100,120,139);doc.text(`DWMS | No water-safety certification | Page ${page}/${doc.getNumberOfPages()}`,15,290);}
  doc.save(`DWMS-${report.scope}-${report.generatedAt.slice(0,10)}.pdf`);
}
