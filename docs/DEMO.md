# Competition demo runbook

## Reliable browser demonstration

Run the [local setup](SETUP.md), open `/` and choose **Local demo**. It needs no Auth0, cloud deployment or AI key. This is a browser simulation of shared thresholds and response logic, not hardware evidence.

| Step | Action | Expected visible result |
|---|---|---|
| 1 | **Reset demo** / **1 · Normal** | pH 7.2, TDS 300 ppm, turbidity 2 NTU; normal threshold status |
| 2 | **2 · Warning** | TDS 650 ppm and turbidity 8 NTU; warning before critical levels |
| 3 | **3 · Response** | Turbidity 25 NTU; simulated Auto pump request ON |
| 4 | **4 · Critical** | pH 4.5; simulated pump OFF and Emergency latched |
| 5 | **5 · Recovery** | Normal readings return; Emergency remains latched |
| 6 | **Acknowledge recovery** | Local acknowledgement clears the recovered Emergency |

Narration: “These values are simulated. The rule response is deterministic. The live path adds device authentication, data validation, command expiry and controller acknowledgements.” Show the sensor trace and explain that a warning is a threshold crossing, not a prediction of contamination.

The demo does not save device readings or send a relay command. Resetting returns the scenario to a repeatable state. If persistent settings opened Device data mode, switch back to Local demo.

## Connected demonstration — only after physical gates pass

Prerequisites: completed calibration/relay checks in [VALIDATION.md](VALIDATION.md), a configured Convex/Auth0 deployment, a registered node, the serial bridge, an isolated bench load and an independent reference instrument. The checked-in conversion placeholder blocks this demonstration until implemented and verified.

1. Choose **Device data** and the registered device. Show its ID/location, server receipt time, three probe readings and reported output state.
2. Compare the display with independent probe references. Record the sample/reference values and timestamp; do not describe visual similarity as calibrated accuracy.
3. Introduce an approved bench condition crossing a warning and then response threshold. Show the stored reading, rule decision, pending command, serial ACK and applied/failed command status.
4. Introduce a critical condition. Show the Emergency latch, OFF request and independently observed bench output.
5. Restore acceptable readings. Show that operator acknowledgement is needed before recovery.
6. Disconnect a sensor, then USB, then network, one at a time. Show stale/unknown status, local stop/watchdog behavior and reconnection. Record observed timing; do not substitute configured timeouts for measured stop latency.
7. If a second physical node exists, register/select it and show independent history and state. With one node, describe multi-site support as a data-model/UI capability only.

Keep a short screen recording of an actual successful rehearsal, with version, date, configuration and evidence label. If hardware is unavailable or fails, switch explicitly to Local demo and say which part is simulated; do not show simulated data as a recovered live connection.

## Evidence to bring

- Tested commit and local/CI check results.
- Probe models, calibration records and reference measurements.
- Timestamped video/log of reading → rule → command → ACK → observed output.
- Disconnect/recovery observations, known limitations and next validation steps.

A screenshot of a normal dashboard proves interface behavior only. No drinking-water compliance, treatment effectiveness, response-time target or field uptime claim follows from this demo.
