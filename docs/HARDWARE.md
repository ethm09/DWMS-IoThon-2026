# Hardware reconnection and physical validation

The owner reports that an earlier DWMS prototype operated with Arduino communication. That is **owner-reported history**, not a reproduced measurement in this audit. Preserve the existing board, its running firmware, wiring, calibration records and working bridge before making changes. The included disabled controller template is not a recovered copy of that historical firmware.

## What the repository establishes

| Evidence | Supported conclusion |
|---|---|
| [Original source `75cbb23`: embedded bridge](https://github.com/ethm09/DWMS-IoThon-2026/blob/75cbb23/src/pages/devices/page.tsx#L226) | Python read newline-delimited Arduino JSON at 9600 baud and posted **pH, TDS and turbidity** with `X-API-Key` / `X-Device-ID` to `/arduino/data`. This is source evidence of an integration path, not proof of a physical test. |
| [Original reading schema](https://github.com/ethm09/DWMS-IoThon-2026/blob/75cbb23/convex/schema.ts#L26) and [hardware subscription](https://github.com/ethm09/DWMS-IoThon-2026/blob/75cbb23/src/components/hardware-bridge.tsx) | Three channels were stored and subscribed to. Flow was absent from that physical ingestion/storage path. |
| [Original local process state](https://github.com/ethm09/DWMS-IoThon-2026/blob/75cbb23/src/components/providers/process-mode.tsx#L35) | Flow had a local example value/control concept. This does not establish an acquired flow measurement. The current dashboard keeps flow explicitly demo-only. |
| [Controller/bridge addition `05c170a`](https://github.com/ethm09/DWMS-IoThon-2026/commit/05c170af7ed10946f6d668787e3b77e9011eb056) | Added the standalone bridge and Uno template, with sensor calibration and relay control disabled. The original uploaded archive inspected at [`39b71dd`](https://github.com/ethm09/DWMS-IoThon-2026/commit/39b71dd) contained no `.ino` or `.py` file. Historical deployed firmware must be recovered from the owner. |

The retained path is `probes → Uno → USB/Python bridge → authenticated HTTPS → Convex → selected-device dashboard`. The current command path adds authenticated polling, command expiry, local interlocks, an explicit emergency-recovery flag, status and ACKs. A software ACK confirms the controller's reported state; no contact/pump-motion feedback is installed.

## Current interfaces

| Interface | Source configuration / boundary |
|---|---|
| Probe inputs | pH A0, TDS A1, turbidity A2; actual module/output compatibility must be verified |
| Local display / indication | LCD I²C A4/A5, address `0x27`; LEDs D2–D4 |
| Relay | D7; polarity unknown until measured; repository control enable remains `0` |
| Serial | 9600 baud; newline JSON `{ph,tds,turbidity,calibrated:true}` only after independent calibration; a flag alone is not calibration evidence |
| Device telemetry | HTTPS `POST /arduino/data`; numeric, finite, nonnegative values and pH 0–14; matching device credentials required |
| Control / feedback | `/arduino/control/next`, `/arduino/control/ack`, `/arduino/control/status`; serial `KEEPALIVE`, `SET_PUMP,id,mode,state,clearEmergency`, `ACK`, `STATUS` |
| Flow | Simulation only. No physical flow pin, pulse conversion, transmitted field or stored reading is implemented |

See the [actual bridge](../public/hardware/serial_bridge.py), [controller](../hardware/arduino/dwms_controller/dwms_controller.ino) and [architecture](ARCHITECTURE.md). The conversion function currently returns false, even if its calibration macro is changed. Do not enable a flag to bypass that missing work.

## Required hardware intake

Obtain these exact details before claiming calibrated readings or reconnecting a process load:

- **Existing installation:** actual Uno revision, recovered running sketch/bridge and versions, wiring/photos, known successful serial/log captures and their dates. Keep reported observations separate from recorded measurements.
- **Each probe/interface:** manufacturer/model/revision/datasheet, supply and output limits, calibration controls, unit/conversion curve and traceable reference standards. For TDS/EC include conversion factor and temperature-compensation assumptions; for turbidity include geometry/voltage-to-NTU method.
- **Power/electrical:** measured sensor supply and ADC reference (`readVoltage` assumes 5 V), grounding/isolation, input limits, protection and enclosure requirements.
- **Relay/pump/treatment:** relay control/coil voltage, active polarity, NO/NC wiring and load rating; pump AC/DC voltage, running/start current, intended process action and independently observable output. High TDS alone does not show that the selected treatment can remove dissolved solids.
- **Any historical flow sensor:** exact model, signal voltage/type, pin/interrupt wiring, acquisition code, verified pulse/volume or other conversion and reference-volume calibration. No coefficient or pin can be inferred from the demo value. Recover and validate the whole ingestion/storage/UI path before presenting flow as physical.

## Reconnect without replacing working hardware

1. Archive the known running firmware/bridge/configuration and wiring first. Keep the pump/process load disconnected during reconnection checks. Opening a Uno serial port commonly resets it; unconfigured high-impedance output is not proof that an attached relay is OFF.
2. Complete the existing-cloud deployment/authentication gates in [SETUP.md](SETUP.md). Reuse the existing Convex deployment; a successful public simulation or `OPTIONS` request proves neither device ingestion nor authenticated operation.
3. Confirm the board's serial protocol against the bridge. The historical three-field JSON example lacks `calibrated:true` and is intentionally rejected by the current bridge. Recover and validate its real conversion/calibration before adapting the protocol; do not mark synthetic/unverified values calibrated.
4. Prepare the bridge environment (Linux/macOS commands below; Windows uses the virtual environment's `Scripts\activate`). List ports and select the actual one instead of assuming `COM3` or `/dev/ttyACM0`.

   ```bash
   python3 -m venv .venv
   . .venv/bin/activate
   python -m pip install requests pyserial
   python -m serial.tools.list_ports -v
   ```
5. In an authorized Devices session, register/select the actual device. Set `DWMS_HTTP_URL=https://canny-mosquito-637.convex.site`, its exact `DWMS_DEVICE_ID`, `DWMS_SERIAL_PORT` and secret `DWMS_API_KEY` in the local environment. Keep the key out of commands saved to history, screenshots and recordings. Run `python public/hardware/serial_bridge.py` only with the verified inactive bench setup and compatible firmware.
6. Observe raw serial output, accepted upload, correct selected-device receipt, history/alert and command/ACK as distinct checkpoints. The default template emits `CALIBRATION_REQUIRED`; receiving no measurement from that template is expected. Do not flash it over a previously working controller merely to produce a green dashboard.

The bridge retries USB with bounded backoff and discards delayed samples rather than replaying them as fresh. Successful authenticated polling renews a configured 15-second control lease; command expiry is 20 seconds, backend receipt freshness 10 seconds and local sensor freshness 5 seconds. These are software policies. Measure actual physical timing during commissioning; receipt time does not establish acquisition time.

## Calibration and commissioning procedure

1. **Identify and record.** Record the intake items above, firmware commit, operator/date, wiring and measured reference/supply. Leave repository sensor/relay enables at `0`; conversion remains unimplemented until model-specific evidence exists.
2. **Measure against standards.** Follow the exact manufacturer's procedure using traceable pH buffers, conductivity/TDS references and turbidity standards bracketing the intended range. Record lot/expiry, raw ADC/voltage, reference value, water temperature, stabilization and repeats. No temperature probe is included; document compensation assumptions.
3. **Implement and independently verify conversion.** Use only measured/module-approved equations in `readCalibratedSensors`. Check held-out references and repeated samples against agreed datasheet/reference tolerances; record residuals, uncertainty and drift. No generic coefficients or guessed thresholds establish accuracy.
4. **Prove invalid detection.** Unplug each probe separately and test abnormal/stale inputs. Floating analog inputs can look plausible; demonstrate invalid detection or add verified diagnostics before enabling operation. Range checks alone do not establish sensor-disconnection detection.
5. **Authorize isolated-load tests.** A qualified person verifies wiring/polarity/load compatibility and authorizes a separate bench setup before any temporary actuation. Independently observe inactive startup/reset, critical/stale input, USB loss, network loss, lease expiry and explicit recovered acknowledgement. Measure output directly; neither an ACK nor an undriven pin proves contact/pump state. Keep repository relay control disabled.
6. **Capture the complete trace.** Record reference/acquisition → receipt → alert → command → ACK → independently observed output, with clock method and timing uncertainty. Interrupt probe, USB and network separately, then repeat. Obtain two identified physical nodes and a supervised site observation before claiming validated multi-site operation.

Choose site-specific standards and acceptance criteria before testing. pH/TDS/turbidity do not establish microbiological safety, complete reuse compliance or treatment effectiveness. Record passed/failed observations, not an assumed physical pass from compilation or simulation.

## Compile evidence and remaining gate

```bash
# Arduino CLI 1.6.0; compile only, no upload or flag overrides:
bash scripts/compile-arduino.sh <evidence-dir>
```

The 2026-11-26 local rerun passed with `arduino:avr@1.8.6`, AVR GCC 7.3.0, `LiquidCrystal I2C@1.1.2`, FQBN `arduino:avr:uno`, and both source gates `0`. HEX SHA-256: `0c46970a95b127e0c865749a99043bc20ea7b7e77161689333ad456d99a29009`. Compiler estimates: 8,232 flash bytes and 772 static SRAM bytes. Only upstream core/LCD unused-parameter warnings occurred. These are build outputs, not physical measurements.

The [readiness record](VALIDATION.md) links exact CI evidence. **Still missing:** recovered historical firmware and identified modules, independent calibration records, verified disconnect diagnostics, physical relay/load/failure observations, complete acquired-data trace and two physical nodes. No calibration or relay enable was changed during this audit.
