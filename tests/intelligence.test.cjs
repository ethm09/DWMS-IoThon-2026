const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const core = require(path.join(process.env.DWMS_TEST_BUILD_DIR, 'src/lib/intelligence.js'));
const report = require(path.join(process.env.DWMS_TEST_BUILD_DIR, 'src/lib/intelligence-report.js'));
const NOW = Date.parse('2026-11-27T12:00:00Z');
function sample(at, values={}) { return {timestamp:new Date(at).toISOString(),ph:7.2,tds:300,turbidity:2,flowRate:1.5,...values}; }
function windowData(count=31) { return Array.from({length:count},(_,i)=>sample(NOW-(count-1-i)*15000,{tds:250+i*1.6+[1.4,-1.1,0.5,-0.8,0][i%5]})); }
function analyze(rows, extra={}) { return core.analyzeIntelligence(rows,{source:'LIVE',now:NOW,connected:true,...extra}); }

test('normalization excludes future/conflicting samples and deduplicates observations without inventing Live flow',()=>{
 const old=sample(NOW-1000);
 const result=analyze([old,{...old},sample(NOW,{tds:350}),sample(NOW,{tds:450}),sample(NOW+1000)]);
 assert.equal(result.samples.length,1);assert.equal(result.duplicateRows,1);assert.equal(result.conflictingRows,2);assert.equal(result.rejectedRows,1);
 assert.equal(result.freshness,'invalid');assert.equal(result.quality,'unknown');assert.equal(result.samples[0].flowRate,undefined);
 assert.equal(new Set(result.insights.map(i=>i.id)).size,result.insights.length);
 assert.ok(Object.values(result.forecasts).every(f=>f.status!=='available'));
});

test('disconnected, stale, partial and overflow evidence never become current safety or predictive certainty',()=>{
 for(const [rows,extra,expected] of [
  [[sample(NOW)],{connected:false},'offline'],
  [[sample(NOW-15000)],{},'stale'],
  [[sample(NOW,{ph:undefined})],{},'invalid'],
  [[],{},'missing'],
 ]) {const r=analyze(rows,extra);assert.equal(r.freshness,expected);assert.equal(r.quality,'unknown');}
 const huge=analyze(windowData().map((row,i)=>({...row,tds:i%2?1e308:0})));
 assert.equal(huge.forecasts.tds.status,'unavailable');
 assert.doesNotMatch(JSON.stringify(huge),/NaN|Infinity/);
 const latched=analyze([sample(NOW)],{emergencyLatched:true});assert.ok(latched.insights.some(i=>i.id==='emergency-latch'));assert.match(latched.operationalAssessment,/recovery confirmation/);
});

test('historical indicators distinguish sampled repeated episodes, rapid change, trend and possible maintenance from diagnoses',()=>{
 const rows=Array.from({length:21},(_,i)=>sample(NOW-(20-i)*15000,{tds:300+i*12,turbidity:i%4===0?8:2}));
 const r=analyze(rows);
 assert.ok(r.insights.some(i=>i.kind==='trend'&&i.parameter==='tds'));
 assert.ok(r.insights.some(i=>i.kind==='rapid_change'&&i.parameter==='turbidity'));
 assert.ok(r.insights.some(i=>i.kind==='repeated_incident'&&i.parameter==='turbidity'));
 const maintenance=r.insights.find(i=>i.kind==='sensor_consistency'&&i.parameter==='ph');assert.ok(maintenance);assert.match(maintenance.possibleCause,/possible|not confirmed/);
 assert.equal(new Set(r.insights.map(i=>i.id)).size,r.insights.length);
});

