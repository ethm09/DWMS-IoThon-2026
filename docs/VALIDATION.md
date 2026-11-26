# Readiness and evidence

This is the single evidence matrix and readiness checklist. **Implemented** identifies source behavior; **Software verified** identifies executed checks; **Simulation verified** identifies synthetic scenarios; **Physically validated** requires independently reviewed hardware observations. **Pending** and **Blocked** remain incomplete. No software result is physical evidence.

| Category | Capability / evidence | Practical limit |
|---|---|---|
| Implemented | Separate `/demo` and `/live` workspaces; three-channel monitoring, fleet approval/roles, history, deterministic response and controller ACK/lease. [Architecture](ARCHITECTURE.md) | Flow is demo-only; `VITE_DWMS_LIVE_ENABLED=false` until Auth0 callback/session verification |
| Software verified | Current local pass: **41 Node +16 Python tests**, **9 isolated-backend checkpoints**, controller host harness and Uno target compile | Test identities, synthetic samples/ACKs; no real Auth0 browser session or probes |
| Software verified | [Release CI 45895567727](https://github.com/ethm09/DWMS-IoThon-2026/actions/runs/45895567727), **`646a47d`**: both jobs passed, including 41 Node +16 Python tests, 9 backend checkpoints and Uno target compile | Exact frozen application source; no real Auth0 browser or physical probe/output validation |
| Software verified | Existing Convex backend deployed at `0cb515d`; [six production negative probes](screenshots/production-release-checks.json) denied four reads, pump command and agent run with `UNAUTHENTICATED` | No production test devices/readings/users created; negative checks are not an authenticated-role rehearsal |
| Software verified | Uno compilation rerun passed with CLI 1.6.0, `arduino:avr@1.8.6`, AVR GCC 7.3.0, LCD library 1.1.2 and both safety gates `0` | Compilation is not upload/physical commissioning; [hardware guide](HARDWARE.md) records scope |
| Simulation verified | [Headless runner](../scripts/verify-public-demo.py) passed at 390, 430, 768, 1024 and 1440 px: core pages, Ethm/rules/about, keyboard SVG interaction, manual/critical override and Live/Demo tab isolation; [QA record](screenshots/qa-results.json), [desktop](screenshots/dashboard-desktop.png), [mobile](screenshots/dashboard-mobile.png) | Actual local browser checks with synthetic state; final published inspection pending |
| Physically validated | **No independently audited measurements supplied**; owner reports an earlier operating prototype | Hardware currently unavailable; historical operation does not establish current calibration/fault/performance results |
| Blocked | Auth0 callback/session and authorized tenant administration | New-origin callback mismatch persists. CLI 1.40.0 device attempts returned `User is not authorized` / `ActivationDenied`; tenant policy/root cause cannot be established without authorized administration/logs |
| Blocked | Ethm provider/model response | Actual backend check returned HTTP 429, `provider_rate_limit`; no successful answer or quota/billing cause is established |
| Pending | Final source CI/public deployment verification, video URL, form requirements and submission | [Portal](https://runhackathon.com/gic/iothon/2026/submit) inspection blocked; [submission draft](../deliverables/IoThon-Submission.md) is not submitted |
| Blocked | Recover/revalidate historical hardware and commission physical output | Device unavailable; [HARDWARE.md](HARDWARE.md) is the canonical recovery/calibration/commissioning guide; relay remains disabled |

The current public configuration reuses the existing Convex/Auth0 resources. Public URL/domain/client ID are confirmed; no owner reconfirmation is required. Operational data needs explicit fleet approval: new and legacy unapproved viewers are denied, approved viewers read only, and operator/admin roles control devices. Private histories remain user-owned. Demo bypasses Auth0 initialization, not operational authorization; the hardware bridge mounts only under `/live`. Legacy operational buffers are per-tab, not persistent cross-user local storage.

## Prioritized readiness checklist

- [x] **P0 — Local software:** 41 Node +16 Python tests, 9 isolated-backend checkpoints, host harness and Uno compilation passed; existing production anonymous-access probes deny all six tested operations.
- [ ] **P0 — Release/Demo:** final source `646a47d` CI passed. Publish/inspect `/demo` and the truthful `/live` gate on desktop/mobile; local five-width captures are separate from public verification.
- [ ] **P0 — Live / Ethm:** obtain authorized access to existing Auth0 management through a valid existing Management API grant or functional browser; inspect the callback/policy/log evidence, then apply/rehearse the exact [URL settings](SETUP.md#auth0-application-settings). Keep Live disabled until login/reload/logout and approved roles pass. Resolve the provider HTTP 429 and verify a genuine Ethm response separately. Do not create duplicate services or paste private keys into chat.
- [ ] **P0 — Hardware:** recover the owner-reported setup through [HARDWARE.md](HARDWARE.md), independently validate calibration and isolated-load/fault behavior, and record the physical trace. Keep repository relay disabled; flow is demo-only.
- [ ] **P0 — Submission:** review the [pitch](../deliverables/DWMS-Pitch.pptx), [feasibility](../deliverables/DWMS-Feasibility.docx), English text and storyboard against final evidence. Verify actual form requirements, record/review footage, host the video and approve declarations. Ahmed Alzahrani is the confirmed founder/project lead.
- [ ] **P1 — Commercial pilot:** confirm a utilities-engineer owner, site standards, hardware, quotes and acceptance criteria. No field, savings or commercial-readiness claim is established.

## Reproduce checks and remaining limits

Run `pnpm test`, `pnpm demo:e2e`, `pnpm lint`, `pnpm build` and `bash scripts/prepare-convex-build.sh` with Node.js 24, pnpm 10 and Python 3. Controller host checks need `g++`; target compilation needs Arduino CLI 1.6.0 and `bash scripts/compile-arduino.sh <evidence-dir>`. [Backend tests](../tests/backend.test.cjs), [monitoring](../tests/monitoring.test.cjs), [bridge](../tests/test_bridge.py) and [host harness](../tests/firmware/controller_test.cpp) show scope.

Managed CUA remains unavailable; the requested project headless runner provides actual local browser checks. Auth0 CLI uses its own first-party global issuer/client and its default request uses a broad wildcard audience. Default and extra-scope device attempts were denied; this does not establish the exact tenant permission/policy cause or a disabled DWMS SPA grant. Inspect authorized management/log evidence through a securely bound existing-tenant grant; do not start another blind device-code attempt.

Server receipt is not acquisition time; no sequence/replay protection exists. Never replay old telemetry as fresh. Field capacity, retention, maintenance cost and treatment effectiveness remain unmeasured. Fleet approval is shared-fleet access, not per-site tenant isolation.
