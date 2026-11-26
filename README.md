# DWMS — water-quality monitoring

**IoThon 2026:** IoT water-quality monitoring for networks, reservoirs, and treated-water reuse.

DWMS focuses on **pH, TDS and turbidity → threshold alerts → deterministic response → controller acknowledgement**. The existing React/Convex application provides device selection, stored trends, receipt freshness and rule-based Auto / Manual / latched Emergency control. AI assistance is optional.

[Public software demo](https://dwms-iothon-competition-demo.merryllama4097.chatgpt.site) — synthetic browser scenarios, no login or relay operation.

## Run the local demo

Use Node.js 24 and pnpm 10:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open the printed URL and choose **Local demo**. Its fixed scenarios need no accounts or probes; they send no hardware commands and save no device history.

- **[Competition readiness checklist](docs/VALIDATION.md)** — evidence, blockers and calibration procedure.
- **[Demo runbook](docs/DEMO.md)** — browser simulation, connected software injection and physical demonstration.
- [Setup](docs/SETUP.md) · [Architecture](docs/ARCHITECTURE.md) · [Audit and priorities](docs/AUDIT.md) · [Competition / feasibility / pitch](docs/COMPETITION.md)

## Evidence boundary

The Arduino firmware is calibration-disabled: `readCalibratedSensors` still needs measured, module-specific conversion equations. Relay control remains disabled pending physical safety checks. Software tests or a board build do not establish probe accuracy, actual pump motion or water-safety compliance. Current evidence is tracked in the single checklist above.

```bash
pnpm test
pnpm lint
pnpm build
```

Connected operation requires separate Convex/Auth0 configuration and the Python USB-to-HTTPS bridge. Device keys protect ingestion and controls, but registry/history queries currently permit public reads; tenant isolation is not implemented.
