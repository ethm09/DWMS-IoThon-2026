# IoThon 2026 — English submission draft

Prepared for [the submission portal](https://runhackathon.com/gic/iothon/2026/submit). **Draft only; not submitted.** Direct inspection returned HTTP 403 and the page was inaccessible through search on 2026-11-26. Exact form labels, character limits, required uploads and eligibility declarations remain unverified. The sections below are paste-ready content blocks, not invented official field requirements.

## Project identity

**Project name:** DWMS  
**Brand display:** Water Intelligence  
**Tagline:** Monitor. Detect. Respond.  
**Challenge:** IoT water-quality monitoring for networks, reservoirs, and treated-water reuse.

**Founder and Project Lead:** Ahmed Alzahrani — owner-confirmed; use the existing registered IoThon 2026 founder identity. Preserve original contributor credits as recorded; do not assign unverified team roles.

Use DWMS as the project name. Its existing formal expansion remains “Defense Water Monitoring System”; Water Intelligence is the display brand only.

## Short description

DWMS connects pH, TDS and turbidity monitoring with threshold warnings, deterministic response and traceable device commands. Live monitoring, a shared Demo, the Hardware path and Ethm explanations help an operator see what changed, how fresh the data is, and what action was acknowledged.

## Problem and first user

Our proposed first user is an industrial utilities engineer responsible for a treated-water reuse buffer tank. Changes between sampling rounds can be hard to inspect and escalate consistently. The engineer needs a clear view of readings, connection health, alerts and response history. This is a proposed pilot segment; no customer partnership or field deployment is claimed.

## Solution and IoT architecture

DWMS retains its existing React/TypeScript dashboard and Convex backend. The intended physical path is pH, TDS and turbidity probes → Arduino Uno → USB/Python bridge → authenticated HTTPS ingestion → stored readings, alerts and dashboard. Deterministic backend rules create expiring commands; the bridge and controller return acknowledgements. Critical conditions latch a stop and require explicit recovered acknowledgement. Local sensor interlocks and a communication lease address loss of communication in software.

The four components are Live authenticated monitoring/control, Demo synthetic browser scenarios, Hardware sensing/bridge/interlocks and Ethm read-only explanations. Flow is demo-only. Ethm cannot issue actuation requests. The existing backend now denies anonymous operational access, but real Auth0 callback/session access remains blocked. The model provider returned HTTP 429; no successful Ethm response or specific quota cause is claimed. `/demo` and the gated `/live` workspace remain separate.

## Innovation and competitive positioning

The focused contribution is a reviewable monitoring-to-response workflow: source, data age, threshold decision and command outcome are visible together. Warning bands provide early threshold detection; they are not a claim of predictive contamination detection. Registered sites and per-device history support a distributed prototype.

Commercial water-monitoring products already provide connected instruments, dashboards and alarms. DWMS does not claim category uniqueness, lower cost, superior accuracy or industrial certification. Its current value is a transparent, reproducible prototype that can be evaluated against a narrow pilot workflow.

## What has been demonstrated

The repository includes automated input/auth/rule/failure tests, a real isolated-backend integration runner, controller host tests and an Arduino Uno target compile. The public demo uses explicitly simulated scenarios. The isolated runner uses synthetic readings and controller acknowledgements against actual HTTP, database, reactive query, notification and command functions. Exact runs and limits are recorded in [the readiness evidence matrix](../docs/VALIDATION.md).

**Historical hardware and current evidence differ.** The owner reports that an earlier physical prototype operated, but it is currently unavailable and no audited measurements were supplied. Recover that setup using [the hardware guide](../docs/HARDWARE.md); current repository conversion/calibration and relay gates remain disabled. Compilation or an ACK does not establish sensor accuracy, pump motion, treatment or water safety. The three probes do not establish microbiological safety or complete reuse compliance.

## Feasibility and next milestone

Start with one supervised reuse buffer tank and an isolated output indicator. Confirm probe models and references, calibrate against independent standards, commission electrical safety, then record the complete probe-to-dashboard-to-output trace and outage recovery. A second node follows only after the first bench gate passes.

Before a field pilot, obtain component and maintenance quotes, select site-specific parameters and response procedures, and agree acceptance criteria with the utilities engineer. Measure data completeness, false/missed alerts, operator response time, maintenance effort and operating cost against the existing workflow. No savings, latency, uptime or accuracy figures are claimed before measurement.

## Links and submission assets

| Item | Value / status |
|---|---|
| Source | https://github.com/ethm09/DWMS-IoThon-2026 — competition implementation on [improve/iothon-2026-focus](https://github.com/ethm09/DWMS-IoThon-2026/tree/improve/iothon-2026-focus), [Draft PR #2](https://github.com/ethm09/DWMS-IoThon-2026/pull/2); main remains unchanged |
| Public software demo | https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site/demo — simulated readings; no physical control |
| Evidence / readiness | [docs/VALIDATION.md](../docs/VALIDATION.md) |
| Architecture / setup | [Architecture](../docs/ARCHITECTURE.md) · [Setup](../docs/SETUP.md) |
| Demo video | **Pending recording, review and hosted URL**; [storyboard](Demo-Video-Storyboard.md) |
| Founder / project lead | Ahmed Alzahrani — confirmed; additional identities, affiliations or contact details must come from the registered account or owner |
| Pitch deck | [Editable PPTX](DWMS-Pitch.pptx) · [PDF](DWMS-Pitch.pdf) |
| Feasibility study | [Editable DOCX](DWMS-Feasibility.docx) · [PDF](DWMS-Feasibility.pdf) |
| Logo / screenshots / other uploads | Confirm exact portal requirements before attaching; screenshots identify simulated data |
| Rules / consent / eligibility / final submission | Owner must verify the actual declarations and approve the final submission |

The preparation work does not authorize accepting declarations, inventing team details, or publishing an unreviewed video as physical evidence.
