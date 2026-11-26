# DWMS — water-quality monitoring

**IoThon 2026:** IoT water-quality monitoring for networks, reservoirs, and treated-water reuse.

DWMS is an existing React/Convex prototype focused on **pH, TDS and turbidity → threshold alerts → deterministic response → controller acknowledgement**. Operators can inspect a selected device, stored readings, data freshness and control state. Devices have separate credentials and locations.

## Try the local demo

Requires Node.js 24 and pnpm 10; no cloud account, probes or AI key is needed for the dashboard demo.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open the printed local URL and use the dashboard's labeled simulation scenarios. Values and responses are simulated in the browser; they do not operate hardware or enter the device history. See the [demo runbook](docs/DEMO.md).

## What is implemented

- Validated, device-authenticated HTTP ingestion and reactive dashboard subscriptions.
- Warning/critical thresholds and backend Auto / Manual / latched Emergency control.
- Short-lived commands, controller acknowledgements and explicit unknown/stale states.
- Per-device registry, location and indexed reading history for a multi-site foundation.
- Arduino Uno firmware and a Python USB-to-HTTPS bridge.

The firmware is a **calibration-disabled template**: `readCalibratedSensors` needs verified module-specific conversion equations before it can produce measurements. Relay control is also disabled by default. A serial acknowledgement reports software relay state; there is no pump-motion or relay-contact feedback sensor.

## Architecture

```text
pH / TDS / turbidity → Arduino Uno → USB / Python bridge → Convex
                                                           ↕
                                        rules / alerts / command log
                                                           ↕
                                                  React dashboard
```

The deterministic rules govern control. Optional AI assistance explains data and remains subject to backend authorization and interlocks. It is not required for monitoring or the demo.

## Verify and connect

```bash
pnpm test
pnpm lint
pnpm build
```

Software tests, CI checks and physical validation are separate evidence levels. Read the [validation checklist](docs/VALIDATION.md) for scope and outstanding bench work. Prototype thresholds do not establish potable-water compliance or treatment effectiveness.

- [Installation, Auth0, Convex and hardware setup](docs/SETUP.md)
- [System architecture and limitations](docs/ARCHITECTURE.md)
- [Audit and implementation priorities](docs/AUDIT.md)
- [Competition evidence, feasibility study and pitch outline](docs/COMPETITION.md)
- [Environment variable template](.env.example)
