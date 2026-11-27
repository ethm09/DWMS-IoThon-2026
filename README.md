# DWMS · AI-Powered Water Intelligence Platform

**Monitor. Understand. Respond.**

**Ethm is the Water Intelligence Engine at the core of DWMS.** Sensor evidence feeds transparent trend analysis and contextual AI explanations; operators make informed decisions while independent deterministic controls enforce safety. The IoThon prototype targets water networks, reservoirs and treated-water reuse. Live acquisition covers pH, TDS and turbidity; flow remains Demo-only.

| Component | Purpose | Current boundary |
|---|---|---|
| **Live** | Authenticated readings, alerts, history and authorized device controls | Backend deployed and anonymous access denied; Auth0 callback accepted; end-user session acceptance remains blocked |
| **Demo** | Public scenarios plus genuine AI interpretation of canonical simulated evidence | Separate guest sessions and model allowance; no operational data or physical action |
| **Hardware** | Arduino/USB bridge and deterministic local interlocks | Owner reports an earlier operating prototype; it is currently unavailable for audited revalidation |
| **Ethm** | Contextual interpretation, reviewed references and analytical evidence reports | Real provider connectivity verified; authenticated contextual conversation still pending |

Competition implementation: [improvement branch](https://github.com/ethm09/DWMS-IoThon-2026/tree/improve/iothon-2026-focus) · [Draft PR #2](https://github.com/ethm09/DWMS-IoThon-2026/pull/2). Main is unchanged pending approval.

[Watch the narrated competition demonstration](https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site/media/dwms-competition-narrated.mp4) (98 seconds, supplied AI narration, simulated readings; no hardware footage). The [original silent technical recording](public/media/dwms-software-demo.mp4) is preserved.

**[Open Demo](https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site/demo)** · [Live workspace — gated](https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site/live) · [Readiness and evidence](docs/VALIDATION.md) · [Demo runbook](docs/DEMO.md)

![DWMS overview showing the three water-quality readings and demo-only flow in Simulation mode](docs/screenshots/dashboard-desktop.png)

Actual application screenshot using synthetic browser values; no physical output is connected.

## Run locally

Use Node.js 24 and pnpm 10:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `/demo` for the browser demonstration; `/live` is the separate operational workspace. Demo requires no login, changes no physical output and does not write device history. Connected operation uses the existing React/TypeScript + Convex architecture with Auth0 identities and a Python/USB Arduino bridge; see [setup](docs/SETUP.md).

```bash
pnpm test
pnpm demo:e2e
pnpm lint
pnpm build
```

The integration runner uses a disposable local backend with synthetic readings/operator/ACKs. CI and Uno compilation are software evidence. No audited physical measurements from the earlier prototype were supplied; current repository calibration/relay gates remain disabled. Use the [hardware reconnection guide](docs/HARDWARE.md) before commissioning. An ACK does not prove pump motion or water safety.

## Review the project

- [Architecture](docs/ARCHITECTURE.md): three physical channel design and acknowledged command path.
- [Single readiness record](docs/VALIDATION.md): Implemented, Software verified, Simulation verified, Physically validated, Pending and Blocked evidence; calibration and hardware information required.
- [Audit and priorities](docs/AUDIT.md): retained functionality and focused reliability changes.
- [Pilot and competitive context](docs/COMPETITION.md): proposed utilities-engineer pilot, primary-source competitors and feasibility.
- [English submission draft](deliverables/IoThon-Submission.md) · [100-second video storyboard](deliverables/Demo-Video-Storyboard.md).
- Pitch: [editable PPTX](deliverables/DWMS-Pitch.pptx) · [PDF](deliverables/DWMS-Pitch.pdf). Feasibility: [editable DOCX](deliverables/DWMS-Feasibility.docx) · [PDF](deliverables/DWMS-Feasibility.pdf) · [editable SAR model](deliverables/DWMS-Financial-Model.xlsx) (illustrative assumptions, no actual revenue or costs).
- [Narrated MP4](public/media/dwms-competition-narrated.mp4), [supplied voice MP3](deliverables/video/DWMS-Voiceover.mp3), [speech-timed English SRT](deliverables/video/DWMS-English.srt) and [actual transcript](deliverables/video/DWMS-Narration.txt). Original recording is preserved; native footage is framed without upscaling.
- Actual application captures: [desktop](docs/screenshots/dashboard-desktop.png) · [mobile](docs/screenshots/dashboard-mobile.png).

Founder and Project Lead: **Ahmed Alzahrani**. Original contributor history and the [MIT license](LICENSE) are preserved. DWMS retains its formal expansion, Defense Water Monitoring System; Water Intelligence is the display brand.