test('forecast entry point enforces distinct current observations, stable timing and nonzero uncertainty',()=>{
 const valid=windowData();
 const f=core.statisticalForecast(valid.slice().reverse(),'tds',NOW,true);assert.equal(f.status,'available');assert.ok(f.lower<f.estimate&&f.upper>f.estimate);assert.ok(f.horizonMs<=60000);assert.match(f.reason,/not validated/);
 const duplicates=Array.from({length:30},()=>valid.at(-1));assert.notEqual(core.statisticalForecast(duplicates,'tds',NOW,true).status,'available');
 assert.notEqual(core.statisticalForecast([...valid,sample(NOW+1000)],'tds',NOW,true).status,'available');
 assert.notEqual(core.statisticalForecast([...valid,sample(NOW,{tds:1})],'tds',NOW,true).status,'available');
 assert.notEqual(core.statisticalForecast(valid,'tds',NOW+11000,true).status,'available');
 assert.notEqual(core.statisticalForecast(valid.slice(0,19),'tds',NOW,true).status,'available');
 for(const rows of [valid.map(row=>({...row,tds:300})),valid.map((row,i)=>({...row,tds:300+i}))]){
  const result=core.statisticalForecast(rows,'tds',NOW,true);assert.notEqual(result.status,'available');assert.match(result.reason,/zero-width|variability/);
 }
});

test('held-out synthetic linear fixture checks numerical extrapolation only, not field predictive accuracy',()=>{
 const rows=windowData();const f=core.statisticalForecast(rows,'tds',NOW,true);assert.equal(f.status,'available');
 const targetIndex=30+f.horizonMs/15000;const heldOut=250+targetIndex*1.6+0.6;
 assert.ok(Math.abs(f.estimate-heldOut)<3);assert.ok(f.lower<=heldOut&&heldOut<=f.upper);
 const noisy=windowData().map((row,i)=>({...row,tds:i%2?1000:1}));assert.notEqual(core.statisticalForecast(noisy,'tds',NOW,true).status,'available');
});

test('report scopes retain honest partial coverage, provenance and unavailable values without claiming daily uptime',()=>{
 const readings=[sample(NOW-8*24*3600000),sample(NOW-2*24*3600000),sample(NOW)];
 for(const scope of report.REPORT_SCOPES){const r=report.buildIntelligenceReport({readings,scope,source:'LIVE',now:NOW,connected:true,deviceId:'node-1'});assert.match(r.sourceLabel,/calibration/);assert.ok(r.notes.some(n=>/not regulatory/.test(n)));assert.equal(r.assessment.samples.at(-1).flowRate,undefined);
  if(scope==='daily'){assert.equal(r.assessment.samples.length,1);assert.equal(r.coverage,'partial');assert.match(r.coverageNote,/uptime are not established/);}
  if(scope==='weekly'){assert.equal(r.assessment.samples.length,2);assert.equal(r.coverage,'partial');}
 }
 const empty=report.buildIntelligenceReport({readings:[],source:'LIVE',scope:'incident',now:NOW});assert.equal(empty.coverage,'none');assert.equal(empty.assessment.quality,'unknown');
 const demo=report.buildIntelligenceReport({readings:[sample(NOW)],source:'DEMO',now:NOW});assert.match(demo.sourceLabel,/SIMULATED/);assert.match(report.intelligenceReportCsv(demo),/simulated/);
});

test('CSV prevents formula injection, preserves exact Unicode and exports one BOM with explicit source and estimation limits',()=>{
 for(const value of ['=HYPERLINK("https://example.com")',' +SUM(A1)','\t@SUM(A1)','\r\n-1+2','\u0000=1'])assert.match(report.escapeIntelligenceCsv(value),/^"'/);
 assert.equal(report.escapeIntelligenceCsv(12.5),'"12.5"');assert.equal(report.escapeIntelligenceCsv(Infinity),'""');assert.equal(report.escapeIntelligenceCsv('موقع المياه'),'"موقع المياه"');
 const r=report.buildIntelligenceReport({readings:windowData(),source:'DEMO',now:NOW,deviceId:'=1+1',site:'خزان'});const csv=report.intelligenceReportCsv(r);
 assert.equal(csv[0],'\ufeff');assert.notEqual(csv[1],'\ufeff');assert.match(csv,/"'=1\+1"/);assert.match(csv,/خزان/);assert.match(csv,/estimated/);assert.match(csv,/not a model-generated interpretation/);
 assert.equal(report.pdfEvidenceText('Aخ'),'A\\u{62e}');
});
