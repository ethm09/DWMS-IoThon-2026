# Competition audit and priorities

Baseline: `main` at `d48b6784ff9c89db27630e8e0fb246c42cd93fe9`. Inspection preceded changes. Work branch: `improve/iothon-2026-focus`. This audit records source findings; it is not a claim that hardware or deployed services were tested.

## KEEP

- Existing React/Vite/TypeScript frontend, Convex storage/reactivity and Auth0 role model.
- Device-authenticated pH/TDS/turbidity HTTP ingestion with finite/range checks; device key redaction in listings.
- Shared threshold primitives, backend Emergency latch, fresh-data start interlocks and command expiry/acknowledgement records.
- Device IDs, locations and indexed per-device history as the multi-site foundation.
- Arduino/Python protocol, local interlocks, disabled calibration/relay defaults and honest limits on controller feedback.

## REMOVE

- Dashboard's duplicate reading summaries, decorative animated pipeline and repeated status cards.
- Operational presentation of fabricated historical readings, extra sensors, site uptime and fixed performance metrics.
- Primary-navigation sprawl across 17 destinations. Keep monitoring, alerts, history, sites, devices, source setup and actual thresholds prominent; put ancillary tools behind a secondary entry.
- Obsolete archive-extraction workflow: the repository already contains extracted source and no source archive.

Simulated ancillary source can remain unmounted for reference. Replacing or redirecting it is justified because generated values did not describe actual monitored devices. Retain the working auth, ingestion, command, alert and registry paths.

## FIX

| Baseline weakness | Required correction |
|---|---|
| Browser critical turbidity/TDS decisions differ from backend | Align rule priority and response; test boundary cases |
| Stale persisted readings can look normal | Recalculate age while idle; show unknown/stale and suppress live-quality claims |
| Desired output alone suppresses repeat commands | Reconcile failed/expired commands and controller-reported state |
| Offline detection alerts but does not request OFF | Request stop; retain a local communication watchdog because cloud requests cannot reach an isolated board |
| Bridge accepts booleans/nonfinite values, crashes on wrong JSON shape | Validate types, bounds and command structure before upload/serial output |
| USB failure exits; lost HTTP requests have no recovery path | Reconnect with bounded backoff; do not replay old telemetry as fresh |
| Firmware lacks communication timeout; duplicate/overflow handling weak | Add control lease, preserve failed ACK result and discard overflowing frames |
| UI thresholds are locally editable without updating backend | Present the actual shared policy as read-only |
| No behavioral test suite | Add deterministic backend, bridge and controller regression checks to CI |

## VALIDATE

Software: malformed/missing/disconnected sensors; abnormal and boundary readings; authorization; stale/future timestamps; Emergency latch/recovery; command rejection/expiry/mismatched ACK; reconnect and communication loss. Record exact commands/results in [VALIDATION.md](VALIDATION.md), keeping local execution separate from GitHub CI.

Physical: exact conversion equations, independent calibration, drift, interference, relay polarity, inactive startup, real stop on probe/USB/network loss, feedback sensing and measured hardware-to-dashboard timing. The current sensor conversion placeholder blocks a truthful live-probe demonstration.

## COMPETITIVE ADVANTAGES

The credible proposition is the combination of an understandable operator view, shared deterministic decisions, auditable command outcomes and explicit data freshness. Registry-backed sites and indexed histories support a distributed prototype. Acknowledging unknown physical state is an engineering strength, but no accuracy, latency, uptime, savings, fleet size or treatment result has been established here.

## Prioritized implementation plan

1. **P0 — correctness:** unify decisions, validate input/freshness, reconcile commands, improve disconnect handling and add regression tests. Acceptance: invalid/stale data cannot authorize start; critical readings dominate other rules; failures remain visible.
2. **P1 — focused workflow:** simplify dashboard/navigation; replace invented history/sites with stored data; provide explicit local scenarios without Auth0/cloud setup. Acceptance: source, readings, status and next operational action are visible together.
3. **P1 — reviewable evidence:** concise README, architecture, setup, demo, checklist and feasibility/pitch outlines. Acceptance: every claim names its evidence level or outstanding check.
4. **P2 — verification:** run tests/lint/build; verify CI on the improvement branch/PR; perform the bench checklist before claiming physical validation.
5. **After competition scope:** acquisition timestamps/sequence protection, retention/aggregation, site-specific policy and access, credential rotation, field enclosure/power design, load/soak testing and independent treatment validation.

Major architectural replacement is unnecessary for this scope. The remaining physical and deployment blockers are explicit gates, not features to simulate as completed.
