#!/usr/bin/env python3
"""Author competition PPTX/DOCX, then export PDFs with LibreOffice.

Authoring only; never imported by DWMS. Requires python-pptx, python-docx,
Pillow, PyMuPDF, the Inter font and soffice outside the application's runtime dependencies.
Run from anywhere after screenshots exist: python scripts/generate-deliverables.py
"""
from pathlib import Path
import argparse
import subprocess
from PIL import Image
import fitz
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from docx import Document
from docx.shared import Inches as DI, Pt as DP, RGBColor as DC
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'deliverables'
NAVY, BLUE, CYAN, BG, INK = '0B2039', '087EA4', '18C5D9', 'F3F7FA', '142B40'
MUTED, WHITE, BORDER, AMBER = '52697A', 'FFFFFF', 'D8E5ED', 'A65E09'
FONT = 'Inter'
BRAND_MARK = Path('/tmp/dwms-deliverable-brand-mark.png')
DATE = '26 November 2026'
REPO = 'https://github.com/ethm09/DWMS-IoThon-2026'
SOURCES = {
 'EPA': ('US EPA, Basic Information about Water Reuse', 'https://www.epa.gov/waterreuse/basic-information-about-water-reuse'),
 'HACH': ('Hach, SC4500 Digital/Analog Controller brochure, Aug 2026', 'https://cdn.hach.com/7FYZVWYB/at/qz3pr74m68kjjk78vkr8qs8/DOC0535335316-SC4500.pdf'),
 'PH': ('DFRobot SEN0161-V2 catalog, USD single-unit price', 'https://www.dfrobot.com/product-1782.html'),
 'TDS': ('DFRobot SEN0244 catalog, USD single-unit price and 0–1000 ppm range', 'https://www.dfrobot.com/product-1662.html'),
 'TURB': ('DFRobot SEN0189 catalog, USD single-unit price', 'https://www.dfrobot.com/product-1394.html'),
 'CODE': ('DWMS source and readiness record', REPO + '/blob/improve/iothon-2026-focus/docs/VALIDATION.md'),
}


def rgb(value): return RGBColor.from_string(value)

def shape(sl, x, y, w, h, fill=WHITE, border=None, kind=MSO_SHAPE.ROUNDED_RECTANGLE):
    s = sl.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    s.fill.solid(); s.fill.fore_color.rgb = rgb(fill)
    s.line.fill.background() if not border else None
    if border: s.line.color.rgb = rgb(border)
    if kind == MSO_SHAPE.ROUNDED_RECTANGLE:
        try: s.adjustments[0] = .08
        except Exception: pass
    return s


def txt(sl, text, x, y, w, h, size=18, color=INK, bold=False, align=None, margin=0):
    box=sl.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf=box.text_frame; tf.clear(); tf.word_wrap=True
    tf.margin_left=tf.margin_right=Inches(margin); tf.margin_top=tf.margin_bottom=0
    for i,line in enumerate(text.split('\n')):
        p=tf.paragraphs[0] if i==0 else tf.add_paragraph()
        p.text=line; p.font.name=FONT; p.font.size=Pt(size); p.font.bold=bold; p.font.color.rgb=rgb(color)
        p.space_after=Pt(4)
        if align is not None: p.alignment=align
    return box


def linktxt(sl, label, url, x,y,w,h,size=8.5,color=MUTED):
    box=txt(sl,label,x,y,w,h,size,color)
    for p in box.text_frame.paragraphs:
        for run in p.runs: run.hyperlink.address=url
    return box


def line(sl,x1,y1,x2,y2,color=BLUE,width=2):
    s=sl.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1),Inches(y1), Inches(x2),Inches(y2))
    s.line.color.rgb=rgb(color); s.line.width=Pt(width)
    return s


def tag(sl,label,x,y,w=2,color=BLUE):
    shape(sl,x,y,w,.31,fill=color)
    txt(sl,label,x+.1,y+.04,w-.2,.23,9,WHITE,True)


def base(prs,num,kicker,title,dark=False):
    sl=prs.slides.add_slide(prs.slide_layouts[6])
    sl.background.fill.solid(); sl.background.fill.fore_color.rgb=rgb(NAVY if dark else BG)
    color=WHITE if dark else INK
    txt(sl,'DWMS  /  WATER INTELLIGENCE',.55,.25,8,.3,10,CYAN if dark else BLUE,True)
    txt(sl,f'{num:02d} / 10',11.65,.25,1.1,.3,10,CYAN if dark else MUTED,align=PP_ALIGN.RIGHT)
    if kicker: txt(sl,kicker.upper(),.55,.85,12,.35,10,CYAN if dark else BLUE,True)
    if title: txt(sl,title,.55,1.22,12.2,.95,30,color,True)
    line(sl,.55,7.02,12.75,7.02,CYAN if dark else BORDER,1)
    txt(sl,'Monitor. Detect. Respond.',.55,7.13,6,.22,9,CYAN if dark else MUTED)
    txt(sl,'IoThon 2026 • Evidence reviewed '+DATE,7,7.13,5.75,.22,8,CYAN if dark else MUTED,align=PP_ALIGN.RIGHT)
    return sl


