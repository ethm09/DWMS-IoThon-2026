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

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Competition notes](docs/COMPETITION.md)
- [Environment variables](.env.example)

## Development

This project uses Vite, React, TypeScript, Convex, and Auth0 authentication. Convex generates the `convex/_generated` bindings from the local schema and functions; those generated files are not included in this source package.

Install dependencies, then run `pnpm exec convex dev` in one terminal to select or create a development deployment and generate the Convex bindings. Keep it running while you use the app. Set `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` for that deployment, then run `pnpm dev` in a second terminal. A production deployment is not needed for local development.

### Configure Auth0

Create an Auth0 Single Page Application and add the local and deployed callback URLs (`http://localhost:5173/auth/callback` and `<your-site-origin>/auth/callback`), logout URLs, and web origins. Copy the Auth0 domain and client ID into `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID`.

Set the same Auth0 domain and client ID as `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID` in the Convex deployment environment, then run `pnpm exec convex dev` or `pnpm exec convex deploy` to publish the auth provider configuration. Until both server-side values are configured, Convex remains in guest/local mode. The first login links an existing DWMS user by verified email so their stored role is retained.

### Configure the AI assistant

Set `OPENAI_API_KEY` as a server-side environment variable for the Convex deployment. The key is used only by the Convex action and must not be prefixed with `VITE_`.

Set `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` for the selected Convex deployment. The device setup page uses the Convex site URL for the Arduino HTTP endpoint.

Never commit real environment variables, API keys, tokens, or deployment secrets.
