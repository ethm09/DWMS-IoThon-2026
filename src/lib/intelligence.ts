import { classifyPh, classifyTds, classifyTurbidity, classifyFlow } from "../../convex/safetyPolicy";

export const INTELLIGENCE_METRICS = ["ph", "tds", "turbidity", "flowRate"] as const;
export type IntelligenceMetric = typeof INTELLIGENCE_METRICS[number];
export type IntelligenceSource = "LIVE" | "DEMO";
export type IntelligenceReading = {
  timestamp: string;
  ph?: number | null;
  tds?: number | null;
  turbidity?: number | null;
  flowRate?: number | null;
  timeBasis?: string;
  receivedAt?: string;
};
export type IntelligenceOptions = {
  source: IntelligenceSource;
  now?: number;
  connected?: boolean;
  deviceId?: string;
  site?: string;
  emergencyLatched?: boolean;
};
export type IntelligenceInsight = {
  id: string;
  kind: "freshness" | "threshold" | "rapid_change" | "trend" | "repeated_incident" | "sensor_consistency";
  severity: "info" | "warning" | "critical";
  parameter?: IntelligenceMetric;
  fact: string;
  possibleCause?: string;
  recommendation: string;
  evidenceTimes: string[];
};
export type StatisticalForecast = {
  status: "available" | "insufficient_data" | "unavailable";
  reason: string;
  sampleCount: number;
  spanMs: number;
  horizonMs?: number;
  estimate?: number;
  lower?: number;
  upper?: number;
  estimatedAt?: string;
  method?: string;
};
export type MetricSummary = {
  count: number;
  latest: number | null;
  min: number | null;
  max: number | null;
  mean: number | null;
  change: number | null;
  episodes: number;
};
export type IntelligenceAssessment = {
  source: IntelligenceSource;
  generatedAt: string;
  evidenceTimestamp: string | null;
  freshness: "fresh" | "stale" | "offline" | "missing" | "invalid" | "simulated";
  quality: "normal" | "warning" | "critical" | "unknown";
  summary: string;
  operationalAssessment: string;
  insights: IntelligenceInsight[];
  metrics: Record<IntelligenceMetric, MetricSummary>;
  forecasts: Record<IntelligenceMetric, StatisticalForecast>;
  samples: IntelligenceReading[];
  rejectedRows: number;
  duplicateRows: number;
  conflictingRows: number;
  newestRejectedAt: string | null;
};
export const METRIC_DETAILS: Record<IntelligenceMetric, {label: string;unit: string;change: number;classify:(value: number)=>"safe"|"warning"|"critical"}> = {
  ph: { label: "pH", unit: "pH", change: 0.3, classify: classifyPh },
  tds: { label: "TDS", unit: "ppm", change: 100, classify: classifyTds },
  turbidity: { label: "Turbidity", unit: "NTU", change: 2, classify: classifyTurbidity },
  flowRate: { label: "Flow", unit: "L/min", change: 0.5, classify: classifyFlow },
};
export const FORECAST_MIN_SAMPLES = 20;
export const FORECAST_MIN_SPAN_MS = 5 * 60_000;
const FRESHNESS_MS = 10_000;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const validMetric = (key: IntelligenceMetric, value: unknown): value is number => finite(value) && value >= 0 && (key !== "ph" || value <= 14);
const short = (value: number) => Number(value.toFixed(3)).toString();

type Point = {time: number;value: number;timestamp: string};
function points(samples: readonly IntelligenceReading[], key: IntelligenceMetric): Point[] {
  return samples.filter(row => validMetric(key, row[key])).map(row => ({time: Date.parse(row.timestamp),value: row[key] as number,timestamp:row.timestamp}));
}

