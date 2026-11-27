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
def render_narrated(voice, alignment, edit_path):
    """Mux supplied speech with actual recording; word timestamps drive captions.

    This is offline media authoring. No application/backend code or service key
    is used. The voice source is preserved byte-for-byte as DWMS-Voiceover.mp3.
    """
    import tempfile
    import textwrap
    if not voice.is_file() or not alignment or not alignment.is_file() or not edit_path or not edit_path.is_file():
        raise SystemExit('--voice requires existing --alignment JSON and --edit JSON; no guessed speech timing.')
    transcript=json.loads(alignment.read_text())
    edit=json.loads(edit_path.read_text())
    duration=float(edit['duration'])
    voice_duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(voice)],text=True))
    if duration < voice_duration or not 90 <= duration <= 120:
        raise SystemExit('Edit must include the entire supplied narration inside the competition duration target.')
    words=[dict(word) for segment in transcript['segments'] for word in segment['words']]
    if not words or any(not 0 <= word['start'] <= word['end'] <= duration for word in words):
        raise SystemExit('Invalid or missing actual speech timestamps.')
    # Correct recognition spellings only; confirmed identity, not invented speech.
    for word in words:
        word['word']=word['word'].replace('ETM','Ethm').replace('Ahmad','Ahmed')
    # Join the confirmed founder surname while preserving the original acoustic span.
    index=0
    while index < len(words)-1:
        if words[index]['word'].strip()=='Al' and words[index+1]['word'].strip().startswith('Zahrani'):
            words[index]['word']=' Alzahrani'+(',' if words[index+1]['word'].strip().endswith(',') else '')
            words[index]['end']=words[index+1]['end'];words.pop(index+1)
        index+=1
    groups=[];group=[]
    for word in words:
        proposed=' '.join(x['word'].strip() for x in group+[word])
        if group and (len(proposed)>78 or word['end']-group[0]['start']>5.8 or word['start']-group[-1]['end']>.75):
            groups.append(group);group=[]
        group.append(word)
        if word['word'].rstrip().endswith(('.', '!', '?')) and word['end']-group[0]['start']>=1.4:
            groups.append(group);group=[]
    if group:groups.append(group)
    captions=[]
    for index,group in enumerate(groups):
        start=max(0,group[0]['start']-.035)
        end=min(duration,group[-1]['end']+.12)
        if index<len(groups)-1:end=min(end,groups[index+1][0]['start']-.05)
        if end<=start:raise SystemExit('Nonpositive caption duration')
        text=' '.join(w['word'].strip() for w in group).replace(' -','-')
        end=min(duration,max(end,start+len(text)/20))
        if index<len(groups)-1:end=min(end,groups[index+1][0]['start']-.05)
        lines=textwrap.wrap(text,width=42,break_long_words=False,break_on_hyphens=False)
        if len(lines)>2:raise SystemExit('Caption exceeds two lines; refine the word groups.')
        captions.append({'start':start,'end':end,'text':'\n'.join(lines)})
    if any(a['end'] > b['start'] for a,b in zip(captions,captions[1:])):raise SystemExit('Subtitle overlap; fix alignment before encoding.')
    srt_path=OUT/'DWMS-English.srt'
    srt_path.write_text('\n'.join(f'{i}\n{stamp(c["start"])} --> {stamp(c["end"])}\n{c["text"]}\n' for i,c in enumerate(captions,1)))
    target=OUT/'DWMS-Voiceover.mp3'
    if voice.resolve()!=target.resolve():shutil.copyfile(voice,target)
    normalized={**transcript,'words_corrected_for_captions':words,'caption_corrections':['ETM → Ethm','Ahmad Al Zahrani → Ahmed Alzahrani (owner-confirmed identity)'],'captions':captions}
    (OUT/'DWMS-Voice-Alignment.json').write_text(json.dumps(normalized,indent=2)+'\n')
    (OUT/'DWMS-Video-Edit.json').write_text(json.dumps(edit,indent=2)+'\n')
    script='DWMS — supplied narration transcript\nSource: owner-supplied ElevenLabs MP3. No new voice generation or paid API used.\nCaptions follow actual spoken wording; acronym/name recognition spelling corrected.\n\n'
    for segment in transcript['segments']:
        text=segment['text'].replace('ETM','Ethm').replace('Ahmad Al Zahrani','Ahmed Alzahrani')
        script+=f'{segment["start"]:06.2f}–{segment["end"]:06.2f}s\n{text.strip()}\n\n'
    (OUT/'DWMS-Narration.txt').write_text(script.rstrip()+'\n')
    clips=edit['clips'];cursor=0
    for clip in clips:
        if abs(float(clip['start'])-cursor)>0.04 or clip['end']<=clip['start']:raise SystemExit('Edit is not continuous.')
        if clip['kind']=='source' and not 0 <= clip['source_start'] < clip['source_end'] <=92.75:raise SystemExit('Invalid recording range.')
        cursor=clip['end']
    if abs(cursor-duration)>.04:raise SystemExit('Edit duration mismatch.')
    fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    with tempfile.TemporaryDirectory(prefix='dwms-narrated-') as work:
        work=Path(work);clip_files=[]
        for index,clip in enumerate(clips):
            seconds=clip['end']-clip['start'];frames=round(seconds*30);path=work/f'clip-{index:02}.mp4'
            if clip['kind']=='source':
                rate=seconds/(clip['source_end']-clip['source_start'])
                cmd=['ffmpeg','-y','-v','error','-ss',str(clip['source_start']),'-t',str(clip['source_end']-clip['source_start']),'-i',str(SOURCE)]
                vf=(f'setpts=(PTS-STARTPTS)*{rate},fps=30,pad=1920:1080:240:32:color=0x0B2039,setsar=1,'
                    f'drawtext=fontfile={fontpath}:text=DWMS - WATER INTELLIGENCE:x=28:y=10:fontsize=17:fontcolor=0x18C5D9,'
                    f'drawtext=fontfile={fontpath}:text=AI-narrated software demonstration:x=1410:y=10:fontsize=17:fontcolor=white,'
                    f'tpad=stop_mode=clone:stop_duration=1,trim=duration={seconds}')
                cmd+=['-vf',vf]
            elif clip['kind']=='closing':
                cmd=['ffmpeg','-y','-v','error','-loop','1','-i',str(OUT/'DWMS-Closing.png'),'-vf','fps=30,setsar=1']
            else:raise SystemExit('Only recorded footage and existing branded closing card are permitted.')
            cmd+=['-an','-frames:v',str(frames),'-c:v','libx264','-preset','fast','-crf','15','-pix_fmt','yuv420p',str(path)]
            subprocess.run(cmd,check=True);clip_files.append(path)
        concat=work/'clips.txt';concat.write_text(''.join("file '"+str(path)+"'\n" for path in clip_files))
        filters=(f"[0:v]subtitles='{srt_path}':force_style='FontName=DejaVu Sans,FontSize=9,OutlineColour=&H0039200B,BorderStyle=3,BackColour=&H0039200B,Outline=1,Shadow=0,MarginV=4'[video];"
                 f'[1:a]loudnorm=I=-16:TP=-2:LRA=8,apad,atrim=duration={duration}[voice];'
                 f'[2:a]volume=0.22,afade=t=in:d=2,afade=t=out:st={duration-3}:d=3,atrim=duration={duration}[music];'
                 f'[voice][music]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.8414:level=false,afade=t=out:st={duration-1}:d=1[audio]')
        final=ROOT/'public/media/dwms-competition-narrated.mp4'
        cmd=['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(concat),'-i',str(target),'-stream_loop','-1','-i',str(OUT/'DWMS-Ambient-CC0.mp3'),'-i',str(srt_path),'-filter_complex',filters,'-map','[video]','-map','[audio]','-map','3:0','-t',str(duration),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-c:s','mov_text','-metadata:s:a:0','language=eng','-metadata:s:s:0','language=eng','-disposition:s:0','0','-metadata','title=DWMS — Monitor. Detect. Respond.','-movflags','+faststart',str(final)]
        subprocess.run(cmd,check=True)
    source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest();voice_hash=hashlib.sha256(target.read_bytes()).hexdigest()
    (OUT/'SOURCE.sha256').write_text(source_hash+'  public/media/dwms-software-demo.mp4\n'+voice_hash+'  deliverables/video/DWMS-Voiceover.mp3\n')
    (OUT/'PRODUCTION.txt').write_text(f'''DWMS narrated competition video production record
Final video: public/media/dwms-competition-narrated.mp4 ({duration:.2f}s, 1920×1080, 30 fps, H.264/AAC, burned English captions plus optional English subtitle track).
Voice: owner-supplied ElevenLabs MP3 ({voice_duration:.6f}s); copied byte-for-byte as DWMS-Voiceover.mp3. No voice-service or paid API charge by the agent.
Transcript/alignment: local faster-whisper; model/provenance in DWMS-Voice-Alignment.json. Names/acronym spelling corrected; subtitles follow spoken wording. Audio is not regenerated.
Footage: original 1440×950 actual application recording, preserved unchanged. Excerpts retimed to match speech; exact decisions in DWMS-Video-Edit.json. Native source resolution is framed inside 1080p, without claiming added detail. Editing is not response-time evidence.
Context: all sensor/control demonstrations are simulated. Physical prototype unavailable; relay disabled, flow demo-only. Ethm speech states its live AI service is unavailable. No physical experiment, AI completion or measurement is fabricated.
Music: original synthesized DWMS ambient backing, CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
Mix: voice normalization, quiet backing, final limiter. Check final measured loudness/playback evidence separately.
Founder credit: Ahmed Alzahrani — Founder and Project Lead (owner-confirmed).
Final gate: actual portal duration/file/link requirements and owner submission approval remain unverified/pending. Do not merge PR or submit automatically.
''')
    print('Narrated video:',final,'seconds',duration,'captions',len(captions),'voice preserved',voice_hash)


