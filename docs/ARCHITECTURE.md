# DWMS Architecture

## Layers

1. **Sensing / Edge** — pH, TDS, and turbidity measurements from the field node.
2. **IoT transport / backend** — Convex stores devices and sensor readings and supports application queries/mutations.
3. **Safety Engine** — deterministic threshold/state logic for warning and critical conditions.
4. **Operator interface** — dashboard, alerts, analytics, historical views, reports, and device management.
5. **AI explanation layer** — Ethm can explain readings and assist operators but must not override deterministic safety logic.

## Telemetry path

`pH / TDS / turbidity probes → Arduino Uno → USB serial → Python bridge → Convex HTTP action → Convex database → dashboard / alerts`

The Arduino sketch emits readings only after its module-specific conversion functions are implemented and calibration is enabled. The bridge refuses to upload payloads not explicitly marked calibrated. Flow, temperature, and pressure are not stored as live readings because no matching hardware source is present.

## Control path

`Operator UI → authenticated Convex mutation → short-lived device command → authenticated bridge poll → Arduino relay interlock → serial acknowledgement → Convex status → dashboard`

The backend authorizes only admin/operator roles. Manual pump starts require a fresh reading and reject critical pH or turbidity. In Auto mode, the backend starts filtration for prototype TDS/turbidity triggers and stops when those readings return below the current thresholds. Critical pH or turbidity causes a latched stop; an operator must acknowledge after a fresh reading confirms recovery. Commands expire after 20 seconds without an Arduino acknowledgement and the UI displays the controller-reported state as unknown when telemetry is stale. The hardware does not report relay-contact or pump-motion feedback.

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
- Physical relay control remains disabled in the included sketch until the sensor conversions and relay polarity are verified for the installed hardware.
- Prototype thresholds and controller behavior are not certified industrial protections.

## Scalability

The architecture supports a single prototype node and can extend to multiple distributed nodes through a shared device registry and backend data model.