def foot(sl,keys):
    labels=[]; urls=[]
    for key in keys:
        title,url=SOURCES[key]; labels.append(f'{key}: {url}'); urls.append(url)
    for i,(label,url) in enumerate(zip(labels,urls)):
        linktxt(sl,label,url,.55,6.53+i*.14,12.2,.16,6.8)
    notes=sl.notes_slide.notes_text_frame
    notes.text='Evidence boundary: source/scenario values and software checks do not establish physical accuracy, field uptime, treatment outcome or compliance.\nSources accessed '+DATE+':\n'+'\n'.join(title+' — '+url for key,(title,url) in SOURCES.items() if key in keys)


def picture_fit(sl,path,x,y,w,h):
    im=Image.open(path); iw,ih=im.size
    scale=min(w/iw,h/ih); nw,nh=iw*scale,ih*scale
    sl.shapes.add_picture(str(path),Inches(x+(w-nw)/2),Inches(y+(h-nh)/2),width=Inches(nw),height=Inches(nh))


def picture_window(sl,path,x,y,w,h,source_height,source_width=None):
    # Editable PowerPoint crop of an actual capture; no values/labels are changed.
    iw,ih=Image.open(path).size
    cw=min(iw,source_width or iw); ch=min(ih,source_height)
    scale=min(w/cw,h/ch); nw,nh=cw*scale,ch*scale
    pic=sl.shapes.add_picture(str(path),Inches(x+(w-nw)/2),Inches(y+(h-nh)/2),width=Inches(nw),height=Inches(nh))
    pic.crop_right=1-cw/iw; pic.crop_bottom=1-ch/ih


def node(sl,title,body,x,y,w=2.2,h=1.2,dark=False):
    shape(sl,x,y,w,h,NAVY if dark else WHITE,BORDER if not dark else None)
    txt(sl,title,x+.16,y+.15,w-.32,.4,16,WHITE if dark else BLUE,True)
    txt(sl,body,x+.16,y+.58,w-.32,h-.6,11,CYAN if dark else MUTED)


