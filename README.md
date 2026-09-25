# DWMS — Defense Water Monitoring System

**IoThon 2026 — IoT water-quality monitoring for networks, reservoirs, and treated-water reuse**

DWMS is a prototype distributed IoT platform for monitoring water quality using pH, TDS, and turbidity sensing, with alerts, operator dashboards, deterministic safety logic, and an extensible path toward automated protection.

**Sense → Analyze → Alert → Protect → Record**

## Prototype architecture

```text
Water Source
    ↓
Sensors (pH / TDS / Turbidity)
    ↓
Edge Controller
    ↓
IoT Backend (Convex)
    ↓
Safety Engine + Alerting
    ↓
Dashboard / Operator / AI Explanation
```

## Core capabilities

- Real-time water-quality monitoring
- Device registration and multi-node architecture
- pH, TDS, and turbidity readings
- Warning/critical alerting
- Auto / Manual / Emergency operating concepts
- Historical data, analytics, reports, and activity logging
- PWA support
- Simulation/demo mode for competition demonstration
- AI assistant for explanation and decision support

## Safety boundary

The deterministic Safety Engine is the authority for threshold evaluation. The AI assistant is intended to explain readings and support operators; it is not the safety controller. This prototype is not presented as a certified industrial safety or SIL system.

## Evidence boundary

Where hardware is not physically connected, the interface must clearly identify simulated/demo data. Flow rate is not represented as a physical live sensor unless a corresponding hardware source is connected.

## Demo

https://dwms.onhercules.app/

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Competition notes](docs/COMPETITION.md)
- [Environment variables](.env.example)

## Development

This project uses Vite, React, TypeScript, Convex, and Hercules OIDC authentication. Convex generated bindings are environment/deployment generated and are intentionally not included in this source package.

Never commit real environment variables, API keys, tokens, or deployment secrets.
