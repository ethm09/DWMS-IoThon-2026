# Readiness and evidence

This is the single evidence matrix and readiness checklist. **Implemented** identifies source behavior; **Software verified** identifies executed tests/builds; **Simulation verified** identifies deliberate synthetic scenarios; **Physically validated** requires observed identified hardware. **Pending** and **Blocked** remain incomplete. No software result is physical evidence.

| Category | Capability / evidence | Practical limit |
|---|---|---|
| Implemented | Three-channel ingestion, registered sites/history, shared thresholds, authorized controls, expiring commands/ACKs, controller lease. [Architecture](ARCHITECTURE.md) | Flow is demo-only; no fourth physical sensor path is claimed |
| Software verified | Latest recorded protected-source suite: 33 Node +16 Python tests, including auth issuer/role/bootstrap/read-access and explanation-only AI checks. Isolated real-backend runner: 9 checkpoints including denied guest reads; host controller harness. Final local tests, lint and build passed; release CI passed at `8c765c4` | Fake identities, synthetic samples and simulated ACKs; no real Auth0 session or probes |
| Software verified | [Release CI 45872251351](https://github.com/ethm09/DWMS-IoThon-2026/actions/runs/45872251351), `8c765c4`, 2026-11-26: validate and firmware jobs passed | Exact published application source; [Uno compiler artifact](https://github.com/ethm09/DWMS-IoThon-2026/actions/runs/45872251351/artifacts/15143128000); no physical probe or output test |
| Software verified | Uno target compile: CLI 1.6.0, `arduino:avr@1.8.6`, AVR GCC 7.3.0, `LiquidCrystal I2C@1.1.2`, FQBN `arduino:avr:uno`; calibration/relay defaults `0` | Compiled, not uploaded or commissioned. [Compile script](../scripts/compile-arduino.sh) records toolchain/log/HEX/ELF/hashes |
| Simulation verified | Shared five-scenario browser state, alert resolution and explicit recovered acknowledgement; automated local checks at 390, 430, 768, 1024 and 1440 px. [Capture/test record](screenshots/qa-results.json) | Synthetic browser scenarios only. [Desktop](screenshots/dashboard-desktop.png) / [mobile](screenshots/dashboard-mobile.png) are actual local application captures; final published browser inspection pending |
| Physically validated | **No independently audited measurements supplied**; owner reports an earlier operating prototype | Hardware is currently unavailable; historical operation does not establish current calibration, outage/relay behavior or performance |
| Software verified | [Public release HTTP record](screenshots/public-release-checks.json): Sites version 2, source `8c765c4`; landing, five guest routes, font/logo/preview and built assets returned 200 | Deployment and SPA shells verified; interactive published browser inspection remains blocked |
| Blocked | Publish current guards to existing cloud backend; real Auth0 registration/login/persistence/logout and role rehearsal | Existing URLs/tenant are confirmed; Auth0 returned Callback URL mismatch for the new origin; this workspace lacks an authorized backend deployment session |
| Pending | Ethm live data/model rehearsal; form limits/uploads, video URL and final submission approval | [Portal](https://runhackathon.com/gic/iothon/2026/submit) inspection blocked; [submission draft](../deliverables/IoThon-Submission.md) is not submitted |
| Blocked | Reconnect and revalidate the prior physical prototype | Device unavailable; exact setup, calibration records and historical firmware need recovery through [HARDWARE.md](HARDWARE.md) |
| Blocked | Physical output commissioning | Pump/relay details and independent current observations absent; repository relay remains disabled |

Managed browser preview is currently unavailable (preview relay failed; cloud browser sandbox initialization failed). Existing local automated browser captures are recorded above; they do not establish a real Auth0 session or physical operation.

## Prioritized readiness checklist

- [x] **P0 — Software:** 33 Node +16 Python tests, 9 isolated backend checkpoints, host harness, lint/build/scans and Uno target compilation; [release CI](https://github.com/ethm09/DWMS-IoThon-2026/actions/runs/45872251351).
- [ ] **P0 — Demo:** published guest simulation and public HTTP/assets verified; five-width local interaction checks and real captures prepared. Complete final interactive desktop/mobile inspection at the public URL when browser access is available.
- [ ] **P0 — Live / Ethm:** owner adds the exact [allowed URLs](SETUP.md#auth0-application-settings), confirms the recovered SPA client ID and publishes hardened source to the existing Convex deployment. Then test registration/login, refresh, logout, viewer/operator/admin permissions and genuine Ethm explanation of fresh device data. No model reply is validated by server-key configuration alone. Current production source still permits anonymous registry reads (zero records returned during inspection); frontend hiding is not backend protection.
- [ ] **P0 — Hardware:** recover the owner-reported prototype and follow the single [hardware guide](HARDWARE.md); record calibration, isolated-load/fault results and the physical trace. Keep repository relay disabled; flow is demo-only.
- [ ] **P0 — Submission:** [PPTX](../deliverables/DWMS-Pitch.pptx), [PDF pitch](../deliverables/DWMS-Pitch.pdf), [editable feasibility](../deliverables/DWMS-Feasibility.docx), [PDF study](../deliverables/DWMS-Feasibility.pdf), English text and video storyboard are prepared. Owner verifies form limits/declarations, records/reviews required footage, supplies a hosted video URL and approves submission. Ahmed Alzahrani is confirmed as founder/project lead.
- [ ] **P1 — Commercial pilot:** confirm a utilities-engineer owner, identified hardware, site standards, quoted costs and acceptance criteria. No field, savings or commercial-readiness claim is established.

## Hardware reconnection

The owner reports an earlier operating physical prototype, currently unavailable. That report is historical context, not an audited measurement set. [HARDWARE.md](HARDWARE.md) is the single guide for recovery, exact-model/power/ADC/relay/flow information, calibration, safe commissioning and physical fault tests. Preserve and identify the earlier firmware/wiring before changing it; repository calibration/relay defaults remain disabled.

## Reproduce checks and remaining limits

Run `pnpm test`, `pnpm demo:e2e`, `pnpm lint`, `pnpm build` and `bash scripts/prepare-convex-build.sh` with Node.js 24, pnpm 10 and Python 3. Controller host checks need `g++`; actual Uno compilation needs Arduino CLI 1.6.0 and `bash scripts/compile-arduino.sh <evidence-dir>`. [Tests](../tests/backend.test.cjs), [monitoring](../tests/monitoring.test.cjs), [bridge](../tests/test_bridge.py) and [host harness](../tests/firmware/controller_test.cpp) show scope.

Server receipt is not acquisition time; no sequence/replay protection exists. Never replay old telemetry as fresh. Field/fleet capacity, retention, maintenance cost and treatment effectiveness remain unmeasured. Current source/tests protect registry/history/control-state reads for registered users, but publishing those changes to the existing cloud backend is pending. All registered users share the prototype fleet; site/tenant isolation is not established.