def make_deck(desktop,mobile,args):
    prs=Presentation(); prs.slide_width=Inches(13.333); prs.slide_height=Inches(7.5)
    prs.core_properties.title='DWMS — Water Intelligence'; prs.core_properties.subject='IoThon 2026 competition pitch'; prs.core_properties.author='Ahmed Alzahrani, Founder and Project Lead'
    sl=base(prs,1,'IoThon 2026','',True)
    txt(sl,'Water Intelligence',.65,1.65,8.8,1.0,43,WHITE,True)
    txt(sl,'Monitor. Detect. Respond.',.7,2.85,9,.6,25,CYAN)
    txt(sl,'A focused monitoring and response prototype\nfor networks, reservoirs and treated-water reuse.',.7,3.7,9.3,1.1,21,WHITE)
    tag(sl,'SOFTWARE DEMO + TARGET BUILD',.7,5.32,3.65)
    txt(sl,'Live • Demo • Hardware • Ethm. Physical revalidation remains pending.',.7,5.85,10,.45,14,'BED4E5')
    picture_fit(sl,BRAND_MARK,10.1,2.22,2.6,2.6)
    txt(sl,'DWMS',10.38,5.05,2.2,.6,24,WHITE,True)
    txt(sl,'Ahmed Alzahrani  •  Founder and Project Lead',.7,6.42,10,.3,12,WHITE)
    sl.notes_slide.notes_text_frame.text='Founder identity confirmed. Owner reports an earlier operating physical prototype, currently unavailable; no independently audited measurements or customer adoption are claimed.'

    sl=base(prs,2,'Operator need','One decision chain, from reading to response')
    items=[('01  MONITOR','Which site? Which source?','pH, TDS and turbidity with age, connectivity and history.'),('02  DETECT','What changed?','Warning bands flag deviations; critical rules identify when to stop.'),('03  RESPOND','What is confirmed?','Rule-based action, command expiry and explicit operator recovery.')]
    for i,(a,b,c) in enumerate(items):
        x=.55+i*4.15
        shape(sl,x,2.48,3.92,2.8,WHITE,BORDER)
        txt(sl,a,x+.2,2.72,3.5,.4,12,BLUE,True)
        txt(sl,b,x+.2,3.33,3.45,.78,20,INK,True)
        txt(sl,c,x+.2,4.2,3.45,.95,14,MUTED)
    txt(sl,'First pilot hypothesis: a supervised non-potable reuse point with a named operator.',.6,5.65,12,.6,17,INK)
    foot(sl,['EPA'])

    sl=base(prs,3,'Focused product','Status, evidence and the next operator action')
    shape(sl,.55,2.26,7.65,3.95,WHITE,BORDER)
    picture_window(sl,desktop,.67,2.38,7.41,3.71,800)
    shape(sl,8.4,2.26,1.98,3.95,WHITE,BORDER)
    picture_window(sl,mobile,8.48,2.36,1.82,3.75,844,390)
    for y,label,body in [(2.40,'Live','Authenticated path; rollout gated.'),(3.35,'Demo','Shared synthetic scenarios.'),(4.30,'Hardware','Recover the prior prototype.'),(5.25,'Ethm','Read-only evidence explanation.')]:
        txt(sl,label,10.65,y,2.05,.32,15,BLUE,True)
        txt(sl,body,10.65,y+.35,2.05,.52,11,MUTED)
    txt(sl,'Cropped actual application captures • displayed scenario values are simulated.',.6,6.23,12,.28,11,MUTED)
    foot(sl,['CODE'])

    sl=base(prs,4,'System architecture','A traceable data path and acknowledged command loop')
    for i,(title,body) in enumerate([('Sensors','pH / TDS / turbidity\nConversions pending'),('Arduino Uno','Local interlocks\nRelay disabled'),('Python bridge','USB serial → HTTPS\nPer-device credential'),('Convex backend','Validate • store • alert\nRules + command queue'),('Dashboard','Live subscriptions\nSites + history + alerts')]):
        x=.55+i*2.48; node(sl,title,body,x,2.7,2.25,1.65,dark=i==3)
        if i<4:
            line(sl,x+2.25,3.52,x+2.46,3.52,BLUE,2)
    line(sl,11.6,4.7,11.6,5.25,CYAN,2); line(sl,11.6,5.25,4.15,5.25,CYAN,2); line(sl,4.15,5.25,4.15,4.55,CYAN,2)
    txt(sl,'Operator → backend authorization → short-lived command → controller interlock → ACK → dashboard',.7,5.55,11.9,.65,15,BLUE,True)
    txt(sl,'The current controller uses a host gateway. It is not a standalone cellular or LoRaWAN node.',.7,6.15,11.9,.3,11,MUTED)
    foot(sl,['CODE'])

    sl=base(prs,5,'Rule-based response','Deterministic decisions; explicit recovered acknowledgement')
    rows=[('MONITOR','Fresh valid readings','Readings and receipt age remain visible.'),('WARN / REQUEST','Turbidity >20 NTU or TDS >1500 ppm','Prototype Auto requests pump ON if critical interlocks pass.'),('STOP + LATCH','pH <5.5 or >10; turbidity >50 NTU','Emergency stops output and blocks ordinary Auto restart.'),('RECOVER','Fresh non-critical readings + operator acknowledgement','Only explicit recovery may clear the local emergency latch.')]
    for i,(title,trigger,body) in enumerate(rows):
        y=2.28+i*.94
        shape(sl,.6,y,2.25,.76,BLUE if i!=2 else NAVY)
        txt(sl,title,.78,y+.2,1.95,.3,12,WHITE,True)
        txt(sl,trigger,3.1,y+.02,9.45,.34,16,INK,True)
        txt(sl,body,3.1,y+.4,9.45,.35,12,MUTED)
    txt(sl,'Prototype values, not regulatory limits. A pump request does not establish treatment effectiveness.',.6,6.22,12,.3,11,AMBER)
    foot(sl,['CODE'])

    sl=base(prs,6,'Connectivity and failure handling','Loss of certainty stays visible')
    for x,big,title,body in [(.6,'10 s','Receipt freshness','Older readings become UNKNOWN. No automatic substitution with demo values.'),(4.76,'20 s','Command expiry','An unacknowledged command expires. Requested output is separate from reported state.'),(8.92,'15 s','Local control lease','Successful authenticated polling renews the lease. Loss latches the Arduino output OFF.')]:
        shape(sl,x,2.5,3.8,2.65,WHITE,BORDER)
        txt(sl,big,x+.2,2.77,3.4,.7,38,BLUE,True)
        txt(sl,title,x+.2,3.64,3.4,.45,17,INK,True)
        txt(sl,body,x+.2,4.2,3.4,.86,12,MUTED)
    txt(sl,'Configured policy values, exercised by software tests. Actual physical stop/reconnect timing is unmeasured.',.6,5.55,12,0.7,17,INK)
    foot(sl,['CODE'])

    sl=base(prs,7,'Evidence','Software proof is explicit; physical proof is a separate gate')
    for i,(label,detail) in enumerate([('Local behavioral checks',f'{args.node_tests} Node + {args.python_tests} Python checks: validation, authorization, stale/abnormal inputs and command failures.'),('Connected software trace','Actual isolated HTTP, database, reactive readings, alerts, commands and synthetic ACKs.'),('Arduino target build','Uno firmware compiles with pinned tooling. Calibration and relay remain disabled.')]):
        y=2.27+i*1.05
        shape(sl,.6,y,.47,.47,CYAN,kind=MSO_SHAPE.OVAL)
        txt(sl,str(i+1),.6,y+.09,.47,.22,12,NAVY,True,PP_ALIGN.CENTER)
        txt(sl,label,1.3,y-.03,10.8,.4,19,INK,True)
        txt(sl,detail,1.3,y+.43,10.8,.43,14,MUTED)
    shape(sl,.6,5.6,12.1,.62,NAVY)
    txt(sl,'NEXT GATE: recover prior hardware, audit calibration/output, then prove two physical nodes.',.82,5.79,11.7,.3,12,WHITE,True)
    linktxt(sl,'Completed CI baseline: '+args.evidence_commit+'  •  '+args.ci_url,args.ci_url,.6,6.29,12,.2,8)
    foot(sl,['CODE'])

    sl=base(prs,8,'Competitive positioning','Compete on clarity, testability and a focused demonstration')
    headers=['Approach','Established capability / value','Boundary for this pitch']
    xs=[.6,3.5,8.65]; widths=[2.75,5,4.05]
    for x,w,h in zip(xs,widths,headers):
        shape(sl,x,2.3,w,.55,NAVY); txt(sl,h,x+.13,2.45,w-.26,.3,11,WHITE,True)
    data=[('Hach SC4500','Industrial sensor integration, SCADA/PLC and optional network connectivity.','Vendor product category; no DWMS cost or reliability superiority claim.'),('Modular sensor kits','Accessible bench components with model-specific calibration and range limits.','Component availability is not field qualification.'),('DWMS prototype','Inspectable rules, a repeatable scenario, device registry/history and visible uncertainty.','No measured accuracy, field uptime, treatment or fleet-capacity claim.')]
    for i,row in enumerate(data):
        y=2.94+i*1.01
        for j,cell in enumerate(row):
            shape(sl,xs[j],y,widths[j],.92,WHITE,BORDER)
            txt(sl,cell,xs[j]+.13,y+.13,widths[j]-.26,.72,11.4,BLUE if j==0 else INK,j==0)
    foot(sl,['HACH','PH','CODE'])

    sl=base(prs,9,'Market and business hypothesis','Start with one supervised reuse site')
    txt(sl,'Customer: industrial utilities engineer • setup + per-site service fee',.6,2.25,12,.45,17,INK,True)
    for i,(price,label,key) in enumerate([('$39.50','pH kit SEN0161-V2','PH'),('$11.80','TDS kit SEN0244','TDS'),('$9.90','Turbidity kit SEN0189','TURB')]):
        x=.6+i*4.15; shape(sl,x,2.95,3.9,1.38,WHITE,BORDER)
        txt(sl,price,x+.2,3.13,3.5,.6,30,BLUE,True)
        txt(sl,label,x+.2,3.84,3.5,.3,12,MUTED)
    txt(sl,'USD catalog anchors only; not installed models, a complete BOM or quotes. Pricing and willingness to pay: TBC.',.6,4.57,12,.62,15,INK)
    txt(sl,'Qualification gap: the example TDS kit ends at 1000 ppm, below the 1500 ppm Auto trigger. The pH kit is laboratory grade.',.6,5.32,12,.62,14,AMBER,True)
    txt(sl,'Host, enclosure, power, isolation, reference standards, installation and recurring costs: TBC.',.6,6.11,12,.33,11,MUTED)
    foot(sl,['PH','TDS','TURB'])

    sl=base(prs,10,'Pilot request','Reconnect and validate the physical chain.',True)
    txt(sl,'One supervised non-potable pilot.\nTwo identified nodes. A named operator.',.65,2.45,11.8,1.15,26,WHITE,True)
    txt(sl,'01  Calibrate against independent reference measurements\n02  Verify isolated-load safety and separate failure modes\n03  Measure completeness, alert/ACK time and maintenance effort',.7,4.04,11.6,1.43,18,'D5E9F3')
    txt(sl,'Ahmed Alzahrani, Founder and Project Lead  •  Pilot partner, budget and limits: TBC.',.7,5.96,11.6,.4,13,CYAN)
    linktxt(sl,'Repository: '+REPO,REPO,.7,6.49,11.5,.28,10,'D5E9F3')
    sl.notes_slide.notes_text_frame.text='No savings without independent metering/baseline. Founder Ahmed Alzahrani confirmed; other roles TBC. Earlier hardware operation is owner-reported and unavailable; no independent physical measurements were reviewed in this work.'
    path=OUT/'DWMS-Pitch.pptx'; prs.save(path)
    return path


