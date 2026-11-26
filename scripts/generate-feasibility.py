#!/usr/bin/env python3
"""Editable Saudi pilot decision model and feasibility report; authoring-only dependencies.
No financial cell is actual expenditure or a sales forecast. Run with Python/openpyxl,
python-docx and LibreOffice. Runtime DWMS dependencies are unchanged.
"""
from pathlib import Path
from datetime import date
import subprocess
import argparse
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.comments import Comment
from openpyxl.chart import BarChart, Reference
from docx import Document
from docx.shared import Inches, Pt, RGBColor

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'deliverables'
NAVY,BLUE,CYAN,INK='0B2039','087EA4','18C5D9','142B40'
REVIEW='26 November 2026'
SOURCES=[
 ('MEWA','Innovation Trends: Water Treatment and Reuse','https://www.mewa.gov.sa/en/Ministry/Agencies/AgencyForInnovation/Topics/Pages/slmReportI.aspx','Saudi policy relevance; not a market-size or purchase-commitment source.'),
 ('SAMA','Official exchange-rate policy, 3.75 SAR/USD','https://www.sama.gov.sa/en-US/MediaCenter/News/Pages/news-557.aspx','Reference conversion; excludes bank spreads, import duties, freight and tax.'),
 ('PH','DFRobot SEN0161-V2 catalog','https://www.dfrobot.com/product-1782.html','Illustrative candidate only: USD39.50; actual prototype model unknown.'),
 ('TDS','DFRobot SEN0244 catalog','https://www.dfrobot.com/product-1662.html','Illustrative candidate only: USD11.80; catalog range 0–1000 ppm, not validated prototype range.'),
 ('TURB','DFRobot SEN0189 catalog','https://www.dfrobot.com/product-1394.html','Illustrative candidate only: USD9.90; installation/NTU calibration must be verified.'),
 ('CAT','DFRobot liquid-sensor catalog','https://www.dfrobot.com/category-68.html','Cross-check of the three candidate single-unit prices; not procurement quotes.'),
 ('HACH','SC4500 controller and communications','https://www.hach.com/p-sc4500-controller-lan-ma-output-1-analog-upw-phorpsensor-100-240-vac-with-uk-plug/LXV525.99D0B701','Established controller/SCADA alternative; already offers monitoring/control. No uniqueness or price superiority claim.'),
 ('CONVEX','Current pricing','https://www.convex.dev/pricing','Free/Starter prototypes; USD25/developer/month Professional plus metered usage. Financial cloud budget is an assumption, not a bill.'),
 ('OPENAI','API pricing','https://openai.com/api/pricing/','Optional metered AI cost; usage/quota not a guaranteed service entitlement.'),
 ('EPA','Basic Information about Water Reuse','https://www.epa.gov/waterreuse/basic-information-about-water-reuse','Use-specific treatment and regulatory requirements; three channels alone do not establish safe reuse.'),
 ('PDPL','Saudi personal-data protection guidance','https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter','Review data classification, access, retention and cross-border obligations before a Saudi pilot.'),
 ('DWMS','Repository evidence','https://github.com/ethm09/DWMS-IoThon-2026/blob/improve/iothon-2026-focus/docs/VALIDATION.md','Software/simulation evidence and open account/physical gates.')]
# Qty, USD catalog (or None), SAR estimate (or None), basis/source.
BOM=[
 ('Uno-class controller',1,None,150,'Estimate; verify actual revision, do not replace existing working board.'),
 ('Candidate pH kit',1,39.50,None,'Catalog PH; not the identified installed probe.'),
 ('Candidate TDS interface/probe',1,11.80,None,'Catalog TDS; excludes temperature probe/industrial qualification.'),
 ('Candidate turbidity interface',1,9.90,None,'Catalog TURB; not in-line industrial qualification.'),
 ('Dedicated USB gateway computer',1,None,900,'Estimate; existing suitable host may be reused, not a confirmed cost.'),
 ('Power supply, protection and isolation',1,None,250,'Estimate; electrical design and quotes pending.'),
 ('Enclosure, connectors and low-pressure sampling parts',1,None,400,'Estimate; no certified installation or process piping included.'),
 ('Isolated command interface allocation',1,None,200,'Estimate only; no relay/load specified or enabled.'),
 ('Calibration references and consumables',1,None,300,'Estimate; select certified references after probe identification.'),
 ('Assembly/documentation/bench QA labour',1,None,450,'Estimate; labour rate and duration unverified.'),
]

