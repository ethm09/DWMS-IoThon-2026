# Competition readiness checklist

This is the single readiness record. **Simulated** means injected/scenario values; **local software** means executed application tests; **CI** means a linked workflow for its exact commit; **physical** means observed on identified probes/controller/load. Keep these labels on demo evidence.

| Ready | Gate | Evidence / remaining blocker |
|---|---|---|
| [x] | Input validation, device credentials and role checks | Recorded local `pnpm test`: 20 Node tests (15 backend, 5 monitoring), 16 Python tests. [Backend handlers](../tests/backend.test.cjs), [bridge tests](../tests/test_bridge.py); fake contexts/mocked I/O, not deployed Auth0 |
| [x] | Shared thresholds, stale/invalid handling, Emergency recovery and command failures | Same suite plus [monitoring tests](../tests/monitoring.test.cjs) and [controller host harness](../tests/firmware/controller_test.cpp). Host harness runs actual sketch with mocked pins/LCD/serial |
| [x] | Dashboard and repeatable simulation | Local desktop/390px smoke: five scenarios, blocked critical acknowledgement, explicit recovered acknowledgement, source labels, core routes; no page errors/overflow |
| [ ] | Public software-demo URL | Publication verification pending; a public simulation is separate from the authenticated connected path |
| [x] | Lint, frontend build and isolated Convex codegen | Recorded local passes: `pnpm lint`, `pnpm build`, `bash scripts/prepare-convex-build.sh` |
| [x] | CI evidence for prior improvement commit | [Run 45821769699](https://github.com/ethm09/DWMS-IoThon-2026/actions/runs/45821769699), `69b49d4`, 2026-11-26: codegen, 18 Node +16 Python tests, host harness, lint/build/scans. This is not a result for later changes |
| [ ] | Final revision CI | Verify the exact submitted commit's checks on the PR; do not transfer the prior run's pass to a new revision |
| [x] | Arduino Uno target build | Arduino CLI 1.6.0, `arduino:avr@1.8.6`, AVR GCC 7.3.0, `LiquidCrystal I2C@1.1.2`, FQBN `arduino:avr:uno`; default calibration/relay flags `0`. Compiled, not uploaded or physically tested |
| [x] | Connected software ingestion → reactive readings → alerts → control | [Isolated runner](../scripts/demo-e2e.mjs) exited `0`: all 9 checkpoints passed using actual HTTP/database/subscriptions/notifications/commands and scheduled stale OFF. Inputs/ACKs/operator are synthetic; no browser/probes/Auth0 validation |
| [ ] | Auth0 / deployed role enforcement | Requires configured deployment, verified administrator and viewer/operator sessions |
| [ ] | Calibrated probe measurements | Blocked: exact module identities, measured curves and independent calibration records are absent; conversion function is unimplemented |
| [ ] | Physical relay/interlock/failure behavior | Relay disabled; verify polarity/startup, independent output state and probe/USB/network outage behavior before enabling a load |
| [ ] | Multi-node / field / impact evidence | Registry-backed sites are implemented; two physical nodes, retention/load/soak testing, accuracy/latency/uptime/savings are unmeasured |

Recorded local results above are from 2026-11-26. Add the final commit and exact run/artifact when completing a pending gate. Passing software checks does not complete a physical gate.

## Calibration and physical validation procedure

1. **Identify the installation.** Record probe/interface models and datasheets, IDs, wiring, measured supply/ADC reference, resolution, relay polarity and firmware commit. `readVoltage` assumes 5 V; verify that assumption. Pin map: pH A0, TDS A1, turbidity A2, LCD A4/A5, LEDs D2–D4, relay D7.
2. **Keep outputs disabled.** Leave repository calibration/relay enables at `0` and disconnect the pump/load. A qualified person must independently verify electrical wiring/polarity and authorize isolated-load commissioning before any temporary relay enable on the bench. No such physical commissioning is recorded here.
3. **Measure raw response.** Follow each manufacturer's procedure using traceable pH buffers, conductivity/TDS references and turbidity standards bracketing the operating/alarm range. Record standard lot/expiry, operator/date, raw ADC/voltage, reference value, water temperature, stabilization and repeats. For TDS record the conductivity conversion factor and compensation assumptions; no temperature sensor is included. Do not borrow another module's coefficients.
4. **Implement and independently check conversion.** Use the measured/module-approved equations in `readCalibratedSensors`; validate against held-out references and repeats. Record residuals, uncertainty and drift against agreed reference/datasheet tolerances. Physically unplug each channel: floating analog inputs may look plausible. Demonstrate invalid detection or add verified diagnostics before enabling; range checks alone do not prove disconnection detection.
5. **Verify physical behavior during authorized isolated-load commissioning.** Observe inactive startup/reset, sensor failure/staleness, critical input, lease loss and explicit recovered acknowledgement. Measure output independently; an ACK or high-impedance pin does not prove a relay is OFF. Keep repository relay control disabled; approve operational enable only after the physical results pass the agreed limits.
6. **Record the complete trace.** On an approved bench setup, capture reference/acquisition → backend receipt → alert → command → ACK → independently observed output. Interrupt probe, USB and network separately, record stop/reconnect timing, then repeat. Review the site-specific response before connecting a real process.

The three probes cannot establish microbiological safety or complete reuse compliance. High TDS alone does not show that the selected filter can remove dissolved solids. Select applicable site standards and a suitable response before operational use.

## Reproduce software checks

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
bash scripts/prepare-convex-build.sh
# Controller logic only, using host mocks:
g++ -std=c++11 -Wall -Wextra -I tests/firmware tests/firmware/controller_test.cpp -o /tmp/dwms-controller-test
/tmp/dwms-controller-test
```

Node.js 24, pnpm 10, Python 3 and `g++` cover these checks. For the actual target build, install Arduino CLI 1.6.0 and run `bash scripts/compile-arduino.sh <evidence-dir>`. The [script](../scripts/compile-arduino.sh) installs the pinned AVR core/LCD library, verifies disabled source gates and records logs/toolchain/HEX/ELF/hashes. The new CI firmware job is configured to upload that evidence; its final run remains a separate checklist gate. Keep credentials out of artifacts and recordings.

Recorded Uno build: HEX SHA-256 `0c46970a95b127e0c865749a99043bc20ea7b7e77161689333ad456d99a29009`; compiler estimates 8,232 bytes flash and 772 bytes static SRAM. These are build outputs, not measured power/memory use or physical validation. The sketch had no warnings; core/library unused-parameter warnings remained.

## Remaining deployment limits

- Server receipt timestamps do not prove sample acquisition time. No sequence/replay protection exists; never replay old telemetry as fresh.
- Registry/history API reads are public and have no tenant/site isolation; use nonsensitive prototype data.
- No relay-contact/pump-motion feedback, verified treatment result, fleet capacity or field certification is provided. The frontend build also reports a large JavaScript chunk.