/** Duplicate acquisition times never count as additional statistical evidence. Conflicts are excluded. */
export function normalizeIntelligenceReadings(readings: readonly IntelligenceReading[], now: number, source: IntelligenceSource) {
  const groups = new Map<number, IntelligenceReading[]>();
  let rejectedRows = 0;
  let rejectedTime = -Infinity;
  for (const row of readings) {
    if (!row || typeof row !== "object") { rejectedRows++; continue; }
    const time = Date.parse(row.timestamp);
    if (!Number.isFinite(time) || time > now) { rejectedRows++; if (Number.isFinite(time)) rejectedTime=Math.max(rejectedTime,time); continue; }
    const sample: IntelligenceReading = {timestamp:new Date(time).toISOString(),timeBasis:row.timeBasis,receivedAt:row.receivedAt};
    for (const key of INTELLIGENCE_METRICS) {
      // Flow has no verified physical acquisition path in this prototype.
      if (key === "flowRate" && source === "LIVE") continue;
      if (validMetric(key,row[key])) sample[key]=row[key];
    }
    if (!INTELLIGENCE_METRICS.some(key => finite(sample[key]))) { rejectedRows++; rejectedTime=Math.max(rejectedTime,time); continue; }
    const rows = groups.get(time) ?? []; rows.push(sample); groups.set(time,rows);
  }
  let duplicateRows=0, conflictingRows=0;
  const samples: IntelligenceReading[]=[];
  for (const [, rows] of [...groups].sort(([a],[b])=>a-b)) {
    const values=(row:IntelligenceReading)=>INTELLIGENCE_METRICS.map(key=>row[key]??null).join("|");
    if (rows.some(row=>values(row)!==values(rows[0]))) { conflictingRows+=rows.length; rejectedTime=Math.max(rejectedTime,Date.parse(rows[0].timestamp)); continue; }
    duplicateRows+=rows.length-1; samples.push(rows[0]);
  }
  return {samples,rejectedRows,duplicateRows,conflictingRows,newestRejectedAt:Number.isFinite(rejectedTime)?new Date(rejectedTime).toISOString():null};
}

function regression(data: readonly Point[]) {
  const origin=data[0].time;
  const x=data.map(p=>(p.time-origin)/60_000), y=data.map(p=>p.value);
  const average=(values: number[])=>values.reduce((mean,value,index)=>mean+(value-mean)/(index+1),0);
  const meanX=average(x), meanY=average(y);
  const sxx=x.reduce((s,v)=>s+(v-meanX)**2,0);
  if (!sxx) return null;
  const slope=x.reduce((s,v,i)=>s+(v-meanX)*(y[i]-meanY),0)/sxx;
  const intercept=meanY-slope*meanX;
  const sse=y.reduce((s,v,i)=>s+(v-intercept-slope*x[i])**2,0);
  const sst=y.reduce((s,v)=>s+(v-meanY)**2,0);
  const r2=sst===0?1:Math.max(0,1-sse/sst);
  if (![origin,meanX,meanY,sxx,slope,intercept,sse,sst,r2].every(Number.isFinite)) return null;
  return {origin,meanX,meanY,sxx,slope,intercept,sse,r2};
}

