# DWMS Architecture

## Layers

1. **Sensing / Edge** — pH, TDS, and turbidity measurements from the field node.
2. **IoT transport / backend** — Convex stores devices and sensor readings and supports application queries/mutations.
3. **Safety Engine** — deterministic threshold/state logic for warning and critical conditions.
4. **Operator interface** — dashboard, alerts, analytics, historical views, reports, and device management.
5. **AI explanation layer** — Ethm can explain readings and assist operators but must not override deterministic safety logic.

## Data path

`Sensors → Edge Controller → IoT Backend → Safety Engine → Dashboard / Alerts → Operator`

## Operating modes

The product distinguishes hardware/live data from simulation/demo data. A loss of hardware connectivity should be visible as a connection/data-quality state rather than silently presenting demo values as live measurements.

## Safety state model

A practical lifecycle is:

`NORMAL → WARNING → CRITICAL/EMERGENCY → RECOVERY`

Invalid or missing sensor values should be treated as `UNKNOWN/INVALID`, not as safe values.

## Security principles

- Authentication and authorization are enforced server-side.
- Device API credentials must never be exposed in public device listings or frontend payloads.
- Device credentials should use cryptographically secure random generation and support rotation/revocation.
- Secrets belong in environment/deployment configuration, never source control.
- Administrative actions and threshold changes should be auditable.

## Scalability

The architecture supports a single prototype node and can extend to multiple distributed nodes through a shared device registry and backend data model.
