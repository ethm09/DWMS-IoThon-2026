# Competition demo runbook

Present all four components honestly: **Live** is the authenticated cloud path, **Demo** combines synthetic browser state with isolated genuine guest AI, **Hardware** includes a reported earlier prototype awaiting recovery, and **Ethm** is the read-only Water Intelligence Engine. Its guest path explains canonical simulated evidence; its separate Live path requires approved authentication. Real Live-session acceptance and audited physical results remain distinct from the verified public guest conversations. `/live` is explicitly disabled until the callback/session rehearsal passes; its unavailable state is not a live feed or a model reply.

| Demonstration             | What it proves                                                                           | What remains simulated                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Public dashboard          | Readable monitoring, Ethm evidence panel, trends and repeatable rule response            | All readings/output state; no operational device records or commands                       |
| Guest Ethm                | Genuine English/Arabic model interpretation, context/history and reviewed citations      | All sensor/response evidence; session/history writes are confined to dedicated Demo tables |
| Isolated connected runner | HTTP ingestion, real local Convex persistence/subscription, alerts and command lifecycle | Sensor input, test identity and controller ACK; no probes/relay                            |
| Physical bench            | Calibrated probes through bridge/backend/dashboard to independently observed output      | Nothing may be represented as physical until its checklist gate passes                     |

## 1. Local dashboard — reliable presentation fallback

Open the [public software demo](https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site/demo) or run `pnpm dev` and open `/demo`. `/` is the product introduction. Judges need no account or client API key. The existing backend supplies quota-limited guest AI; the deterministic scenarios/reports remain available if that service is unavailable. The single site **Reservoir demo / SIMULATION-NODE-01** is synthetic; flow is a fixed demo-only value.

| Action                          | Expected result                                                   |
| ------------------------------- | ----------------------------------------------------------------- |
| **Reset demo** / **1 · Normal** | pH 7.2, TDS 300 ppm, turbidity 2 NTU; within prototype limits     |
| **2 · Warning**                 | TDS 650 ppm, turbidity 8 NTU; warning                             |
| **3 · Response**                | Turbidity 25 NTU; simulated Auto output ON                        |
| **4 · Critical**                | pH 4.5; simulated OFF, Emergency latched; acknowledgement blocked |
| **5 · Recovery**                | Normal readings return; latch remains                             |
| **Acknowledge recovery**        | Local recovered acknowledgement clears the latch                  |

Say: “These readings and output are simulated. The response uses deterministic thresholds.” Show the source badge, three readings, warning, response, critical stop and recovery; navigate Alerts, History and Sites to show shared browser-demo state. Sensor alerts clear on recovery, while the controller latch remains until acknowledgement. No backend device history is written and no relay command is sent.

## Ask Ethm without an account

After loading Critical, open **Ethm** or **Ask Ethm**. Submit a question about the current incident; prompts only draft text and never make a model request until **Send**. The answer is genuine AI analysis of canonical simulated data, with evidence timestamps and relevant reviewed citations. Switch to Arabic for a natural-language follow-up. Load Recovery, then ask why the emergency latch remains and whether the short history supports a forecast. No forecast should be invented from insufficient data. Respect the visible request cooldown and shared session allowance; limits never trigger a fake substitute reply.

Use **Export report** to download a summary, daily/weekly, incident, trend or device-evidence PDF/CSV. Only loaded records are included. Daily/weekly coverage is explicitly partial; these reports do not establish uptime, complete incident counts, regulatory compliance or physical performance. Export generation makes no model request.

## 2. Connected software path — isolated, injected evidence

```bash
pnpm install --frozen-lockfile
pnpm demo:e2e
```

Run on Linux/macOS with Node.js 24, installed dependencies and network access for anonymous Convex initialization/first backend download. No Auth0, probes or deployment environment is required. The runner creates a disposable loopback backend using the real functions/schema, a synthetic operator and two test devices, then cleans up. It never uses a physical node key or production history. This is a programmatic connected-path test; it does not open a dashboard browser.

The runner now includes 11 checkpoints, including real concurrent guest reservations that allow only one pending request. It does not contact a model. Expected monitoring checkpoints: invalid/auth rejection → real database/reactive query readings → warning notification → response command and simulated ACK → critical latched OFF → explicit recovered acknowledgement → actual scheduled stale-data OFF. Inspect the named checkpoints in its output. The reactive queries are the data path used by the dashboard; the Local demo above verifies the visual workflow separately. A subscription is not a probe measurement or proof of physical pump motion. The local test identity does not validate a real Auth0 login.

Record the runner result in the [readiness checklist](VALIDATION.md). Do not describe injected telemetry as calibrated hardware data, even if it passes the same endpoint used by the bridge.

## 3. Physical end-to-end demonstration — gated

Prerequisites: recovery and commissioning through [HARDWARE.md](HARDWARE.md), configured Auth0/Convex, a registered physical node, bridge, isolated load and references. The owner reports earlier physical operation, but that setup is unavailable; the checked-in disabled template is not its recovered firmware or a new physical validation result.

1. Once Auth0 and hardware gates pass, open `/live` and select the physical node. Show its ID/location, three live values and receipt age; compare measurements to independent references.
2. Introduce an approved warning/response condition. Show live monitoring, saved alert, command pending → ACK/applied or failed, and independently observed output.
3. Introduce a critical condition, observe OFF and latch, restore acceptable readings, then explicitly acknowledge recovery.
4. Disconnect probe, USB and network separately. Show stale/unknown status and local watchdog behavior; measure actual stop/reconnect timing.
5. Record version, probe/calibration records, raw samples, alert/command timestamps and independent output observations. Show separate histories for a second node only if one actually exists.

If the physical path is unavailable, state the blocked gate and use mode 1 or 2 with its label. Do not silently substitute simulation for a failed live feed. Threshold warning is not contamination prediction; the three probes do not establish potable-water or reuse compliance.