# Document helpers. Manual page breaks keep editable sections predictable.
def shade(cell,fill):
    p=cell._tc.get_or_add_tcPr(); node=OxmlElement('w:shd'); node.set(qn('w:fill'),fill); p.append(node)

def document_table(doc,headers,rows,widths=None):
    table=doc.add_table(rows=1,cols=len(headers)); table.style='Table Grid'
    for i,h in enumerate(headers):
        table.rows[0].cells[i].text=h; shade(table.rows[0].cells[i],NAVY)
        for r in table.rows[0].cells[i].paragraphs[0].runs: r.font.color.rgb=DC.from_string(WHITE); r.bold=True
    for row in rows:
        cells=table.add_row().cells
        for i,value in enumerate(row): cells[i].text=str(value)
    table.autofit=False
    cell_widths=widths or ([1.45,3.25,2.4] if len(headers)==3 else [2.0,1.3,.95,2.85])
    if len(cell_widths)==len(headers):
        for row in table.rows:
            for cell,width in zip(row.cells,cell_widths): cell.width=DI(width)
    for ri,row in enumerate(table.rows):
        trPr=row._tr.get_or_add_trPr(); keep=OxmlElement('w:cantSplit'); trPr.append(keep)
        if ri>0 and ri%2: [shade(c,'F3F7FA') for c in row.cells]
        for cell in row.cells:
            for p in cell.paragraphs:
                p.paragraph_format.space_after=DP(3); p.paragraph_format.space_before=DP(2)
                for r in p.runs: r.font.size=DP(10); r.font.name=FONT
    return table