def workbook():
 w=Workbook(); intro=w.active; intro.title='Read me'
 intro.append(['DWMS — illustrative SAR decision model','Status'])
 for row in [
  ('Purpose','Editable scenario arithmetic, not forecast, valuation, savings or ROI evidence.'),
  ('Evidence date',REVIEW),('Actual costs','No invoices or verified manufacturing costs supplied.'),
  ('Inputs','Blue text: editable assumptions. Catalog references do not identify installed hardware.'),
  ('Exclusions','VAT, customs, civil works, pump/filtration plant, certifications, finance costs and founder compensation beyond the explicit staffing budget.'),
  ('Scenarios','All units assumed commissioned at the start of their billable window; collection is immediate; no churn, bad debt or payment delays. Stress-test before financing.'),
  ('Gates','Auth0 owner authorization; provider credit; recovered firmware/calibration; qualified load validation; customer/site acceptance.'),
  ('Scope','One supervised non-potable reuse buffer-tank pilot. No customer commitment or booked revenue.'),
 ]:intro.append(row)
 inputs=w.create_sheet('Inputs');inputs.append(['Input','Value','Unit / basis'])
 for row in [('USD to SAR',3.75,'SAMA reference; source SAMA'),('Freight/contingency',0.15,'Budget percentage; not landed-cost quote'),('Annual staffing budget',180000,'SAR assumption, not payroll actual'),('Annual cloud/hosting budget',3600,'SAR assumption; metered costs must be measured'),('One-off engineering budget',30000,'SAR assumption; certification/plant excluded'),('Variable cloud reserve per station-month',150,'SAR assumption; sample rate, storage, calls and retention need measurement')]:inputs.append(row)
 bom=w.create_sheet('Prototype BOM');bom.append(['Component','Qty','Catalog USD','Estimated SAR/unit','SAR/unit used','SAR extended','Basis / limitation'])
 for i,(label,qty,usd,sar,basis) in enumerate(BOM,2):
  bom.append([label,qty,usd,sar,f'=IF(C{i}="",D{i},C{i}*Inputs!B2)',f'=B{i}*E{i}',basis])
 sub=len(BOM)+2;bom.append(['Subtotal',None,None,None,None,f'=SUM(F2:F{sub-1})','Excludes plant, shipping tax and certification'])
 bom.append(['Freight/contingency allowance',None,None,None,None,f'=F{sub}*Inputs!B3','Budget, not an invoice'])
 bom.append(['Prototype planning total',None,None,None,None,f'=SUM(F{sub}:F{sub+1})','Not actual manufacturing cost'])
 totalrow=sub+2
 sc=w.create_sheet('Scenarios');sc.append(['Illustrative year-one input/output','Conservative','Base','Optimistic','Basis'])
 rows=[
 ['Stations sold',5,20,60,'Unvalidated commercial assumptions; not a sales pipeline'],
 ['Billable months per station',6,8,10,'All commissioned at start of one billable window'],
 ['Hardware selling price SAR',5500,6000,6500,'Pricing hypotheses; willingness to pay untested'],
 ['Subscription SAR/station/month',250,350,450,'Software/service hypothesis, excludes optional AI overage'],
 ['Build-cost multiplier',1.15,1,0.9,'Estimated execution sensitivity, no validated volume discount'],
 ['Commissioning SAR/station',1200,1000,900,'Installation/support labour assumptions; plant/civil works excluded'],
 ['Support SAR/station/month',150,100,80,'Assumed maintenance reserve; real service intervals unknown'],
 ['Station-months','=B2*B3','=C2*C3','=D2*D3','Billable usage, not measured deployment'],
 ['Hardware revenue','=B2*B4','=C2*C4','=D2*D4','Illustrative, immediate collection assumed'],
 ['Subscription revenue','=B9*B5','=C9*C5','=D9*D5','Illustrative, no churn or arrears assumed'],
 ['Total revenue','=SUM(B10:B11)','=SUM(C10:C11)','=SUM(D10:D11)','No revenue earned or committed'],
 ['Build cost',f'=B2*B6*\'Prototype BOM\'!F{totalrow}',f'=C2*C6*\'Prototype BOM\'!F{totalrow}',f'=D2*D6*\'Prototype BOM\'!F{totalrow}','Planning BOM times sensitivity multiplier'],
 ['Commissioning cost','=B2*B7','=C2*C7','=D2*D7','Estimate'],
 ['Service + variable cloud reserve','=B9*(B8+Inputs!B7)','=C9*(C8+Inputs!B7)','=D9*(D8+Inputs!B7)','Service assumptions plus per-station cloud reserve; not a vendor quote'],
 ['Staff + cloud + one-off engineering','=SUM(Inputs!B4:B6)','=SUM(Inputs!B4:B6)','=SUM(Inputs!B4:B6)','Explicit fixed budget; not full statutory accounts'],
 ['Total modeled cost','=SUM(B13:B16)','=SUM(C13:C16)','=SUM(D13:D16)','Exclusions remain material'],
 ['Modeled cash contribution','=B12-B17','=C12-C17','=D12-D17','Before tax, finance, collections and excluded costs; not profit or ROI'],
 ['Contribution/station before fixed costs','=(B12-SUM(B13:B15))/B2','=(C12-SUM(C13:C15))/C2','=(D12-SUM(D13:D15))/D2','Sensitivity, not a margin claim'],
 ['Indicative stations to cover fixed budget','=IF(B19>0,ROUNDUP(B16/B19,0),"Not covered")','=IF(C19>0,ROUNDUP(C16/C19,0),"Not covered")','=IF(D19>0,ROUNDUP(D16/D19,0),"Not covered")','Assumes unchanged unit economics; not a forecast'],
 ]
 for row in rows:sc.append(row)
 chart=BarChart();chart.title='Illustrative cash contribution (SAR)';chart.add_data(Reference(sc,min_col=2,max_col=4,min_row=18,max_row=18),from_rows=True,titles_from_data=False);chart.set_categories(Reference(sc,min_col=2,max_col=4,min_row=1,max_row=1));chart.y_axis.title='SAR';sc.add_chart(chart,'A23')
 src=w.create_sheet('Sources');src.append(['ID','Source','URL','Use / caveat','Accessed'])
 for key,title,url,caveat in SOURCES:src.append([key,title,url,caveat,REVIEW]);src.cell(src.max_row,3).hyperlink=url
 for sheet in w:
  sheet.freeze_panes='B2';sheet.sheet_view.showGridLines=False;sheet.auto_filter.ref=sheet.dimensions
  sheet.row_dimensions[1].height=30
  for cell in sheet[1]:cell.fill=PatternFill('solid',fgColor=NAVY);cell.font=Font(name='Inter',bold=True,color='FFFFFF',size=11)
  for row in sheet.iter_rows(min_row=2):
   sheet.row_dimensions[row[0].row].height=42
   for cell in row:
    cell.font=Font(name='Inter',size=10,color=BLUE if isinstance(cell.value,(int,float)) else INK)
    cell.alignment=Alignment(vertical='top',wrap_text=True)
    if cell.data_type=='f':cell.number_format='#,##0.00;[Red](#,##0.00)';cell.font=Font(name='Inter',size=10,color=INK)
    elif isinstance(cell.value,(int,float)):cell.number_format='#,##0.00';cell.comment=Comment('Editable assumption or referenced catalog price, never an actual result.','DWMS')
  sheet.column_dimensions['A'].width=40
  for col in 'BCD':sheet.column_dimensions[col].width=22
  sheet.column_dimensions['E'].width=63
  sheet.column_dimensions['F'].width=22;sheet.column_dimensions['G'].width=76
  sheet.sheet_properties.pageSetUpPr.fitToPage=True
  sheet.page_setup.orientation='landscape';sheet.page_setup.paperSize=sheet.PAPERSIZE_A4;sheet.page_setup.fitToWidth=1;sheet.page_setup.fitToHeight=0
 inputs['B3'].number_format='0%'
 w.save(OUT/'DWMS-Financial-Model.xlsx')
 # LibreOffice recalculates cached formula values for readers that do not implement Excel calculation.
 recalc=OUT/'.recalc';recalc.mkdir(exist_ok=True)
 subprocess.run(['soffice','-env:UserInstallation=file:///tmp/dwms-finance-profile','--headless','--convert-to','xlsx','--outdir',str(recalc),str(OUT/'DWMS-Financial-Model.xlsx')],check=True,capture_output=True)
 new=recalc/'DWMS-Financial-Model.xlsx'
 if new.exists():new.replace(OUT/new.name)
 recalc.rmdir()
 return load_workbook(OUT/'DWMS-Financial-Model.xlsx',data_only=True)

