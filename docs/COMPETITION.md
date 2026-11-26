# IoThon 2026 competition brief

**Challenge:** IoT water-quality monitoring for networks, reservoirs, and treated-water reuse.

**Product:** DWMS turns per-device pH, TDS and turbidity readings into visible threshold status, alerts and an auditable response workflow. The competition scope is monitoring and demonstrable control logic. It does not claim complete water-safety assessment or prove treatment effectiveness.

## Six strengths and their evidence

| Strength | Existing implementation / demonstration | Evidence still needed |
|---|---|---|
| Real-time monitoring | Device-authenticated ingestion, reactive Convex queries, three readings and receipt freshness | Calibrated physical samples and measured end-to-end delay |
| Early anomaly detection | Deterministic warning bands before critical thresholds; repeatable warning scenario | Detection/false-alarm rates on labeled site data; no predictive claim |
| Rule-based response | Shared policy, Auto/Manual/Emergency, start interlocks and latched recovery | Physical output observations and site-approved treatment/control mapping |
| Reliable connectivity | Explicit stale/unknown states, expiring/acknowledged commands, bridge recovery and controller watchdog | USB/network fault-injection rehearsal and longer field operation |
| Multi-site monitoring | Device IDs/locations, registered-site view, per-device indexed history | At least two physical nodes and measured load/retention capacity |
| Hardware-to-dashboard path | Arduino → serial → Python/HTTPS → Convex → UI and return ACK path | Module-specific conversions, calibration, board compilation and recorded bench trace |

The distinguishing proposition is **traceability and explicit uncertainty**: an operator can inspect the source, reading age, rule response and command outcome together. Do not describe this combination as unique against competitors without a documented comparison.

Reviewable implementation: [ingestion](../convex/http.ts), [device and command lifecycle](../convex/devices.ts), [shared policy](../convex/safetyPolicy.ts), [dashboard](../src/pages/dashboard/page.tsx), [sites](../src/pages/remote-monitoring/page.tsx), [bridge](../public/hardware/serial_bridge.py), [controller](../hardware/arduino/dwms_controller/dwms_controller.ino) and [validation evidence](VALIDATION.md).

## Measurable impact plan

Choose one pilot use case and establish its current workflow before setting targets. Record baseline and pilot observations for time from acquisition to alert, time to operator acknowledgement, verified output response, sample completeness, false/missed alerts, maintenance effort and operating cost. If water/energy savings are relevant, meter them independently against a comparable baseline. Report duration, sample count, failures and uncertainty with each result.

## Feasibility study outline

1. **Use case and owner:** select one network zone, reservoir or reuse outlet; identify operator, response authority and applicable local standard. Define parameters the three probes cannot cover.
2. **Technical fit:** exact probes/calibration, sampling frequency, expected range, fouling, compensation, ADC limitations, power, enclosure and communications. USB bridge needs a powered host; compare alternatives only after measuring this prototype's needs.
3. **Operational response:** map each threshold to a site-approved action. Establish treatment suitability, independent output feedback, manual recovery and behavior during failures.
4. **Bill of materials:** obtain dated supplier quotes for probes, Uno, LCD/indicators, relay/isolation, enclosure/power, bridge host, installation and calibration references. Record currency, quantity and replacement interval; no invented unit-cost total.
5. **Recurring costs:** hosting/traffic at measured ingest rate, network service, power, calibration materials, probe cleaning/replacement and support. Derive cost per site from observed usage.
6. **Scale/security:** multi-node pilot, per-site permissions, credential rotation/revocation, acquisition timestamps, replay handling, retention/aggregation and alert fanout. Measure capacity before promising a fleet size.
7. **Validation schedule and gates:** conversion/calibration → isolated-load integration → fault injection → two-node pilot → field observation. Name owners and evidence artifacts; estimate dates after hardware/access availability is known.
8. **Go/no-go:** agree acceptance criteria with the pilot owner before testing; identify unresolved risks, remediation cost and the next decision.

## Pitch deck outline

| Slide | Main message | Show |
|---|---|---|
| 1 — Problem | Operators need to detect local change and know the next action | One concrete pilot workflow; sourced problem evidence |
| 2 — Focused product | Three measurements, threshold status, alerts and response | A readable dashboard with its source label |
| 3 — Architecture | Follow one reading and one acknowledged command | [Architecture](ARCHITECTURE.md) and hardware photo if available |
| 4 — Live demonstration | Warning → response → critical stop → acknowledged recovery | [Runbook](DEMO.md); clearly say simulated or physically observed |
| 5 — Reliability and evidence | Invalid/stale data and unconfirmed output remain visible | Test/CI records and physical fault-injection evidence, labeled separately |
| 6 — Distributed operation | Separate site/device histories and control state | Registered sites; distinguish software support from physical node count |
| 7 — Feasibility and impact | A scoped pilot can measure operational value | Quoted BOM, maintenance plan and measurement design; placeholders until measured |
| 8 — Readiness and next gate | Working software plus explicit bench/field milestones | Completed evidence, remaining calibration/control gates and pilot request |

Keep AI assistance to a short optional explanation example after monitoring/control. No unsupported accuracy, uptime, latency, savings, compliance, autonomous treatment or scale figures belong in the pitch.