def p(doc,text,style=None): return doc.add_paragraph(text,style)
def bullet(doc,text): return p(doc,text,'List Bullet')
def heading(doc,title): return doc.add_heading(title,level=1)
def newpage(doc,kicker,title):
    para=p(doc,kicker.upper(),'Subtitle'); para.paragraph_format.page_break_before=True; heading(doc,title)


def make_doc(args):
    doc=Document(); sec=doc.sections[0]
    sec.top_margin=DI(.62); sec.bottom_margin=DI(.6); sec.left_margin=DI(.7); sec.right_margin=DI(.7)
    sec.header_distance=DI(.2); sec.footer_distance=DI(.25)
    for name in ['Normal','Body Text','List Bullet','List Number']:
        s=doc.styles[name]; s.font.name=FONT; s.font.size=DP(10.5)
        s.paragraph_format.space_after=DP(6); s.paragraph_format.line_spacing=1.08
    for name,size in [('Title',31),('Heading 1',21),('Heading 2',13),('Subtitle',11)]:
        s=doc.styles[name]; s.font.name=FONT; s.font.size=DP(size); s.font.color.rgb=DC.from_string(BLUE if name!='Title' else NAVY)
    header=sec.header.paragraphs[0]; header.text='DWMS  /  WATER INTELLIGENCE'; header.runs[0].font.size=DP(8); header.runs[0].font.color.rgb=DC.from_string(BLUE)
    footer=sec.footer.paragraphs[0]; footer.text='Competition feasibility • '+DATE+' | '
    f=OxmlElement('w:fldSimple'); f.set(qn('w:instr'),'PAGE'); footer._p.append(f)
    for r in footer.runs: r.font.size=DP(8); r.font.color.rgb=DC.from_string(MUTED)
    doc.core_properties.title='DWMS — Water Intelligence | Feasibility Study'; doc.core_properties.author='Ahmed Alzahrani, Founder and Project Lead'
    p(doc,'IoThon 2026 / Decision brief','Subtitle')
    p(doc,'DWMS\nWater Intelligence','Title')
    p(doc,'Monitor. Detect. Respond.','Subtitle')
    heading(doc,'Four components; distinct evidence and deployment gates.')
    p(doc,'Live monitoring, the shared Demo, Hardware integration and Ethm explanations support one operational workflow around pH, TDS and turbidity. Flow remains demo-only. This study supports a supervised reuse-buffer pilot, not a certification or measured treatment claim. The owner reports earlier physical operation; that unavailable setup has not been independently revalidated here.')
    document_table(doc,['Decision area','Current evidence','Decision'],[
      ('Live','Protected source/tests and real isolated-backend trace; existing cloud source/allowed Auth0 URLs need rollout.','Rehearse actual sessions after deployment.'),
      ('Demo','Shared synthetic readings, alerts, history and operator scenarios.','Use explicit simulation labels.'),
      ('Hardware','Earlier operation is owner-reported; current template compiles with calibration/relay gates 0.','Recover original setup; audit physical results.'),
      ('Ethm','Read-only authenticated evidence explanation; server key reported configured.','Verify real data/model request; no fake replies.'),
      ('Commercial/financial','Dated component price references; no installed BOM, customer interviews or field operating costs.','Pilot and obtain quotes; no ROI claim.')])
    p(doc,'First pilot: an industrial utilities engineer overseeing a supervised non-potable reuse buffer tank. Partner, jurisdiction and acceptance criteria are unconfirmed. EPA explains that treatment/monitoring depend on source and intended end use [S1].')
    p(doc,'Ahmed Alzahrani — Founder and Project Lead (user confirmed). Pilot partner, location, budget, other role assignments, schedule owners and acceptance limits: TBC. Source review date: '+DATE+'.')

    newpage(doc,'Technical feasibility','A small system with an inspectable control path')
    document_table(doc,['Layer','Implemented path','Physical or deployment gate'],[
      ('Acquisition','Three analog channels → Arduino Uno → USB serial.','Exact probe/interface models; measured voltage/reference; calibrated conversion function.'),
      ('Gateway','Python bridge sends HTTPS telemetry and polls per-device commands.','Always-on host, USB cabling, power and network provisioning.'),
      ('Backend','Convex validates, stores, publishes changes, issues alerts and short-lived commands.','Deploy hardened branch to the existing backend; verify Auth0 origins/roles, tenant boundaries and lifecycle.'),
      ('Operator','Selected-device readings, age/status, alerts, trends and registered sites.','Named operator, response procedure, training and field usability.'),
      ('Response','Backend request → local interlock → serial ACK → displayed reported state.','Independent contact/pump feedback and approved process action.')])
    doc.add_heading('Deterministic prototype policy',level=2)
    bullet(doc,'Critical pH (<5.5 or >10.0) or turbidity (>50 NTU) requests Emergency OFF. Ordinary Auto commands cannot clear a local latch. Recovery requires fresh non-critical readings and explicit operator acknowledgement.')
    bullet(doc,'Auto requests pump ON above 1500 ppm TDS or 20 NTU turbidity when critical interlocks pass. These prototype thresholds require sensor-range and process validation; pumping alone does not prove contaminant removal.')
    bullet(doc,'Receipt freshness is 10 seconds; commands expire after 20 seconds. The Arduino control lease is 15 seconds and is renewed only after a successful authenticated poll. Values are configured policies, not measured physical timing.')
    doc.add_heading('Limits that affect feasibility',level=2)
    p(doc,'Existing Convex/Auth0/OpenAI resources are retained; hardened deployment and new-origin role checks are pending. The Uno is gateway-connected, not a standalone wireless node. Source acquisition timestamps and sequence/replay protection are absent. Range checks cannot prove that an unplugged analog probe is detected. No temperature channel, relay-contact feedback or verified treatment result is provided. The hardened source requires registered authentication for real registry/history/control reads; deployment to the existing cloud backend is pending. Authenticated users still share a fleet: tenant/site isolation is not implemented [S6].')

    newpage(doc,'Sensors and commissioning','Qualify real modules before enabling the process')
    p(doc,'No installed sensor model is confirmed. Catalog examples below are pricing/selection references, not an installed or qualified DWMS bill of materials.')
    document_table(doc,['Example','Primary-source constraint','Implication'],[
      ('DFRobot SEN0161-V2','Laboratory-grade pH kit; manufacturer warns of drift with extended measurements [S3].','Do not assume suitability for continuous immersion or unattended operation.'),
      ('DFRobot SEN0244','Catalog measurement range 0–1000 ppm [S4].','Cannot validate the current 1500 ppm trigger using this example. Select a suitable range or revalidate policy.'),
      ('DFRobot SEN0189','Analog/digital turbidity component for prototypes; output interpretation needs module-specific validation [S5].','Do not infer traceable NTU accuracy from an ADC conversion or generic curve.')])
    doc.add_heading('Canonical hardware recovery and validation',level=2)
    p(doc,'Preserve and identify the earlier running firmware, bridge and wiring before changes. The calibration-disabled repository template is not recovered historical firmware. Obtain exact modules, references and electrical details; independently calibrate and commission an isolated load before operational enable. Test probe/USB/network failures and record raw observations.')
    p(doc,'The single procedural guide, including historical source evidence, is '+REPO+'/blob/improve/iothon-2026-focus/docs/HARDWARE.md. Keep repository relay/calibration enables disabled; a software ACK or target compile is not a physical measurement.')
    p(doc,'pH/TDS/turbidity do not establish microbiological safety or complete water-reuse compliance. Site-specific additional parameters, sampling and treatment requirements remain TBC [S1].')

    newpage(doc,'Operational feasibility','A supervised pilot with named responsibilities')
    document_table(doc,['Responsibility','Pilot activity','Owner'],[
      ('Process operator','Choose reuse end use, approve response action and escalation; perform reference sampling.','TBC'),
      ('Hardware lead','Identify/calibrate probes, maintain cleaning/drift records, verify electrical/load safety.','TBC'),
      ('Software lead','Provision device credentials; test deployed roles, stale states, commands and retention.','TBC'),
      ('Independent reviewer','Witness failure tests and assess results against pre-agreed acceptance criteria.','TBC')])
    doc.add_heading('Pilot measurements, not promises',level=2)
    document_table(doc,['Measure','Method / denominator','Acceptance'],[
      ('Sample completeness','Received valid samples / expected samples over an agreed observation window; log intentional downtime.','TBC before pilot'),
      ('Alert/ACK timing','Record source event, receipt, alert, command and ACK times with clock method and uncertainty.','TBC before pilot'),
      ('False / missed alerts','Compare against independently labeled reference events and agreed bands.','TBC before pilot'),
      ('Sensor agreement / drift','Held-out references and repeated checks; record environmental conditions.','Datasheet/reference tolerance TBC'),
      ('Maintenance effort','Record cleaning, calibration, replacement, operator time and consumables.','TBC before pilot'),
      ('Water / energy impact','Use independent meters and a comparable baseline before attributing any change.','No current savings claim')])
    p(doc,'Run probe loss, USB disconnect and network failure as separate tests. Observe the physical output, actual stop timing, recovery and data gaps. A clean software status is not a substitute for the witnessed result. Two registered devices in the UI are not two physically validated nodes.')
    p(doc,'Use nonsensitive pilot data until deployed roles, tenant isolation, retention and credentials are verified. Ethm explains authenticated evidence without actuation; dedicated authorized operator controls remain separate. A configured server key alone does not prove live AI readiness.')

    newpage(doc,'Economic feasibility','A cost model with traceable inputs and explicit unknowns')
    p(doc,'Observed manufacturer catalog prices, '+DATE+', USD single-unit listings. Shipping, taxes, currency conversion and local availability are excluded. These examples are not confirmed DWMS modules, supplier quotes or a deployment recommendation [S3–S5].')
    document_table(doc,['Reference line','Quantity basis','Observed price','Qualification'],[
      ('pH kit SEN0161-V2','1 illustrative bench kit','$39.50','Laboratory-grade; continuous deployment unqualified'),
      ('TDS kit SEN0244','1 illustrative bench kit','$11.80','0–1000 ppm; insufficient for current 1500 ppm trigger'),
      ('Turbidity SEN0189','1 illustrative bench kit','$9.90','Traceable NTU conversion/installation TBC'),
      ('Controller + LCD + cabling','Exact parts / quantities TBC','TBC','Uno build proven; installed hardware unconfirmed'),
      ('Relay / isolation / load','Site-approved design TBC','TBC','Disabled; polarity/rating/fail state unverified'),
      ('Gateway host + network','Existing or new host TBC','TBC','Continuous host/power/network required'),
      ('Enclosure / power / install','Environment / work scope TBC','TBC','Ingress, electrical and installation review needed'),
      ('Reference instruments / standards','Required references TBC','TBC','Include calibration/cleaning and independent verification')])
    doc.add_heading('Budget and pricing decisions still needed',level=2)
    p(doc,'Total installed cost = qualified hardware + reference equipment + installation/commissioning + logistics/tax + an agreed contingency. No complete total can be supported today. Obtain dated local quotes after sensor and site requirements are frozen.')
    p(doc,'Recurring cost = measured cloud/database/storage usage + network/host power + operator time + cleaning/calibration consumables + replacement allowance. Measure sample rate, retention, query traffic and service effort during the pilot before estimating a fleet.')
    p(doc,'Commercial hypothesis: installation/commissioning plus a site service fee. Price, margin, willingness to pay and support scope are TBC; validate through operator interviews and a paid-pilot discussion. Do not infer affordability or ROI from the three reference prices.')

    newpage(doc,'Market and positioning','A focused prototype within an established category')
    p(doc,'Market existence is supported by established water-monitoring product categories. This research does not establish DWMS customer demand, market size, revenue or a unique invention. Begin with operator interviews at an accessible supervised reuse site.')
    document_table(doc,['Reference','Evidence from primary source','Implication for DWMS'],[
      ('Hach SC4500','Aug 2026 brochure describes industrial digital/analog sensing, local SCADA/PLC integration and optional network connectivity [S2].','Monitoring and remote connectivity are established capabilities; compete through a clear, inspectable prototype demonstration.'),
      ('DFRobot bench kits','Current catalogs provide modular pH/TDS/turbidity components and model-specific limits [S3–S5].','Component accessibility supports prototyping, not verified field suitability or performance.'),
      ('DWMS','Repository exposes ingestion, threshold rules, alerts, command states, multi-site registry/history and simulation labels [S6].','Credible strength: repeatable and reviewable behavior with visible uncertainty. Physical proof remains the next milestone.')])
    doc.add_heading('Six strengths and their claim boundaries',level=2)
    for text in [
      'Real-time monitoring: reactive software updates, not a measured end-to-end physical latency claim.',
      'Early anomaly detection: warning/critical threshold bands, not predictive AI accuracy.',
      'Rule-based response: deterministic interlocks and explicit recovery, not proven treatment effectiveness.',
      'Connectivity: visible stale/unknown states, ACK/expiry and local lease, not guaranteed field uptime.',
      'Multiple sites: registry-backed selection and history, not measured fleet capacity.',
      'Integration: compiled Uno and exercised software transport/control path, not calibrated hardware-to-dashboard evidence.'
    ]: bullet(doc,text)
    p(doc,'The defensible near-term offer is a supervised demonstrator for understanding operational response. A procurement-grade product requires validated instruments, installation engineering, service support, security boundaries and site-specific acceptance. No cheaper/better-than-industrial claim is supported.')

    newpage(doc,'Execution and validation','Advance through evidence gates, with owners and limits agreed first')
    document_table(doc,['Gate','Required evidence','Exit decision'],[
      ('1 • Software baseline','Run current unit/handler, bridge, host-firmware, backend integration, lint/build and actual Uno-target checks; link exact commit/CI.','Demonstration ready after current run passes.'),
      ('2 • Probe qualification','Exact models and calibrated conversion; independent held-out references; detected sensor disconnect; maintenance records.','Hardware sensing approved only against agreed tolerances.'),
      ('3 • Isolated response bench','Inactive startup/reset, critical/stale/USB/network failures, explicit recovery and independent output observation.','Approve safe bench actuation; do not assume process suitability.'),
      ('4 • Two physical nodes','Separate device identity/history, observed connectivity, faults and operator workflow at both nodes.','Multi-site demonstration substantiated.'),
      ('5 • Supervised field observation','Agreed sampling window, completeness/alert labels/maintenance records; deployment security checks.','Decide next investment or redesign from evidence.')])
    doc.add_heading('Risks to resolve before field commitment',level=2)
    bullet(doc,'Unknown sensor models/conversions and prototype thresholds: freeze intended range, calibrate, and align the rule to the qualified measurement and approved process.')
    bullet(doc,'No physical output feedback or verified treatment result: independently observe behavior; commission an appropriate response rather than treating software ACK as process proof.')
    bullet(doc,'Gateway and network dependency: characterize separate failures and actual recovery, power and maintenance needs.')
    bullet(doc,'Shared authenticated fleet, no tenant isolation and absent acquisition sequence: complete deployed access/data-lifecycle controls and freshness/replay design before sensitive or unattended use.')
    p(doc,'Founder and Project Lead: Ahmed Alzahrani. Specific accountable owners for each gate, pilot duration, dates, test limits and spend approval: TBC. No invented schedule or acceptance percentage is assigned.')
    p(doc,'Completed CI baseline: '+args.evidence_commit+' — '+args.ci_url+'. The readiness record identifies exact checked commits and outstanding physical gates [S6]. Final presentation/UI changes must be checked on their own commit.')

    newpage(doc,'Sources','Primary references and internal evidence')
    p(doc,'All external sources accessed '+DATE+'. Prices/specifications may change. Manufacturer claims are attributed; none are reported as DWMS measurements. Source URLs are preserved in full for traceability.')
    keys=['EPA','HACH','PH','TDS','TURB','CODE']
    for n,key in enumerate(keys,1):
        title,url=SOURCES[key]
        pp=doc.add_paragraph(); rr=pp.add_run(f'S{n}  {title}'); rr.bold=True
        p(doc,url)
    p(doc,'S7  Completed software/firmware CI baseline: '+args.ci_url)
    p(doc,'Artifact reproduction: python scripts/generate-deliverables.py. Authoring libraries and LibreOffice are tooling outside the application runtime. Slides, narrative, tables and architecture elements remain editable in PPTX/DOCX; screenshots are actual application captures.')
    p(doc,'Readiness categories: Implemented, Software verified, Simulation verified, Physically validated, Pending and Blocked. Earlier hardware operation is owner-reported; no independently audited physical measurements were supplied. The single current matrix is docs/VALIDATION.md.')
    path=OUT/'DWMS-Feasibility.docx'; doc.save(path); return path


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--evidence-commit',default='8c765c4'); ap.add_argument('--ci-url',default=REPO+'/actions/runs/45872251351'); ap.add_argument('--node-tests',type=int,default=33); ap.add_argument('--python-tests',type=int,default=16); ap.add_argument('--draft',action='store_true',help='Allow visibly labeled screenshot placeholders for internal review only')
    args=ap.parse_args(); OUT.mkdir(exist_ok=True)
    svg=fitz.open(str(ROOT/'public/brand/mark.svg')); svg[0].get_pixmap(matrix=fitz.Matrix(5,5),alpha=True).save(str(BRAND_MARK)); svg.close()
    paths=[ROOT/'docs/screenshots/dashboard-desktop.png',ROOT/'docs/screenshots/dashboard-mobile.png']
    missing=[str(p) for p in paths if not p.exists()]
    if missing and not args.draft: raise SystemExit('Actual application screenshots required: '+', '.join(missing))
    if missing:
        from PIL import ImageDraw
        temps=[]
        for i,path in enumerate(paths):
            if not path.exists():
                tmp=Path('/tmp')/('dwms-artifact-draft-'+str(i)+'.png'); im=Image.new('RGB',(1400,800) if i==0 else (390,844),'#F3F7FA'); ImageDraw.Draw(im).text((35,35),'DRAFT / Actual app screenshot pending',fill='#087EA4'); im.save(tmp); temps.append(tmp)
            else: temps.append(path)
        paths=temps
    deck=make_deck(*paths,args); doc=make_doc(args)
    profile='/tmp/dwms-deliverables-libreoffice'
    for file in [deck,doc]:
        subprocess.run(['soffice','-env:UserInstallation=file://'+profile,'--headless','--convert-to','pdf','--outdir',str(OUT),str(file)],check=True)
    for file in [deck,deck.with_suffix('.pdf'),doc,doc.with_suffix('.pdf')]:
        if not file.exists() or file.stat().st_size==0: raise SystemExit('Missing export: '+str(file))
        print(f'{file.relative_to(ROOT)}: {file.stat().st_size:,} bytes')

if __name__=='__main__': main()