def document(cache,args):
 d=Document();sec=d.sections[0];sec.header.paragraphs[0].text='DWMS  /  WATER INTELLIGENCE'
 sec.top_margin=sec.bottom_margin=Inches(.65)
 style=d.styles['Normal'];style.font.name='Inter';style.font.size=Pt(10);style.font.color.rgb=RGBColor.from_string(INK)
 for name in ['Title','Heading 1','Heading 2']:
  d.styles[name].font.name='Inter';d.styles[name].font.color.rgb=RGBColor.from_string(NAVY)
 sec.footer.paragraphs[0].text='IoThon 2026 • Decision study • Assumptions require validation • '+REVIEW
 def p(t):d.add_paragraph(t)
 def h(t):d.add_heading(t,1)
 def table(headers,rows):
  t=d.add_table(rows=1,cols=len(headers));t.style='Light Shading Accent 1'
  for c,x in zip(t.rows[0].cells,headers):c.text=str(x)
  for row in rows:
   for c,x in zip(t.add_row().cells,row):c.text=str(x)
 def page():d.add_page_break()
 d.add_heading('DWMS — Water Intelligence',0);p('Monitor. Detect. Respond.');d.add_heading('Saudi pilot feasibility and commercial decision study',1)
 p('Ahmed Alzahrani — Founder and Project Lead\n'+REVIEW)
 p('Decision: proceed with software demonstration and a gated, supervised non-potable pilot design. Do not sell autonomous process control or drinking-water safety assurance before hardware, account, site and service validation.')
 h('Executive summary')
 p('DWMS connects pH, TDS and turbidity monitoring with alerts, deterministic response requests, emergency latching, explicit recovery and an operational record. The public competition Demo is isolated from authenticated Live data. Flow is demo-only. Ethm is a read-only designed operator aid; its existing provider account currently has exhausted API credit.')
 p('Initial customer hypothesis: a Saudi industrial facility utilities engineer responsible for a treated-water reuse buffer tank serving non-potable use. This is a target profile, not a named customer or commitment. The initial installation remains in shadow monitoring; physical relay output stays disabled until qualified commissioning.')
 h('Evidence boundaries')
 p(f'Software checks: {args.node_tests} Node tests, {args.python_tests} Python tests, {args.checkpoints} isolated backend checkpoints, host safety harness and Uno compilation. Source, CI and current gates are in docs/VALIDATION.md. These are software or synthetic results. No independently audited sensor accuracy, process improvement, field uptime, costs, customers or savings have been supplied.')
 page();h('Problem, solution and operational fit')
 p('Operators need to identify which monitored condition changed, when the reading was observed, which alert was raised, what command was requested and whether recovery was explicitly confirmed. A chart alone leaves that trace scattered across devices, calls and control screens.')
 p('DWMS puts Monitor → Detect → Alert → Respond → Recover → Record in one interface. Rules are deterministic; AI cannot issue physical commands. Gateway timestamps and identity support delayed/replay handling, but an observed timestamp does not establish physical probe acquisition time.')
 table(['Workflow','Pilot evidence to collect'],[
 ('Monitor / Detect','Identified probes, calibration standards, invalid/disconnected checks and timestamp uncertainty.'),
 ('Alert / Respond','Induced anomaly → persisted alert → short-lived command → controller ACK; independent load observation remains separate.'),
 ('Recover / Record','Critical and communication faults latch a stop; restore readings and explicitly acknowledge; compare complete trace against acceptance criteria.')])
 h('Technical feasibility')
 p('Preserve the recovered architecture: sensors → Arduino Uno → USB/Python gateway → device-authenticated HTTPS → existing Convex storage/subscriptions → authenticated dashboard. Uno has no assumed native internet. Repository firmware is a disabled scaffold, not recovered historic calibrated firmware. Preserve the owner’s running firmware before any upload.')
 p('Software handles finite/range validation, command expiry, freshness, shared-fleet roles, per-user private history, deterministic emergency/recovery and separate browser Demo state. Remaining technical gates: authorized Auth0 callback correction and real login rehearsal; successful Ethm provider completion; physical conversion/calibration, disconnect diagnostics and output qualification.')
 p('At the configured one-second sampling cadence, 30 days would produce 2,592,000 records per continuously connected node (arithmetic, not achieved throughput). Storage/index/HTTP/query costs and a retention policy must be measured before a pilot; a free-tier entitlement or a 200-row UI history window is not a retention or capacity guarantee.')
 h('Operational feasibility')
 p('Assign a site utilities engineer, sampling/calibration owner and qualified electrical reviewer. Agree data retention and fault escalation before installation. Begin with reference sampling and observation; use the plant’s existing approved operating procedures. Do not rely on the three parameters for microbiological safety, regulatory compliance or proof of dissolved-solids removal.')
 page();h('Saudi opportunity and customer selection')
 p('MEWA identifies wastewater treatment and reuse as an innovation priority [MEWA]. This supports a relevant pilot focus; it does not establish addressable market size or a purchase budget. Prioritize facilities with an identified reuse buffer tank, available USB gateway/network, safe sampling point, reference testing and an accountable utilities operator.')
 table(['Target segment','Value hypothesis / qualification'],[
 ('Industrial reuse buffer tanks','Shared operational history and response trace; ask about current sampling labour, alarm escalation and controls.'),
 ('Reservoir/storage operators','Visibility of monitored trends and connectivity; verify sensor installation geometry and reference plan.'),
 ('Private industrial water networks','Device/site grouping; test network reliability and permission boundaries before expansion.'),
 ('Municipal or critical drinking-water systems','Later evaluation only; certification, safety coverage and procurement requirements exceed the present prototype.')])
 h('Market validation before spending')
 p('Interview five utilities/maintenance engineers and two system integrators; proposed research targets, not completed interviews. Request current instruments, downtime records, service needs and acceptable installation process. Secure one written shadow-pilot scope and willingness-to-pay feedback before committing inventory. No national TAM or unsupported market-growth number is used.')
 h('Alternatives and differentiation')
 table(['Alternative','Evidence-based comparison'],[
 ('Manual reference sampling / logs','Reference methods remain essential; DWMS proposes a continuous operational trace between samples. No quantified labour saving is established.'),
 ('Hach SC4500 + sensors / existing SCADA','Established monitoring, connectivity and process-control alternative [HACH]. DWMS cannot claim response is unique or that it matches industrial certification.'),
 ('Custom Uno + dashboard integration','Modular integration is reproducible; DWMS’s strongest demonstrated element is the coherent incident→response→latched recovery workflow and transparent software evidence.'),
 ('DWMS current position','Competition prototype with isolated public demo and gated Live platform; no measured cost, reliability or treatment superiority.')])
 page();h('Prototype bill of materials and cost basis')
 p('No verified actual expenditure is available. Candidate DFRobot parts are price references, not identified installed probes or a procurement recommendation. Single-unit USD catalog prices converted at 3.75 SAR/USD [SAMA]. Temperature compensation, industrial enclosures and field qualification require separate design.')
 b=cache['Prototype BOM'];rows=[]
 for row in range(2,len(BOM)+2):rows.append((b.cell(row,1).value,f'{b.cell(row,6).value:,.2f}',b.cell(row,7).value))
 table(['Planning item','SAR','Basis / limitation'],rows)
 total=b.cell(len(BOM)+4,6).value
 p('The catalog SEN0244 example spans 0–1000 ppm and does not cover the software TDS response threshold above 1500 ppm. It is not qualified for that response rule. Identify the installed probe and obtain a fit-for-range quote before any hardware or treatment claim.')
 p(f'Planning total including 15% freight/contingency allocation: SAR {total:,.2f}. This is an estimate, not a manufacturing quote. Pump/filtration plant, process piping, civil works, certification, VAT and customs are excluded and may materially change feasibility. Exact models, duty cycle, relay polarity and load ratings remain unknown.')
 h('Deployment and recurring cost')
 p('Commissioning budget: SAR900–1,200/station by scenario, excluding plant works. Service reserve: SAR80–150/station/month for maintenance planning, not observed service cost. Annual base cloud/hosting allowance SAR3,600, variable cloud reserve SAR150 per station-month and staffing allowance SAR180,000 are assumptions. Convex currently lists a Free/Starter tier and Professional USD25/developer/month plus usage [CONVEX]; telemetry calls/storage/egress and optional AI need measured budgeting. One-off engineering allowance SAR30,000 excludes certification and plant redesign.')
 page();h('Revenue model and pricing hypotheses')
 p('Proposed model: paid site assessment/installation, hardware integration package, monthly station monitoring/support and separately scoped maintenance. Test the customer’s procurement preference before selecting subscription, service contract or integrator licensing. No booked revenue or willingness-to-pay evidence exists. Optional AI must have a quota ceiling and separate approval.')
 p('The editable DWMS-Financial-Model.xlsx contains input, BOM, scenario and source sheets. All numbers below are illustrative year-one sensitivity cases, not a sales forecast, profit statement, ROI or customer saving. They assume immediate collection, no churn, and all stations commissioned at the beginning of the stated billable period; real cash needs can be worse.')
 sc=cache['Scenarios'];summary=[]
 for row in [2,3,4,5,12,17,18,20]:
  vals=[]
  for col in range(2,5):
   v=sc.cell(row,col).value;vals.append(f'{v:,.0f}' if isinstance(v,(int,float)) else str(v))
  summary.append([sc.cell(row,1).value,*vals])
 table(['Illustrative case','Conservative','Base','Optimistic'],summary)
 h('Decision sensitivity')
 p('Conservative/base cases may not cover the fixed team and engineering budget; the optimistic case depends on unvalidated installation volume, price and service load. A positive modeled contribution would not establish profitability because tax, finance, excluded plant costs, certification, cash timing and warranty exposure remain outside the model. Start with a paid assessment and measured pilot; revise the workbook using actual quotes and operating logs before a commercial commitment.')
 page();h('Pilot strategy and acceptance gates')
 table(['Stage','Required evidence / stop condition'],[
 ('1. Recover and bench-validate','Identify original firmware, probes and wiring; backup first. Calibrate to manufacturer references, verify repeatability/disconnects. No validated trace → no process control.'),
 ('2. Shadow pilot, proposed 4 weeks','One reuse tank, one gateway and an accountable engineer. Compare monitored readings to references; record timestamp uncertainty, coverage, faults and operator response. Duration is a proposal, not a test result.'),
 ('3. Qualified isolated-load testing','Independent electrical/load approval and observed fail-safe response. Keep repository relay gate disabled; a software ACK is not pump-motion evidence.'),
 ('4. Controlled site decision','Agree allowable operating envelope, liability, service plan and acceptance. Measure rather than promise alarm latency, reference error, maintenance burden or intervention outcomes.'),
 ('5. Expand only after evidence','Add a second independently validated node/site. Review per-site access needs; current authorization is an approved shared fleet, not multi-tenant site isolation.')])
 h('Risks and mitigation')
 table(['Risk','Mitigation / owner'],[
 ('Probe drift/fouling, floating analog input','Identified hardware, traceable references, cleaning/recalibration log; site instrumentation engineer.'),
 ('Wrong treatment/output assumption','High TDS does not prove a filter can remove it; process engineer approves response and load.'),
 ('Cloud/network or gateway failure','Stale/unknown states, no telemetry replay as fresh, controller lease/interlocks and explicit recovery; software and electrical reviewers.'),
 ('Account/AI availability','Owner grants supported Auth0 management access; credit approval for existing AI. Deterministic control remains independent.'),
 ('Access and data location','Current approved shared-fleet boundary; assess Saudi site/PDPL obligations and retention before collecting personal or sensitive facility data [PDPL].'),
 ('Economics and support burden','Obtain quotes, time installation, measure service labour and revisit pricing; no saving or ROI promise.')])
 page();h('Commercialization roadmap and go/no-go')
 p('Now: evidence-based competition demo and documented gates. Next: recover and calibrate original hardware, complete account activation and one shadow-pilot agreement. Then: qualify isolated outputs, measure support economics and validate a second site. Only after signed acceptance and cost evidence: decide whether to package hardware/service or license through an integrator. No committed dates, customers, funding or regulatory approval are implied.')
 p('Go for software demonstration with visible simulation labels. Hold commercial autonomous operation until identity, calibration, independent output verification, security rehearsal and pilot acceptance are complete. Founder and Project Lead: Ahmed Alzahrani. Preserve contributor credit from repository history without assigning unconfirmed roles.')
 h('Traceable sources and limitations')
 for key,title,url,caveat in SOURCES:p(f'[{key}] {title}. {url}\nAccessed {REVIEW}. {caveat}')
 d.save(OUT/'DWMS-Feasibility.docx')
 subprocess.run(['soffice','-env:UserInstallation=file:///tmp/dwms-feasibility-profile','--headless','--convert-to','pdf','--outdir',str(OUT),str(OUT/'DWMS-Feasibility.docx')],check=True,capture_output=True)
 print('Generated DOCX/PDF and formula-based XLSX; all financial results are illustrative.')

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--node-tests',type=int,default=47);parser.add_argument('--python-tests',type=int,default=20);parser.add_argument('--checkpoints',type=int,default=10);args=parser.parse_args()
 OUT.mkdir(exist_ok=True);cache=workbook();document(cache,args)
