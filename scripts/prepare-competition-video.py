#!/usr/bin/env python3
"""Prepare a 96-second 1080p competition visual master from preserved real footage.
Optional authorized voice track can be supplied after owner approval. Without it,
output is explicitly a visual master, never mislabeled narrated. No app dependency.
"""
from pathlib import Path
import argparse, json, math, subprocess, wave, hashlib, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'deliverables/video';OUT.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'public/media/dwms-software-demo.mp4'
SCENES=[
 (0,8,'Water quality monitoring should do more than display numbers. It should help operators detect problems and respond before they escalate.'),
 (8,16,'Introducing DWMS. Sensor data, real-time visualization, and a traceable response workflow in one platform.'),
 (16,23,'The hardware path supports pH, total dissolved solids, and turbidity. These demonstration readings are simulated.'),
 (23,29,'Abnormal readings create alerts, showing the affected parameter and condition.'),
 (29,40,'DWMS connects detection with action, requesting a response through predefined operating rules. This pump activity is a simulation; no physical equipment is connected.'),
 (40,49,'Critical conditions latch emergency mode, request a stop, and prevent automatic restart.'),
 (49,56,'Returning readings alone cannot clear the interlock. Recovery requires an operator acknowledgement.'),
 (56,66,'Once readings recover, the operator confirms recovery, allowing a controlled return to normal operation and recording the transition.'),
 (66,78,'Historical trends, device records, and site grouping provide operational visibility across monitoring locations. The software integration is tested with isolated fixtures.'),
 (78,86,'Ethm is designed to explain authorized monitoring evidence. Live AI remains unavailable until provider credit is restored. AI never controls equipment.'),
 (86,92.75,'DWMS. Turning water data into accountable decisions. Monitor. Detect. Respond.'),
 (92.75,96,'Ahmed Alzahrani. Founder and Project Lead.'),
]
def stamp(t):
 ms=round(t*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000);return f'{h:02}:{m:02}:{s:02},{ms:03}'
def font(size,bold=False):
 return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf',size)
