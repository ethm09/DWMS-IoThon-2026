# Technical validation and evidence

**Evidence labels:** simulated = deliberate test/scenario data; local software = executed in a development environment; CI = linked successful GitHub workflow for a commit; physical = observed on identified probes, controller and load. These labels are not interchangeable.

## Current evidence record

| Area | Status | Evidence / limit |
|---|---|---|
| Baseline inspection | Complete | Source audit of `d48b6784`; [AUDIT.md](AUDIT.md) |
| Baseline GitHub CI | Passed for baseline only | [Run 36713124786](https://github.com/ethm09/DWMS-IoThon-2026/actions/runs/36713124786), 2026-09-30, `d48b6784`; baseline had no behavioral tests |
| Local integrated suite, 2026-11-26 | Passed | `pnpm test`: 18 Node tests (13 backend, 5 monitoring) and 16 Python tests; `pnpm lint` and `pnpm build` passed |
| Controller host harness, 2026-11-26 | Passed locally | Actual sketch compiled/executed with mocked Arduino/LCD/serial; not an Arduino board build |
| Convex code generation, 2026-11-26 | Passed locally | `bash scripts/prepare-convex-build.sh`, isolated local backend; not production deployment validation |
| GitHub CI for improvement implementation | Passed | [Run 45821769699](https://github.com/ethm09/DWMS-IoThon-2026/actions/runs/45821769699), 2026-11-26, `69b49d4`: codegen, 18 Node + 16 Python tests, host harness, lint, build and repository scans |
| Auth0 + deployed Convex integration | Not exercised in this workspace | Requires deployment configuration and authenticated accounts |
| Browser smoke, 2026-11-26 | Passed locally; simulated readings | Desktop and 390px mobile: all five steps, critical acknowledgement blocked, recovery acknowledgement, Device data sign-in gate and core/redirect routes; no page errors or horizontal overflow |
| Probe calibration / physical control | Blocked | Module-specific conversions are unimplemented; relay defaults disabled |
| Accuracy, latency, uptime, water/energy savings | Unmeasured | Do not quote figures until a reproducible measurement exists |

Software checks to run:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
```

`pnpm test` uses built-in Node tests and Python unittest, with compiled TypeScript rather than a new test framework. Inspect the script and individual tests for exact coverage. Handler tests with fake contexts verify application decisions, not a deployed Convex database, Auth0 tenant or network.

The separate controller host check compiles the actual sketch with mocked Arduino/LCD/serial interfaces:

```bash
g++ -std=c++11 -Wall -Wextra -I tests/firmware tests/firmware/controller_test.cpp -o /tmp/dwms-controller-test
/tmp/dwms-controller-test
```

| Software evidence | Source |
|---|---|
| HTTP validation, device authorization, command lifecycle, stale stop, policy agreement | [Backend handler tests](../tests/backend.test.cjs) |
| Freshness, invalid channels, deterministic demo and latched recovery | [Monitoring tests](../tests/monitoring.test.cjs) |
| Input/command parsing, failed polls, telemetry discard, ACK/status and USB reconnect | [Bridge tests](../tests/test_bridge.py) |
| Actual sketch interlocks, lease loss, duplicate ACK and oversized serial frames | [Controller host harness](../tests/firmware/controller_test.cpp) |

The first PR run ([45821619220](https://github.com/ethm09/DWMS-IoThon-2026/actions/runs/45821619220), `2fcc138`) failed before tests: the downloaded local Convex backend rejected the workflow's Node 20 runtime for Node actions. Selecting Node 24 resolved it in the successful run above. This record update changes documentation only.

## Software acceptance checklist

- [x] Reject malformed JSON, missing sensors, strings/booleans/nonfinite values, negative TDS/turbidity and pH outside 0–14 (backend ingestion and bridge tests).
- [x] Reject missing/wrong device credentials and unauthorized viewer/guest control (backend handler tests).
- [x] Classify exact threshold boundaries; critical pH/turbidity overrides Auto response; browser and backend agree (backend policy tests).
- [x] Missing/invalid/stale/future data cannot authorize a start or appear as normal live water status (backend freshness and monitoring tests).
- [x] Preserve Emergency until fresh recovered data and operator acknowledgement (backend recovery tests and controller host harness).
- [x] Keep pending, applied, failed, expired and mismatched acknowledgement states distinct; reconcile controller resets/failures (backend command tests).
- [x] Bound history queries; do not manufacture samples for empty history or sites (backend query test, source review and local browser smoke).
- [x] Reject malformed bridge commands/serial frames; preserve rejected duplicate ACKs; discard oversized frames (bridge tests and controller host harness).
- [x] Lose the communication lease on HTTP/USB failure; reconnect without replaying old measurements as fresh (bridge mocks and controller host harness; physical timing untested).
- [x] Run deterministic dashboard scenario; confirm source and simulated response remain clearly labeled (local browser smoke, 2026-11-26).
- [x] Run lint/build and code generation in CI; retain the run URL and commit SHA ([run 45821769699](https://github.com/ethm09/DWMS-IoThon-2026/actions/runs/45821769699), `69b49d4`).

Tick only checks actually exercised, naming the test or manual record. Passing a host controller harness is not Arduino board compilation or physical validation.

## Required physical validation

| Check | Record required | Current status |
|---|---|---|
| Probe identity and conversion | Manufacturer/model, wiring, supply/ADC reference, equations and unit conversion | Required |
| Calibration and drift | Reference instrument/solutions, raw values, calibration points, uncertainty, temperature and repeat results | Blocked by conversion placeholder |
| Electrical integration | Relay polarity, isolated load, inactive startup/reset, power interruption and EMI observations | Required; relay disabled |
| Interlocks and output | Abnormal/missing/stale probe input, Emergency recovery, independent observation of output state | Required |
| Communication failure | USB/bridge/backend/network loss, local watchdog, reconnect and observed stop timing | Required |
| End-to-end trace | Acquisition/reference → receipt → alert → command → ACK → independent physical state | Required |
| Treatment suitability | Site-specific process, contaminants and applicable standard; independent before/after measurements | Required; not established by pH/TDS/turbidity alone |
| Field feasibility | Enclosure, fouling, maintenance, power autonomy, communications and longer operation | Required |

The three sensors cannot establish microbiological safety or complete reuse compliance. Choose site-specific parameters and standards before interpreting a status as an operational acceptance decision.

## Known blockers and limits

- No verified conversion coefficients, physical probe results or relay/pump feedback sensor are provided.
- Telemetry stores server receipt time, not acquisition time; no sequence/replay protection. Do not buffer and replay old samples as current telemetry.
- No measured fleet capacity, retention policy, notification-fanout capacity or soak-test evidence.
- The production frontend build reports a large JavaScript chunk; bundle-size optimization remains outside this reliability pass.
- Device registry/history queries permit public backend reads; no tenant/site isolation is implemented. UI sign-in and role-protected controls do not change that visibility.
- No field fail-safe certification. Software stop requests and configured watchdog durations do not prove physical isolation or stop latency.

For any measured result, record commit, device/sensor IDs, configuration, procedure, reference, timestamped raw observations, failures and conclusion. Attach the resulting artifact or run URL rather than replacing the checklist with an unsupported “validated” claim.
