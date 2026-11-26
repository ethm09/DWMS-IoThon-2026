# DWMS demo video — 100-second storyboard

**Display:** DWMS · Water Intelligence  
**Tagline:** Monitor. Detect. Respond.  
**Output:** 16:9, 1080p, English narration/subtitles. Keep a visible **SIMULATION** label throughout browser scenarios. This is a production script, not a claim that a video has been recorded or uploaded.

| Time | Exact shot / action | Narration | Evidence label |
|---|---|---|---|
| 00–08 | Title, then clean dashboard overview; keep source label visible | “DWMS helps a water operator monitor changes, detect threshold warnings and trace the response.” | Product introduction |
| 08–22 | Select Normal. Frame pH, TDS and turbidity, selected site and connection/freshness state. Do not present flow as a physical sensor | “We start with three water-quality channels: pH, TDS and turbidity. This public demonstration uses simulated readings; flow is demo-only.” | Simulation verified |
| 22–36 | Select Warning, then Response. Pause on status, alert and simulated action | “Warnings flag readings outside configured prototype bands. In Auto, a response rule requests the demonstration output. AI is optional; deterministic rules govern the response.” | Simulation verified |
| 36–52 | Select Critical; show simulated OFF and acknowledgement disabled. Select Recovery; show latch retained; acknowledge | “Critical readings latch a stop. Returning readings alone cannot clear it. An operator must explicitly acknowledge recovery.” | Simulation verified |
| 52–65 | Show a genuine stale/disconnected UI state if the redesigned demo exposes it; otherwise show the recorded integration runner's stale-data checkpoint with a clear software-test title | “Data age is separate from water status. Missing or stale data must remain unknown, and an unconfirmed command is not proof of physical action.” | Simulation/software test; never staged as a real outage |
| 65–78 | Actual screen recording of `pnpm demo:e2e` result; frame real checkpoint names, no secrets | “The isolated integration run exercises real ingestion, database subscriptions, alerts and commands. Its samples, operator identity and controller acknowledgements are synthetic.” | Software verified |
| 78–88 | Architecture diagram plus actual Uno compilation evidence. Use a static hardware diagram if no genuine footage exists | “The Uno target build passes. Calibrated probes and relay commissioning still require independent physical validation.” | Software verified; diagram, not hardware footage |
| 88–100 | Return to clean overview; end card with repository and public software-demo link | “Our first proposed pilot is a supervised reuse buffer tank with an industrial utilities engineer. Next, we validate the measured sensor-to-output trace. Monitor. Detect. Respond.” | Proposed pilot; no customer claim |

## Capture and editing notes

- Record the actual reviewed application and runner; crop passwords, API keys, private URLs, browser account details and terminal credentials.
- Start from Reset demo, avoid fast pointer movement, pause long enough to read the three channels and the source badge, and keep subtitles clear on a phone-sized preview.
- Use the current deployed revision. If a shot's control is unavailable, replace it with the genuine recorded test checkpoint; do not animate a fake result into the dashboard.
- Screen recording is feasible now. Real probe/relay footage must come from an identified bench setup and the owner/operator; no stock video, generated hardware imagery or compilation output may stand in for physical validation.

## Optional physical-footage replacement — only after evidence exists

Replace part of 65–88 seconds with a continuous, date/version-labeled shot of identified probes beside independent references, the actual bridge/dashboard reading and an independently observed isolated-load response. Include a real fault/recovery observation if safely commissioned. Keep remaining simulated shots labeled. Until those records exist, retain the honest software/diagram sequence above.

End-card credit: **Ahmed Alzahrani — Founder and Project Lead** (owner-confirmed). Preserve verified original contributor credits; do not invent roles.

**Pending before publication:** actual recording, narration/subtitles, exact portal duration/file/link requirements, final review and hosted video URL. The 100-second duration is this storyboard's choice within the requested 60–120 seconds; it is not a verified portal limit.
