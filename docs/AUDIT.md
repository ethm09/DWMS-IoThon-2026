# Audit and implementation priorities

Inspected `main` at `d48b6784ff9c89db27630e8e0fb246c42cd93fe9` before modifying. Improvement branch: `improve/iothon-2026-focus`.

## KEEP

Existing React/Convex/Auth0 architecture; validated device-authenticated ingestion; device key redaction; shared threshold primitives; Emergency latch and acknowledged/expiring commands; per-device locations/history; calibration-disabled firmware safeguards.

## REMOVE

Duplicate readings, decorative pipeline animation and navigation sprawl; operational presentation of generated histories, unsupported sensors/site metrics and ineffective local-only threshold edits. Redirect illustrative pages to real stored history/sites while retaining source for reference. Remove the obsolete archive-extraction workflow.

## FIX

Browser/backend rule disagreement; stale data shown as normal; desired-state-only command suppression; offline alerts without a stop request; bridge type/JSON handling; USB recovery; firmware lease/duplicate/overflow handling; absent behavioral tests. These are targeted corrections within the existing architecture.

## VALIDATE

The [single readiness checklist](VALIDATION.md) tracks input/auth/rule/failure tests, CI, target build, connected demonstration and remaining physical gates. Module-specific conversions are still required for actual probe data.

## COMPETITIVE ADVANTAGES

A readable monitoring view with deterministic decisions, explicit reading age and traceable command outcomes. Registered sites and indexed histories provide a distributed prototype foundation. No measured accuracy, latency, uptime, savings or fleet-capacity advantage is claimed.

## Prioritized plan

1. **P0:** safety/ingestion/freshness/connectivity fixes with regression tests.
2. **P1:** focused dashboard, stored history/sites and repeatable labeled demonstration.
3. **P1:** verify exact software/target/deployment evidence, then complete calibrated bench integration.
4. **Later:** acquisition timestamps/replay protection, site access, retention and field/load validation. No framework or architecture replacement is needed for competition readiness.
