# Competition brief

**Challenge:** IoT water-quality monitoring for networks, reservoirs, and treated-water reuse.

DWMS connects pH/TDS/turbidity monitoring with threshold alerts and traceable rule-based response. Evidence and unfinished gates are maintained only in [VALIDATION.md](VALIDATION.md).

| Strength | Credible software advantage | Claim boundary |
|---|---|---|
| Real-time monitoring | Validated ingestion and reactive selected-device readings | Physical delay/accuracy unmeasured |
| Early anomaly detection | Warning bands before critical thresholds | Threshold detection; no predictive accuracy claim |
| Rule-based response | Shared policy, interlocks and latched recovery | Physical output/treatment needs validation |
| Connectivity | Stale/unknown states, command ACK/expiry and local watchdog | No field uptime guarantee |
| Multi-site monitoring | Registered locations and per-device history/control | Physical node count and fleet capacity need evidence |
| Hardware integration | Uno → serial/Python → HTTPS/Convex → dashboard + ACK path | Compile/injected evidence does not prove calibrated sensing |

## Feasibility study outline

1. Select one pilot site/operator and applicable standards; define missing parameters beyond the three probes.
2. Identify exact sensors, calibration/cleaning needs, enclosure, power and bridge-host/network requirements. Approve the control action for that process.
3. Obtain dated supplier quotes for probes, controller, LCD/relay/isolation, host, enclosure/power, installation and reference instruments. Include cleaning/replacement and cloud/network recurring cost from measured use; do not invent totals.
4. Measure baseline versus pilot alert/acknowledgement time, sample completeness, false/missed alerts, maintenance effort and cost. Meter water/energy independently if claiming savings.
5. Gate conversion/calibration → isolated-load faults → two-node pilot → field observation. Name owners and acceptance criteria before tests; review access, retention, credential lifecycle and scale.

## Pitch deck outline

1. Concrete operator problem and sourced pilot evidence.
2. Focused dashboard: source, three readings, status and action.
3. One reading and acknowledged command through the architecture.
4. [Demo](DEMO.md): warning → response → critical stop → recovered acknowledgement, with evidence labels.
5. Reliability evidence and unresolved physical gates from the readiness checklist.
6. Registered sites; distinguish software support from physical node count.
7. Quoted costs, maintenance plan and measured-impact pilot design.
8. Readiness, next validation gate and pilot request.

Keep AI secondary. No unmeasured performance, compliance, autonomous-treatment or competitor-uniqueness claims belong in the pitch.