/** Short-horizon ordinary least squares, deliberately gated; this is not an LLM forecast. */
export function statisticalForecast(samples: readonly IntelligenceReading[], key: IntelligenceMetric, now: number, currentAvailable: boolean): StatisticalForecast {
  if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) return {status:"unavailable",reason:"A valid analysis clock is required.",sampleCount:0,spanMs:0};
  // This exported entry point also validates callers outside analyzeIntelligence.
  // Sorting or duplicate timestamps must not inflate evidence or hide future rows.
  const normalized=normalizeIntelligenceReadings(samples,now,"DEMO");
  const latest=normalized.samples[normalized.samples.length - 1];
  const data=points(normalized.samples,key);
  const spanMs=data.length>1?data[data.length - 1]!.time-data[0].time:0;
  const base={sampleCount:data.length,spanMs};
  if (normalized.newestRejectedAt && (!latest || Date.parse(normalized.newestRejectedAt)>=Date.parse(latest.timestamp))) return {...base,status:"unavailable",reason:"Newest evidence is invalid, future-dated or conflicting; no forward estimate is shown."};
  if (!latest || !validMetric(key,latest[key])) return {...base,status:"unavailable",reason:"The current parameter value is unavailable; older channel values cannot establish a current forecast."};
  if (data.some(point=>Math.abs(point.value)>Number.MAX_SAFE_INTEGER)) return {...base,status:"unavailable",reason:"Values exceed supported numerical precision for the statistical model."};
  if (!currentAvailable) return {...base,status:"unavailable",reason:"Current device/sample state is unavailable or stale; no forward estimate is shown."};
  if (data.length<FORECAST_MIN_SAMPLES || spanMs<FORECAST_MIN_SPAN_MS) return {...base,status:"insufficient_data",reason:`Need at least ${FORECAST_MIN_SAMPLES} distinct valid samples spanning 5 minutes. Loaded samples do not establish forecast accuracy.`};
  if (now-data[data.length - 1]!.time>FRESHNESS_MS) return {...base,status:"unavailable",reason:"The latest sample is stale; no future estimate is shown."};
  const gaps=data.slice(1).map((p,i)=>p.time-data[i].time).sort((a,b)=>a-b);
  const median=gaps[Math.floor(gaps.length/2)];
  if (!median || gaps[gaps.length - 1]!>Math.max(median*5,30_000) || gaps[gaps.length - 1]!>spanMs/4) return {...base,status:"insufficient_data",reason:"Sampling gaps are too uneven for this short-horizon linear model."};
  const fit=regression(data);
  if (!fit || fit.r2<0.5) return {...base,status:"insufficient_data",reason:"A stable linear relationship is not supported by the loaded window."};
  const residualScale=Math.sqrt(fit.sse/(data.length-2));
  if (residualScale<=Number.EPSILON*Math.max(1,Math.abs(fit.meanY))*100) return {...base,status:"insufficient_data",reason:"The loaded series has negligible residual variability. A zero-width interval would not establish predictive certainty or sensor accuracy; more independent evidence is required."};
  const horizonMs=Math.min(60_000,spanMs/10);
  const predictionTime=data[data.length - 1]!.time+horizonMs;
  if (!Number.isFinite(new Date(predictionTime).getTime())) return {...base,status:"unavailable",reason:"The forecast target time is outside the supported timestamp range."};
  const at=(predictionTime-fit.origin)/60_000;
  const estimate=fit.intercept+fit.slope*at;
  // Conservative t value >= two-sided 95% critical value for df >=18.
  const residualVariance=fit.sse/(data.length-2);
  const margin=2.101*Math.sqrt(residualVariance*(1+1/data.length+(at-fit.meanX)**2/fit.sxx));
  const lower=estimate-margin, upper=estimate+margin;
  if (![estimate,lower,upper].every(Number.isFinite) || lower<0 || (key==="ph" && upper>14)) return {...base,status:"unavailable",reason:"The linear prediction interval leaves physical parameter bounds; no estimate is shown."};
  return {...base,status:"available",reason:"Experimental statistical estimate, not validated predictive performance. Interval reflects model residuals only; probe accuracy, calibration uncertainty and process changes are not covered.",horizonMs,estimate,lower,upper,estimatedAt:new Date(predictionTime).toISOString(),method:"Ordinary least squares; short horizon ≤60 seconds and ≤10% of observed span; nominal 95% residual-based prediction interval (conservative t=2.101)."};
}

