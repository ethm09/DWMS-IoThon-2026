# DWMS narrated competition demonstration

**Final:** [98-second MP4](../public/media/dwms-competition-narrated.mp4) · [supplied voice MP3](video/DWMS-Voiceover.mp3) · [speech-timed English SRT](video/DWMS-English.srt) · [actual transcript](video/DWMS-Narration.txt).

The owner supplied the 96.76-second ElevenLabs audio. Local ASR and boundary review provide actual speech timing; no paid voice or transcription API was used. Project/founder spellings are corrected in captions without changing the audio. The video is a 1920×1080 frame containing native 1440×950 recorded software footage; no added source detail or hardware footage is claimed. All monitoring and response shown are simulated.

| Time | Actual recorded scene / purpose |
|---|---|
| 0–9 s | Landing page: operator problem |
| 9–23 s | Normal readings: product and sensor introduction |
| 23–31 s | Warning and alerts |
| 31–42.5 s | Deterministic response simulation and engineering schematic |
| 42.5–54 s | Critical interlock and restart protection |
| 54–62.6 s | Recovered readings, explicit operator confirmation and record |
| 62.6–73.8 s | Trends and device visibility; isolated software evidence explained |
| 73.8–85.7 s | Ethm as a designed capability; live AI explicitly unavailable |
| 85.7–93.5 s | Product closing |
| 93.5–98 s | Ahmed Alzahrani — Founder and Project Lead |

Excerpts are retimed to match narration. These editing times are not response-latency measurements. Exact recording ranges and speech timestamps are in [the edit map](video/DWMS-Video-Edit.json) and [alignment/provenance](video/DWMS-Voice-Alignment.json). The [original silent technical recording](../public/media/dwms-software-demo.mp4) is unchanged.

Reproduce with existing authoring tools (FFmpeg, Python, NumPy and Pillow; no application dependency):

```bash
python3 scripts/prepare-competition-video.py \
  --voice deliverables/video/DWMS-Voiceover.mp3 \
  --alignment deliverables/video/DWMS-Voice-Alignment.json \
  --edit deliverables/video/DWMS-Video-Edit.json
```

The original synthesized backing is CC0; see [production provenance](video/PRODUCTION.txt). Narration and soundtrack are mixed separately; the standalone supplied MP3 remains byte-identical.

**Remaining gate:** verify the authenticated IoThon portal's exact duration/upload/link requirements and obtain owner approval before submission. The 98-second edit follows the requested target, not a verified portal limit. Actual probe/calibration/qualified load footage remains deferred until the physical prototype returns. No compilation output or simulation substitutes for that physical evidence.

Published delivery: [public MP4](https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site/media/dwms-competition-narrated.mp4). Public download/hash and full-file Chromium playback/seeking passed. Early partial-download byte-range seeking was unavailable in the tested delivery path; download the MP4 for seeking. See [published media evidence](../docs/screenshots/published-narrated-video.json).
