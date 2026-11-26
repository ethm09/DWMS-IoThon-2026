# Readiness and evidence

This is the single evidence matrix and readiness checklist. **Implemented** identifies source behavior; **Software verified** identifies executed tests/builds; **Simulation verified** identifies deliberate synthetic scenarios; **Physically validated** requires observed identified hardware. **Pending** and **Blocked** remain incomplete. No software result is physical evidence.

| Category | Capability / evidence | Practical limit |
|---|---|---|
| Implemented | Three-channel ingestion, registered sites/history, shared thresholds, authorized controls, expiring commands/ACKs, controller lease. [Architecture](ARCHITECTURE.md) | Flow is demo-only; no fourth physical sensor path is claimed |
| Software verified | Latest recorded protected-source suite: 33 Node +16 Python tests, including auth issuer/role/bootstrap/read-access and explanation-only AI checks. Isolated real-backend runner: 9 checkpoints including denied guest reads; host controller harness. Final local tests, lint and build passed; release CI passed at `8c765c4` | Fake identities, synthetic samples and simulated ACKs; no real Auth0 session or probes |
| Software verified | [Release CI 45872251351](https://github.com/ethm09/DWMS-IoThon-2026/actions/runs/45872251351), `8c765c4`, 2026-11-26: validate and firmware jobs passed | Exact published application source; [Uno compiler artifact](https://github.com/ethm09/DWMS-IoThon-2026/actions/runs/45872251351/artifacts/15143128000); no physical probe or output test |
| Software verified | Uno target compile: CLI 1.6.0, `arduino:avr@1.8.6`, AVR GCC 7.3.0, `LiquidCrystal I2C@1.1.2`, FQBN `arduino:avr:uno`; calibration/relay defaults `0` | Compiled, not uploaded or commissioned. [Compile script](../scripts/compile-arduino.sh) records toolchain/log/HEX/ELF/hashes |
| Simulation verified | Shared five-scenario browser state, alert resolution and explicit recovered acknowledgement; automated local checks at 390, 430, 768, 1024 and 1440 px. [Capture/test record](screenshots/qa-results.json) | Synthetic browser scenarios only. [Desktop](screenshots/dashboard-desktop.png) / [mobile](screenshots/dashboard-mobile.png) are actual local application captures; final published browser inspection pending |
| Physically validated | **None recorded** | No calibration, physical outage/relay test, measured accuracy, latency, uptime or treatment result may be claimed |
| Software verified | [Public release HTTP record](screenshots/public-release-checks.json): Sites version 2, source `8c765c4`; landing, five guest routes, font/logo/preview and built assets returned 200 | Deployment and SPA shells verified; interactive published browser inspection remains blocked |
| Blocked | Publish current guards to existing cloud backend; real Auth0 registration/login/persistence/logout and role rehearsal | Existing URLs/tenant are confirmed; Auth0 returned Callback URL mismatch for the new origin; this workspace lacks an authorized backend deployment session |
| Pending | Form limits/uploads, video URL and final submission approval | [Portal](https://runhackathon.com/gic/iothon/2026/submit) inspection blocked; [submission draft](../deliverables/IoThon-Submission.md) is not submitted |
| Blocked | Calibrated physical ingestion | Exact probe/interface models, measured curves, reference results and module-specific conversion function are absent |
| Blocked | Physical output commissioning | Pump/relay electrical details and independent polarity/startup/failure observations absent; relay remains disabled |

Managed browser preview is currently unavailable (preview relay failed; cloud browser sandbox initialization failed). Existing local automated browser captures are recorded above; they do not establish a real Auth0 session or physical operation.

## Prioritized readiness checklist

- [x] **P0 — Software:** 33 Node +16 Python tests, 9 isolated backend checkpoints, host harness, lint/build/scans and Uno target compilation; [release CI](https://github.com/ethm09/DWMS-IoThon-2026/actions/runs/45872251351).
- [ ] **P0 — Demo:** published guest simulation and public HTTP/assets verified; five-width local interaction checks and real captures prepared. Complete final interactive desktop/mobile inspection at the public URL when browser access is available.
- [ ] **P0 — Authentication:** owner adds the exact [allowed URLs](SETUP.md#auth0-application-settings), confirms the recovered SPA client ID and publishes hardened source to the existing Convex deployment. Then test registration/login, refresh, logout and viewer/operator/admin permissions. Current production source still permits anonymous registry reads (zero records returned during inspection); frontend hiding is not backend protection.
- [ ] **P0 — Hardware:** obtain the information below, independently calibrate, authorize isolated-load commissioning and record the physical trace. Keep relay control disabled. Flow has no physical integration.
- [ ] **P0 — Submission:** [PPTX](../deliverables/DWMS-Pitch.pptx), [PDF pitch](../deliverables/DWMS-Pitch.pdf), [editable feasibility](../deliverables/DWMS-Feasibility.docx), [PDF study](../deliverables/DWMS-Feasibility.pdf), English text and video storyboard are prepared. Owner verifies form limits/declarations, records/reviews required footage, supplies a hosted video URL and approves submission. Ahmed Alzahrani is confirmed as founder/project lead.
- [ ] **P1 — Commercial pilot:** confirm a utilities-engineer owner, identified hardware, site standards, quoted costs and acceptance criteria. No field, savings or commercial-readiness claim is established.

## Hardware information required

| Item | Exact information / evidence needed |
|---|---|
| pH | Probe and interface-board model/revision/datasheet, supply/output range, calibration controls and traceable buffer values/lots/expiry |
| TDS / EC | Probe/interface model, units and output curve, conductivity-to-TDS factor, temperature compensation assumptions and certified reference standards |
| Turbidity | Probe/interface model, voltage/NTU curve, sample geometry and standards bracketing operating/alarm range |
| Controller / power / wiring | Actual Uno revision, measured sensor supply and ADC reference, input limits, grounding/isolation, wiring diagram/photos, power source and protection |
| Pump / treatment | AC/DC voltage, running/start current, purpose, treatment mechanism and permissible bench action; high TDS does not prove a filter can remove dissolved solids |
| Relay | Module model, control/coil voltage, active-high/low polarity, inactive state, NO/NC wiring, contact/load rating, isolation and inductive-load protection |
| Independent references | Instrument model/calibration/uncertainty, standard lots/expiry, water temperature, raw ADC/voltage, repeated samples, date/operator and acceptance limits |
| Flow — future/demo only | Meter model/interface voltage, pulse pin/pull-up and measured pulses-per-litre K-factor/calibration range before any live-flow claim; no flow sensor is integrated now |

## Calibration and physical procedure

1. Record exact hardware/firmware, wiring and measured supply/reference. `readVoltage` assumes 5 V; verify it. Pin map: pH A0, TDS A1, turbidity A2, LCD A4/A5, LEDs D2–D4, relay D7.
2. Leave repository calibration/relay enables at `0` and disconnect the process load. A qualified person must independently verify electrical wiring/polarity and authorize isolated-load commissioning before temporary bench enable. None is recorded here.
3. Follow each probe manufacturer's procedure. Measure raw ADC/voltage against traceable pH buffers, conductivity/TDS references and turbidity standards across the intended range; record stabilization, repeats and temperature. No temperature sensor is included. Do not borrow module coefficients.
4. Implement approved/measured equations in `readCalibratedSensors`; validate held-out references and repeatability/drift against agreed tolerances. Physically unplug each channel: floating inputs can appear plausible. Demonstrate invalid detection or add verified diagnostics; range checks alone are insufficient.
5. During authorized isolated-load commissioning, independently observe startup/reset, sensor failure/staleness, critical stop, lease loss and recovered acknowledgement. An ACK or undriven pin does not prove relay OFF. Approve operational enable only after recorded physical results pass.
6. Record reference/acquisition → backend receipt → dashboard/alert → command → ACK → independent output. Interrupt probe, USB and network separately and measure stop/reconnect behavior. Preserve raw observations, including failures.

pH/TDS/turbidity cannot establish microbiological safety or complete reuse compliance. Select site standards and a suitable operational response before use.

## Reproduce checks and remaining limits

Run `pnpm test`, `pnpm demo:e2e`, `pnpm lint`, `pnpm build` and `bash scripts/prepare-convex-build.sh` with Node.js 24, pnpm 10 and Python 3. Controller host checks need `g++`; actual Uno compilation needs Arduino CLI 1.6.0 and `bash scripts/compile-arduino.sh <evidence-dir>`. [Tests](../tests/backend.test.cjs), [monitoring](../tests/monitoring.test.cjs), [bridge](../tests/test_bridge.py) and [host harness](../tests/firmware/controller_test.cpp) show scope.

Server receipt is not acquisition time; no sequence/replay protection exists. Never replay old telemetry as fresh. Field/fleet capacity, retention, maintenance cost and treatment effectiveness remain unmeasured. Current source/tests protect registry/history/control-state reads for registered users, but publishing those changes to the existing cloud backend is pending. All registered users share the prototype fleet; site/tenant isolation is not established.