def main():
 p=argparse.ArgumentParser();p.add_argument('--voice',type=Path,help='Owner-supplied voice MP3, preserved unchanged');p.add_argument('--alignment',type=Path,help='Actual word-timed ASR JSON');p.add_argument('--edit',type=Path,help='Recorded-scene edit JSON');args=p.parse_args()
 if args.voice:
  render_narrated(args.voice,args.alignment,args.edit)
  return
 if (ROOT/'public/media/dwms-competition-narrated.mp4').exists():
  raise SystemExit('Narrated release exists: use --voice --alignment --edit to reproduce it; default visual-master regeneration would replace its captions.')
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
 name='DWMS-Competition-Visual-Master.mp4'
 cmd=['ffmpeg','-y','-v','error','-i',str(SOURCE),'-loop','1','-t','3.25','-i',str(cardpath),'-i',str(OUT/'DWMS-Ambient-CC0.mp3')]
 filters+=';[2:a]anull[audio]'
 cmd+=['-filter_complex',filters,'-map','[video]','-map','[audio]','-t','96','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',str(OUT/name)]
 subprocess.run(cmd,check=True)
 (OUT/'SOURCE.sha256').write_text(hashlib.sha256(SOURCE.read_bytes()).hexdigest()+'  public/media/dwms-software-demo.mp4\n')
 print(name,'created; voice status:',bool(args.voice))
if __name__=='__main__':main()