def main():
 p=argparse.ArgumentParser();p.add_argument('--voice',type=Path,help='Owner-authorized, synchronized 96s voice MP3; never a generated placeholder');args=p.parse_args()
 # Captions are split into short two-line chunks for phone readability, synchronized to the actual source sequence.
 captions=[]
 for start,end,text in SCENES:
  words=text.split();chunks=[];chunk=[]
  for word in words:
   if len(' '.join(chunk+[word]))>84 and chunk:chunks.append(' '.join(chunk));chunk=[]
   chunk.append(word)
  if chunk:chunks.append(' '.join(chunk))
  total=sum(len(c.split()) for c in chunks);cursor=start
  for c in chunks:
   duration=(end-start)*len(c.split())/total;captions.append((cursor,cursor+duration,c));cursor+=duration
 srt=[]
 for i,(a,b,t) in enumerate(captions,1):
  words=t.split();middle=max(1,len(words)//2)
  line=' '.join(words[:middle])+'\n'+' '.join(words[middle:]) if len(t)>48 else t
  srt.append(f'{i}\n{stamp(a)} --> {stamp(b)}\n{line}\n')
 (OUT/'DWMS-English.srt').write_text('\n'.join(srt))
 (OUT/'DWMS-Narration.txt').write_text('DWMS — final narration script / voice production pending\nTarget: male, natural American English, confident documentary delivery. AI-generated voice must be disclosed.\n\n'+'\n\n'.join(f'{a:05.2f}–{b:05.2f}s\n{t}' for a,b,t in SCENES)+'\n')
 (OUT/'PRODUCTION.txt').write_text('''DWMS competition video production record
Original: public/media/dwms-software-demo.mp4 (preserved unchanged).
Source footage: actual published application, 1440×950, 92.75s. Simulated readings and response, no hardware footage.
Output: 1920×1080 frame, native-resolution source centered with branded borders; no upscaling or invented Full HD detail.
Visual master: 96s, English captions, original ambient backing, branded closing and founder credit. Not a narrated final.
Voice: pending an authorized service connection and successful generation; no fake MP3 or AI response supplied.
Music: generated specifically for DWMS by this authoring script from synthesized tones, no samples or third-party recordings. Dedicated under CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
Final gate: approved voice, synchronization/audition, owner content review and actual portal duration/file/link requirements. Do not submit automatically.
''')
 # Low-level original ambient tones; no downloaded samples or uncertain licenses.
 rate=44100;duration=96;t=np.arange(rate*duration)/rate;signal=np.zeros_like(t)
 for n,(freq,start) in enumerate([(146.83,0),(174.61,24),(130.81,48),(164.81,72)]):
  window=np.clip((t-start)/3,0,1)*np.clip((start+27-t)/3,0,1)
  signal+=window*(.025*np.sin(2*np.pi*freq*t)+.018*np.sin(2*np.pi*freq*1.5*t)+.012*np.sin(2*np.pi*freq*2*t))
 signal*=np.clip(t/3,0,1)*np.clip((duration-t)/4,0,1)
 wav=OUT/'DWMS-Ambient-CC0.wav'
 with wave.open(str(wav),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes((signal*32767).astype('<i2').tobytes())
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(wav),'-codec:a','libmp3lame','-q:a','3',str(OUT/'DWMS-Ambient-CC0.mp3')],check=True);wav.unlink()
 # Closing card built from brand typography, not generated or fabricated hardware footage.
 card=Image.new('RGB',(1920,1080),'#0B2039');draw=ImageDraw.Draw(card)
 draw.text((150,220),'DWMS',font=font(110,True),fill='white');draw.text((154,360),'WATER INTELLIGENCE',font=font(32),fill='#18C5D9')
 draw.line((155,440,1760,440),fill='#087EA4',width=4)
 draw.text((155,500),'Monitor. Detect. Respond.',font=font(58,True),fill='white')
 draw.text((155,650),'Ahmed Alzahrani',font=font(38,True),fill='white');draw.text((155,710),'Founder and Project Lead',font=font(30),fill='#B7D0E0')
 draw.text((155,840),'Software demonstration • Physical validation pending',font=font(27),fill='#B7D0E0')
 cardpath=OUT/'DWMS-Closing.png';card.save(cardpath)
 # Preserve source at native size. The footer captions never cover the application UI.
 fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
 filters=(f'[0:v]pad=1920:1080:240:32:color=0x0B2039,setsar=1,fps=30,'
  f'drawtext=fontfile={fontpath}:text=DWMS - WATER INTELLIGENCE:x=28:y=10:fontsize=17:fontcolor=0x18C5D9,'
  f'drawtext=fontfile={fontpath}:text=Recorded software demonstration:x=1440:y=10:fontsize=17:fontcolor=white[v0];'
  '[1:v]fps=30,format=yuv420p,setsar=1[v1];[v0][v1]concat=n=2:v=1:a=0[all];'
  f"[all]subtitles='{OUT/'DWMS-English.srt'}':force_style='FontName=DejaVu Sans,FontSize=9,OutlineColour=&H0039200B,BorderStyle=3,BackColour=&H0039200B,Outline=1,Shadow=0,MarginV=4'[video]")
 name='DWMS-Competition-Narrated.mp4' if args.voice else 'DWMS-Competition-Visual-Master.mp4'
 cmd=['ffmpeg','-y','-v','error','-i',str(SOURCE),'-loop','1','-t','3.25','-i',str(cardpath),'-i',str(OUT/'DWMS-Ambient-CC0.mp3')]
 if args.voice:
  if not args.voice.exists():raise SystemExit('Authorized voice file missing; no narrated result produced.')
  shutil.copyfile(args.voice,OUT/'DWMS-Voiceover.mp3')
  cmd+=['-i',str(args.voice)];filters+=';[2:a]volume=0.35[music];[3:a][music]amix=inputs=2:duration=longest:normalize=0[audio]'
 else:filters+=';[2:a]anull[audio]'
 cmd+=['-filter_complex',filters,'-map','[video]','-map','[audio]','-t','96','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',str(OUT/name)]
 subprocess.run(cmd,check=True)
 (OUT/'SOURCE.sha256').write_text(hashlib.sha256(SOURCE.read_bytes()).hexdigest()+'  public/media/dwms-software-demo.mp4\n')
 print(name,'created; voice status:',bool(args.voice))
if __name__=='__main__':main()
