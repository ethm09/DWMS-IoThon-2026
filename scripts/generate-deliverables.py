#!/usr/bin/env python3
"""Author competition PPTX/DOCX, then export PDFs with LibreOffice.

Authoring only; never imported by DWMS. Requires python-pptx, python-docx,
Pillow, PyMuPDF, the Inter font and soffice outside the application's runtime dependencies.
Run from anywhere after screenshots exist: python scripts/generate-deliverables.py
Use --deck-only to refresh the pitch without changing the feasibility study.
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
    """Competition story: operator problem, visible product, proof and a narrow pilot."""
    prs=Presentation(); prs.slide_width=Inches(13.333); prs.slide_height=Inches(7.5)
    prs.core_properties.title='DWMS — Water Intelligence'
    prs.core_properties.subject='IoThon 2026 competition pitch'
    prs.core_properties.author='Ahmed Alzahrani, Founder and Project Lead'
    demo='https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site/demo'
    repo_branch=REPO+'/tree/improve/iothon-2026-focus'

    def refs(sl,keys,note=''):
        x=.6
        labels={'EPA':'EPA • water reuse','HACH':'Hach • SC4500','CODE':'DWMS • evidence','PH':'DFRobot • components'}
        for key in keys:
            if key not in SOURCES: continue
            title,url=SOURCES[key]
            label=labels.get(key,key)
            linktxt(sl,label,url,x,6.68,3,.2,8.8,MUTED);x+=3.1
        sl.notes_slide.notes_text_frame.text=(note+'\n\nEvidence boundary: actual UI captures contain synthetic scenario data. Software checks, command acknowledgements and compilation do not establish sensor accuracy, physical output, treatment effectiveness, water safety or compliance.\nSources accessed '+DATE+':\n'+'\n'.join(SOURCES[k][0]+' — '+SOURCES[k][1] for k in keys if k in SOURCES))

    def arrow(sl,x,y,w=.45,color=BLUE):
        a=shape(sl,x,y,w,.28,color,kind=MSO_SHAPE.CHEVRON)
        return a

    def dot(sl,x,y,label,color=BLUE):
        shape(sl,x,y,.46,.46,color,kind=MSO_SHAPE.OVAL)
        txt(sl,label,x+.02,y+.11,.42,.22,11,WHITE,True,PP_ALIGN.CENTER)

    # 1 — The problem, framed around an operator rather than invented market data.
    sl=base(prs,1,'The water-monitoring problem','',True)
    txt(sl,'A reading is only\nthe beginning.',.65,1.52,9.5,1.7,44,WHITE,True)
    txt(sl,'When conditions change, operators need\na clear path from detection to response.',.7,3.58,10.8,1.05,23,'D5E9F3')
    picture_fit(sl,BRAND_MARK,10.4,1.7,2.25,2.4)
    for x,title,body in [(.7,'Know the condition','pH • TDS • turbidity'),(4.85,'Know the next action','Rules • alerts • control'),(9.0,'Know the outcome','ACK • recovery • record')]:
        line(sl,x,5.17,x+3.45,5.17,CYAN,2)
        txt(sl,title,x,5.43,3.55,.42,17,WHITE,True)
        txt(sl,body,x,5.96,3.55,.3,12,'BED4E5')
    txt(sl,'DWMS • Water Intelligence',.7,6.5,9,.3,14,CYAN,True)
    sl.notes_slide.notes_text_frame.text='Operator problem framing, not a quantified customer survey. DWMS serves networks, reservoirs and treated-water reuse. No market size, customer commitment or physical performance claim is made.'

    # 2 — Why a display alone does not complete the operational job.
    sl=base(prs,2,'Why monitoring alone is insufficient','The handoff matters as much as the measurement.')
    txt(sl,'A dashboard can show a deviation. An operator still needs three answers.',.6,2.27,12.1,.65,21,INK)
    for i,(heading,question,detail) in enumerate([
        ('DETECT','What changed?','Which parameter, which site, and how fresh is the reading?'),
        ('RESPOND','What should happen?','Which configured rule applies, and who may act?'),
        ('CONFIRM','Was it confirmed?','Was the request acknowledged, rejected or left uncertain?')]):
        x=.6+i*4.15
        shape(sl,x,3.14,3.9,2.45,WHITE,BORDER)
        txt(sl,heading,x+.2,3.39,3.5,.28,11,BLUE,True)
        txt(sl,question,x+.2,3.99,3.5,.55,24,INK,True)
        txt(sl,detail,x+.2,4.78,3.5,.69,14,MUTED)
    txt(sl,'The opportunity: make the entire response chain inspectable.',.65,5.94,12,.52,20,BLUE,True)
    refs(sl,['CODE'], 'This is an operational workflow requirement, not a claim that established industrial products lack alarms or control. Existing commercial alternatives are acknowledged on slide 7.')

    # 3 — The value proposition and the product's four coherent components.
    sl=base(prs,3,'DWMS solution','One workflow, from water data to accountable action.')
    stages=['Monitor','Detect','Alert','Respond','Recover','Record']
    for i,label in enumerate(stages):
        x=.6+i*2.08
        shape(sl,x,2.58,1.86,.82,NAVY if i in [3,4] else BLUE)
        txt(sl,label,x+.08,2.83,1.7,.34,15,WHITE,True,PP_ALIGN.CENTER)
        if i<5:arrow(sl,x+1.87,2.86,.18,CYAN)
    txt(sl,'Multi-parameter visibility. Deterministic decisions. A traceable outcome.',.6,3.79,12.15,.62,21,INK,True)
    for i,(label,body) in enumerate([
        ('Live','Approved operational access'),('Demo','Independent public scenarios'),('Hardware','Arduino + USB gateway'),('Ethm','Designed read-only explanations')]):
        x=.6+i*3.13
        shape(sl,x,4.91,2.93,1.18,WHITE,BORDER)
        txt(sl,label,x+.17,5.09,2.6,.32,17,BLUE,True)
        txt(sl,body,x+.17,5.56,2.6,.4,12,MUTED)
    refs(sl,['CODE'], 'Live authentication rollout and successful Ethm replies remain blocked by external authorization/provider credit. Demo does not initialize Auth0 or write operational records. Physical relays remain disabled; flow is demonstration-only.')

    # 4 — The product is the strongest visual proof.
    sl=base(prs,4,'Product demonstration','Follow one complete response.')
    shape(sl,.55,2.22,9.46,4.08,WHITE,BORDER)
    picture_window(sl,desktop,.67,2.34,9.22,3.84,600)
    shape(sl,10.22,2.22,2.55,4.08,WHITE,BORDER)
    picture_window(sl,mobile,10.34,2.34,2.31,3.84,650,390)
    txt(sl,'Normal → Warning → Response → Critical → Recovery',.6,6.35,10.9,.25,13,BLUE,True)
    linktxt(sl,'Explore the public demo',demo,10.38,6.35,2.4,.25,10,BLUE)
    refs(sl,['CODE'], 'These are actual desktop/mobile screenshots of the published DWMS application. Displayed readings and response are synthetic and carry the application simulation label. The walkthrough has five deterministic scenarios and explicit recovery acknowledgement. No physical sensor or equipment result is depicted.')

    # 5 — Architecture is modular, with an explicit command loop.
    sl=base(prs,5,'Technical architecture','A modular data path. A controlled return path.')
    blocks=[('Sensors','pH • TDS • turbidity'),('Arduino Uno','Sample + local interlocks'),('Python gateway','USB serial → HTTPS'),('Convex backend','Validate • store • decide'),('Platform','Sites • alerts • history')]
    for i,(title,body) in enumerate(blocks):
        x=.58+i*2.49
        node(sl,title,body,x,2.78,2.25,1.58,dark=i==3)
        if i<4:arrow(sl,x+2.28,3.37,.18)
    line(sl,11.65,4.55,11.65,5.08,CYAN,2);line(sl,11.65,5.08,4.13,5.08,CYAN,2);line(sl,4.13,5.08,4.13,4.53,CYAN,2)
    txt(sl,'Authorized request → expiring command → controller interlock → ACK → recorded outcome',.68,5.48,12,.7,18,BLUE,True)
    txt(sl,'The Uno uses a host gateway; native internet connectivity is not assumed.',.68,6.27,12,.3,12,MUTED)
    refs(sl,['CODE'], 'Three physical-channel integration contract; flow is demo-only. Original operating hardware is owner-reported and currently unavailable. Current firmware calibration/relay gates are disabled. Earlier working firmware must be preserved and identified before any upload. Source timestamp/sequence reliability changes, where implemented, require their own evidence in the readiness matrix.')

    # 6 — Safety has a clear place in the product story, not a wall of caveats.
    sl=base(prs,6,'Automated response and safety','Respond by rule. Recover by acknowledgement.')
    rows=[('WARN','Flag a deviation','Show the affected sensor and current condition.',BLUE),('REQUEST','Apply the configured response','Track requested output separately from its acknowledgement.',BLUE),('STOP','Latch critical conditions','Request OFF and prevent an ordinary automatic restart.',NAVY),('RECOVER','Require an operator acknowledgement','Restore acceptable readings, then explicitly clear the latch.',BLUE)]
    for i,(word,title,body,fill) in enumerate(rows):
        y=2.28+i*.91
        shape(sl,.6,y,1.9,.73,fill);txt(sl,word,.73,y+.2,1.64,.28,12,WHITE,True,PP_ALIGN.CENTER)
        txt(sl,title,2.77,y+.02,9.85,.33,18,INK,True);txt(sl,body,2.77,y+.41,9.85,.34,13,MUTED)
    txt(sl,'Safety-critical rules remain deterministic. Ethm cannot issue equipment commands.',.6,6.18,12,.32,14,BLUE,True)
    refs(sl,['CODE'], 'The public demonstration exercises configured thresholds and a simulated latched stop. Software tests exercise authorization, stale/invalid inputs, command expiry, controller restart and explicit recovery. Physical relay/load behavior remains unvalidated and disabled. Monitored parameters do not establish drinking-water safety or full reuse compliance.')

    # 7 — Differentiation is the integrated decision chain, not invented uniqueness.
    sl=base(prs,7,'Innovation and differentiation','The decision chain stays visible.')
    items=[('Source + freshness','Know which data can support a decision.'),('Inspectable rules','Explain why the configured response changed.'),('Command + outcome','Separate intention, acknowledgement and uncertainty.'),('Human recovery','Make the return from emergency explicit.')]
    for i,(label,body) in enumerate(items):
        col=i%2;row=i//2;x=.6+col*6.3;y=2.4+row*1.35
        shape(sl,x,y,6.05,1.13,WHITE,BORDER);dot(sl,x+.18,y+.24,'✓')
        txt(sl,label,x+.86,y+.16,4.95,.37,18,BLUE,True);txt(sl,body,x+.86,y+.65,4.95,.35,13,MUTED)
    shape(sl,.6,5.42,12.35,.86,NAVY)
    txt(sl,'Focused prototype value: a repeatable, reviewable monitoring-to-response workflow.',.83,5.68,11.9,.34,17,WHITE,True)
    refs(sl,['HACH','CODE'], 'Hach SC4500 is an established industrial sensor/controller category with optional network connectivity and SCADA/PLC integration. DWMS does not claim category uniqueness, superior accuracy, lower cost or industrial certification. Its defensible contribution here is the inspectable, reproducible integrated workflow.')

    # 8 — Proof is concise, named, and clearly separated from physical evidence.
    sl=base(prs,8,'Verified achievements','Built to be inspected. Demonstrated without guesswork.')
    evidence=[(str(args.node_tests),'Node tests'),(str(args.python_tests),'Python tests'),(str(args.checkpoints),'Isolated backend checks'),('Uno','Target compilation')]
    for i,(big,label) in enumerate(evidence):
        x=.6+i*3.13
        shape(sl,x,2.48,2.93,1.72,WHITE,BORDER)
        txt(sl,big,x+.18,2.73,2.57,.66,38,BLUE,True);txt(sl,label,x+.18,3.53,2.57,.45,14,INK,True)
    txt(sl,'Published UI checked at five widths. Production anonymous access denied.',.65,4.59,12,.63,21,INK,True)
    shape(sl,.6,5.47,12.35,.71,NAVY)
    txt(sl,'Physical revalidation pending • Auth0 administration blocked • Ethm provider credit blocked',.8,5.7,11.95,.28,13,WHITE,True)
    linktxt(sl,'Executed evidence: '+args.evidence_commit+' • CI run',args.ci_url,.65,6.33,12,.23,10,BLUE)
    refs(sl,['CODE'], 'Exact test counts and run scope must match the cited commit. The isolated backend uses synthetic samples, test identities and acknowledgements; this is not physical validation or a real Auth0 browser session. The owner reports an earlier operating prototype, currently unavailable; no independently audited measurements, field uptime, treatment performance or awards are claimed.')

    # 9 — The market entry is a testable pilot and service hypothesis.
    sl=base(prs,9,'Commercial opportunity and pilot','Start narrow. Prove value. Replicate what works.')
    shape(sl,.6,2.35,4.05,3.95,NAVY)
    txt(sl,'FIRST PILOT HYPOTHESIS',.84,2.66,3.56,.34,11,CYAN,True)
    txt(sl,'Saudi industrial\ntreated-water reuse',.84,3.23,3.56,1.05,26,WHITE,True)
    txt(sl,'A utilities engineer.\nA supervised reuse-buffer tank.\nAn agreed response procedure.',.84,4.63,3.56,1.15,17,'D5E9F3')
    for i,(title,body) in enumerate([('Pilot','Reconnect, calibrate and observe an isolated response.'),('Measure','Data completeness, alert/ACK time, operator effort and maintenance.'),('Commercialize','Installation/commissioning plus a site service fee — pricing hypothesis.')]):
        y=2.52+i*1.19
        dot(sl,4.98,y+.04,str(i+1));txt(sl,title,5.72,y,6.85,.35,18,BLUE,True);txt(sl,body,5.72,y+.49,6.85,.61,15,MUTED)
    refs(sl,['EPA','CODE'], 'Saudi industrial reuse is the proposed initial customer segment, not a confirmed customer or measured market size. No pilot partner, purchase, revenue, savings or ROI is claimed. Financial scenarios and SAR estimates are transparent assumptions in the separate feasibility study and XLSX model; actual hardware specification, supplier/installation quotes and willingness to pay remain unconfirmed.')

    # 10 — Close on the product promise, with one concrete next step.
    sl=base(prs,10,'DWMS • Water Intelligence','',True)
    txt(sl,'Turn water data into\nan accountable response.',.65,1.62,11.5,1.7,40,WHITE,True)
    txt(sl,'Monitor. Detect. Respond.',.7,3.54,11.5,.7,26,CYAN,True)
    txt(sl,'Seeking a supervised industrial reuse pilot\nto validate the physical chain and operator value.',.7,4.62,11.35,1.0,22,'D5E9F3')
    txt(sl,'Ahmed Alzahrani',.7,5.93,10.3,.35,17,WHITE,True)
    txt(sl,'Founder and Project Lead',.7,6.37,10.3,.28,12,'BED4E5')
    picture_fit(sl,BRAND_MARK,10.55,4.05,2.0,2.22)
    # Footer links are practical review routes; no unapproved merger is implied.
    linktxt(sl,'Explore Demo',demo,.7,6.78,2.3,.21,10,CYAN)
    linktxt(sl,'Source + evidence',repo_branch,3.3,6.78,3,.21,10,CYAN)
    sl.notes_slide.notes_text_frame.text='Founder/project-lead identity confirmed by the owner: Ahmed Alzahrani. Original contributors remain credited in the repository Git history and MIT license; no other role, team membership, award, partner or commercial achievement is invented. Physical prototype was previously operated according to the owner but is unavailable for current validation. Keep relay operation disabled pending qualified bench commissioning. Demo URL: '+demo+'\nRepository branch: '+repo_branch
    path=OUT/'DWMS-Pitch.pptx';prs.save(path)
    return path


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--evidence-commit',default='62d6732'); ap.add_argument('--ci-url',default=REPO+'/actions/runs/45898346158'); ap.add_argument('--node-tests',type=int,default=47); ap.add_argument('--python-tests',type=int,default=20); ap.add_argument('--checkpoints',type=int,default=10); ap.add_argument('--draft',action='store_true',help='Allow visibly labeled screenshot placeholders for internal review only')
    ap.add_argument('--deck-only',action='store_true',help='Regenerate only the editable pitch and its PDF')
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
    deck=make_deck(*paths,args)
    authored=[deck]
    profile='/tmp/dwms-deliverables-libreoffice'
    for file in authored:
        subprocess.run(['soffice','-env:UserInstallation=file://'+profile,'--headless','--convert-to','pdf','--outdir',str(OUT),str(file)],check=True)
    for file in [artifact for source in authored for artifact in [source,source.with_suffix('.pdf')]]:
        if not file.exists() or file.stat().st_size==0: raise SystemExit('Missing export: '+str(file))
        print(f'{file.relative_to(ROOT)}: {file.stat().st_size:,} bytes')
    if not args.deck_only:
        subprocess.run(['python3',str(ROOT/'scripts/generate-feasibility.py'),'--node-tests',str(args.node_tests),'--python-tests',str(args.python_tests),'--checkpoints',str(args.checkpoints)],check=True)

if __name__=='__main__': main()
