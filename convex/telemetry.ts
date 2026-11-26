import { ConvexError, v } from "convex/values";

// Optional envelope: older calibrated gateways remain receipt-timed until upgraded.
export const telemetryFields = {
  sessionId: v.optional(v.string()),
  seq: v.optional(v.number()),
  gatewayObservedAt: v.optional(v.string()),
  sourceSequence: v.optional(v.number()),
  sourceUptimeMs: v.optional(v.number()),
};
export type Telemetry = {
  sessionId?: string; seq?: number; gatewayObservedAt?: string;
  sourceSequence?: number; sourceUptimeMs?: number;
};
type Watermark = {
  telemetrySessionId?: string; telemetrySeq?: number;
  telemetryObservedAt?: string; telemetryFingerprint?: string; telemetrySourceSequence?: number; telemetrySourceUptimeMs?: number;
};
function reject(message: string): never {
  throw new ConvexError({ code: "TELEMETRY_REJECTED", message });
}
export function validateEnvelope(frame: Telemetry, now: number): "gateway_observation" | "server_receipt" {
  const fields = Object.values(frame).filter(value => value !== undefined);
  if (!fields.length) return "server_receipt";
  if (!frame.sessionId || !/^[A-Za-z0-9_-]{16,64}$/.test(frame.sessionId) ||
      !Number.isSafeInteger(frame.seq) || frame.seq! < 1 ||
      typeof frame.gatewayObservedAt !== "string") reject("Incomplete telemetry identity.");
  const observed = Date.parse(frame.gatewayObservedAt!);
  if (!Number.isFinite(observed) || new Date(observed).toISOString() !== frame.gatewayObservedAt ||
      observed > now || now - observed > 10_000) reject("Telemetry is delayed, future-dated or has an invalid timestamp.");
  const hasSource = frame.sourceSequence !== undefined || frame.sourceUptimeMs !== undefined;
  if (hasSource && (![frame.sourceSequence, frame.sourceUptimeMs].every(
    value => Number.isInteger(value) && value! >= 0 && value! <= 0xFFFFFFFF,
  ))) reject("Controller sequence and uptime must be paired unsigned 32-bit values.");
  return "gateway_observation";
}
export function checkTelemetry(
  frame: Telemetry, watermark: Watermark, fingerprint: string, now: number,
): { duplicate: boolean; timeBasis: "gateway_observation" | "server_receipt" } {
  // Identify an exact retransmission before the age check. It never renews freshness.
  if (frame.sessionId && frame.sessionId === watermark.telemetrySessionId && frame.seq === watermark.telemetrySeq) {
    if (fingerprint !== watermark.telemetryFingerprint) reject("Conflicting telemetry identity.");
    return { duplicate: true, timeBasis: "gateway_observation" };
  }
  const timeBasis = validateEnvelope(frame, now);
  if (watermark.telemetrySessionId) {
    if (timeBasis === "server_receipt") reject("Receipt-only downgrade blocked after gateway upgrade.");
    if (frame.sessionId === watermark.telemetrySessionId && frame.seq! <= watermark.telemetrySeq!) reject("Replayed or out-of-order sequence.");
    if (frame.sessionId === watermark.telemetrySessionId && watermark.telemetrySourceSequence !== undefined &&
        (frame.sourceSequence === undefined || frame.sourceSequence <= watermark.telemetrySourceSequence)) reject("Controller sequence replay or downgrade.");
    if (frame.sessionId === watermark.telemetrySessionId && frame.sourceUptimeMs !== undefined &&
        watermark.telemetrySourceUptimeMs !== undefined && frame.sourceUptimeMs < watermark.telemetrySourceUptimeMs) reject("Controller restarted without a new gateway session.");
    if (frame.gatewayObservedAt! <= watermark.telemetryObservedAt!) reject("Replayed or out-of-order observation time.");
  }
  return { duplicate: false, timeBasis };
}