export function analyzeIntelligence(readings: readonly IntelligenceReading[], options: IntelligenceOptions): IntelligenceAssessment {
  const now=options.now??Date.now();
  if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) throw new RangeError("A valid analysis clock is required.");
  const normalized=normalizeIntelligenceReadings(readings,now,options.source);
  const {samples}=normalized, latest=samples[samples.length - 1]??null;
  const age=latest?now-Date.parse(latest.timestamp):NaN;
  const complete=!!latest && ["ph","tds","turbidity"].every(key=>validMetric(key as IntelligenceMetric,latest[key as IntelligenceMetric]));
  const invalidCurrent=normalized.newestRejectedAt!==null && (!latest || Date.parse(normalized.newestRejectedAt)>=Date.parse(latest.timestamp));
  const freshness: IntelligenceAssessment["freshness"]=invalidCurrent?"invalid":!latest?"missing":!complete?"invalid":options.source==="DEMO"?"simulated":options.connected!==true || age>30_000?"offline":age>FRESHNESS_MS?"stale":"fresh";
  const available=complete && (freshness==="fresh"||freshness==="simulated");
  const levels=latest?[classifyPh(latest.ph??NaN),classifyTds(latest.tds??NaN),classifyTurbidity(latest.turbidity??NaN)]:[];
  const quality: IntelligenceAssessment["quality"]=!available?"unknown":levels.includes("critical")?"critical":levels.includes("warning")?"warning":"normal";
  const insights: IntelligenceInsight[]=[];
  const metrics={} as Record<IntelligenceMetric,MetricSummary>, forecasts={} as Record<IntelligenceMetric,StatisticalForecast>;
  for (const key of INTELLIGENCE_METRICS) {
    const data=points(samples,key), config=METRIC_DETAILS[key], last=data[data.length - 1];
    let episodes=0, active=false;
    for (const point of data) { const abnormal=config.classify(point.value)!=="safe"; if (abnormal&&!active) episodes++; active=abnormal; }
    metrics[key]={count:data.length,latest:last?.value??null,min:data.length?Math.min(...data.map(p=>p.value)):null,max:data.length?Math.max(...data.map(p=>p.value)):null,mean:data.length?data.reduce((mean,p,index)=>mean+(p.value-mean)/(index+1),0):null,change:data.length>1?last!.value-data[0].value:null,episodes};
    forecasts[key]=statisticalForecast(samples,key,now,available&&(key!=="flowRate"||options.source==="DEMO"));
    if (last && available && latest?.timestamp===last.timestamp && config.classify(last.value)!=="safe") insights.push({id:`threshold-${key}`,kind:"threshold",severity:config.classify(last.value)==="critical"?"critical":"warning",parameter:key,fact:`${config.label} is ${short(last.value)} ${config.unit}, outside its configured prototype operating band.`,possibleCause:"A process change, sampling disturbance, calibration drift or sensor fault may explain this reading; these possibilities are not diagnoses.",recommendation:"Confirm the reading with a calibrated reference and follow the site-approved incident procedure. Independent deterministic controls enforce equipment safety.",evidenceTimes:[last.timestamp]});
    if (data.length>=2) {
      const previous=data[data.length - 2]!, delta=last!.value-previous.value, elapsed=last!.time-previous.time;
      if (elapsed>=1000 && Math.abs(delta)>=config.change && Math.abs(delta)*60_000/elapsed>=config.change) insights.push({id:`rapid-${key}`,kind:"rapid_change",severity:"warning",parameter:key,fact:`${config.label} changed ${delta>=0?"+":""}${short(delta)} ${config.unit} over ${short(elapsed/1000)} seconds between the last two valid samples.`,possibleCause:"This may reflect a process change, sampling disturbance or probe/telemetry problem; the available data cannot distinguish them.",recommendation:"Check the sample source, timestamp continuity and a reference measurement. The rapid-change threshold is a prototype heuristic, not a calibrated detection specification.",evidenceTimes:[previous.timestamp,last!.timestamp]});
    }
    if (data.length>=6 && last!.time-data[0].time>=60_000) {
      const fit=regression(data);
      if (fit && fit.r2>=0.6 && Math.abs(fit.slope*(last!.time-data[0].time)/60_000)>=config.change) insights.push({id:`trend-${key}`,kind:"trend",severity:config.classify(last!.value)==="safe"?"info":"warning",parameter:key,fact:`The loaded ${config.label} window has an observed ${fit.slope>=0?"upward":"downward"} linear trend (${short(fit.slope)} ${config.unit}/min across ${data.length} samples).`,possibleCause:"A fitted historical trend does not establish its physical cause or future persistence.",recommendation:"Review the original chart and verify sampling conditions before drawing an operational conclusion.",evidenceTimes:[data[0].timestamp,last!.timestamp]});
    }
    if (episodes>=2) insights.push({id:`repeat-${key}`,kind:"repeated_incident",severity:"warning",parameter:key,fact:`${episodes} sampled out-of-range ${config.label} episodes appear in the loaded history, separated by in-range samples.`,possibleCause:"Recurring process variation or a probe/calibration issue is possible. Missing intervals may hide additional transitions.",recommendation:"Compare the sampled episodes with recorded incidents and maintenance logs; this is not a count of independently confirmed incidents.",evidenceTimes:[data[0].timestamp,last!.timestamp]});
    if (data.length>=12 && last!.time-data[0].time>=5*60_000 && metrics[key].min===metrics[key].max && INTELLIGENCE_METRICS.some(other=>other!==key && (()=>{const p=points(samples,other);return p.length>=2&&Math.max(...p.map(x=>x.value))-Math.min(...p.map(x=>x.value))>=METRIC_DETAILS[other].change;})())) insights.push({id:`flat-${key}`,kind:"sensor_consistency",severity:"info",parameter:key,fact:`${config.label} is identical across ${data.length} loaded samples while another parameter changes.`,possibleCause:"A truly stable parameter, output rounding, a frozen telemetry channel or probe maintenance need are possible; no fault is confirmed.",recommendation:"Inspect the raw channel and perform the manufacturer's calibration/reference check before assigning a maintenance fault.",evidenceTimes:[data[0].timestamp,last!.timestamp]});
  }
  if (options.emergencyLatched) insights.unshift({id:"emergency-latch",kind:"threshold",severity:"critical",fact:"The recorded Emergency interlock remains latched, even if sensor readings have recovered.",recommendation:"Follow the approved recovery checks and use the dedicated authorized recovery control. Ethm cannot clear the interlock or confirm physical shutdown.",evidenceTimes:latest?[latest.timestamp]:[]});
  if (!available) insights.unshift({id:"freshness",kind:"freshness",severity:"warning",fact:!latest?"No valid persisted sample is available.":freshness==="invalid"?"Newest sample evidence is invalid, incomplete or conflicting; current monitored conditions are unknown.":`Latest valid evidence is ${short(Math.max(0,age)/1000)} seconds old; ${options.connected===true?"its age exceeds the freshness policy":"device connectivity is not confirmed"}.`,recommendation:"Check device connectivity, gateway time and sensor availability. Keep last valid readings labeled historical; do not substitute simulation.",evidenceTimes:latest?[latest.timestamp]:[]});
  if (normalized.rejectedRows || normalized.conflictingRows) insights.push({id:"excluded-evidence",kind:"sensor_consistency",severity:"warning",fact:`${normalized.rejectedRows} invalid/future rows and ${normalized.conflictingRows} conflicting-timestamp rows were excluded from analysis.`,recommendation:"Review raw telemetry and timestamp/sequence validation before interpreting a trend. Excluded values are never repaired with invented measurements.",evidenceTimes:normalized.newestRejectedAt?[normalized.newestRejectedAt]:[]});
  const rank={critical:0,warning:1,info:2};insights.sort((a,b)=>rank[a.severity]-rank[b.severity]);
  return {source:options.source,generatedAt:new Date(now).toISOString(),evidenceTimestamp:latest?.timestamp??null,freshness,quality,summary:!available?"Current monitored conditions are unknown.":quality==="normal"?"Available monitored parameters are within prototype operating bands.":`${quality==="critical"?"Critical":"Warning"} readings need operator investigation.`,operationalAssessment:options.emergencyLatched?"Emergency recovery confirmation remains required. Physical equipment state requires fresh controller evidence.":!available?"Restore valid telemetry before assessing current operations.":"Review evidence and operator checks; independent deterministic rules retain control authority.",insights,metrics,forecasts,...normalized};
}
