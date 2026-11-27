import { internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireFleetAccess } from "./users";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { isFreshTimestamp, isValidSensorValues } from "./safetyPolicy";
import {
  analyzeSensorTrends as analyzeTrendData,
  analyzeWaterQuality as analyzeQualityData,
  evaluateSafetyState as evaluateSafetyData,
  type AgentReading,
} from "./agentAnalysis";

async function getDevice(ctx: QueryCtx, deviceId: string) {
  return await ctx.db
    .query("devices")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
    .unique();
}

async function getLatestReading(ctx: QueryCtx, deviceId: string) {
  return await ctx.db
    .query("sensorReadings")
    .withIndex("by_deviceId_timestamp", (q) => q.eq("deviceId", deviceId))
    .order("desc")
    .first();
}

function toAgentReading(reading: Doc<"sensorReadings">): AgentReading {
  return {
    ph: reading.ph,
    tds: reading.tds,
    turbidity: reading.turbidity,
    timestamp: reading.timestamp,
  };
}

function deviceStatus(device: Doc<"devices">, now = Date.now()) {
  return device.status === "online" && !isFreshTimestamp(device.lastSeen, now)
    ? "offline"
    : device.status;
}

function pumpReport(device: Doc<"devices">, now = Date.now()) {
  return isFreshTimestamp(device.pumpReportedAt, now)
    ? (device.reportedPumpState ?? null)
    : null;
}

function readingDetails(reading: Doc<"sensorReadings">) {
  const timeBasis = reading.timeBasis ?? "server_receipt";
  return {
    ...toAgentReading(reading),
    timeBasis,
    receivedAt:
      reading.receivedAt ??
      (timeBasis === "server_receipt" ? reading.timestamp : null),
  };
}

function validHistoricalReading(reading: Doc<"sensorReadings">, now: number) {
  const timestamp = Date.parse(reading.timestamp);
  return (
    isValidSensorValues(reading) &&
    Number.isFinite(timestamp) &&
    timestamp <= now
  );
}

function readingContext(
  device: Doc<"devices"> | null,
  reading: Doc<"sensorReadings"> | null,
  now = Date.now(),
) {
  const age = reading ? now - Date.parse(reading.timestamp) : NaN;
  const valid =
    reading && isValidSensorValues(reading) && Number.isFinite(age) && age >= 0;
  const live =
    valid &&
    device &&
    deviceStatus(device, now) === "online" &&
    isFreshTimestamp(reading.timestamp, now);
  return {
    available: !!valid && !!device,
    mode: valid && device ? "HARDWARE" : "UNKNOWN",
    freshness: !reading
      ? "UNAVAILABLE"
      : !valid
        ? "INVALID"
        : live
          ? "LIVE"
          : "STALE",
    ageMs: Number.isFinite(age) && age >= 0 ? age : null,
    deviceStatus: device ? deviceStatus(device, now) : "unknown",
    readingTimestamp: reading?.timestamp ?? null,
    reason: !device
      ? "Device not found."
      : !reading
        ? "No persisted hardware reading is available; demo state is not used by Ethm."
        : !valid
          ? "The persisted reading has invalid values or an invalid/future timestamp; do not treat it as current measurement evidence."
          : live
            ? null
            : "Persisted reading is historical or device connectivity is stale; current conditions are unknown.",
  };
}

export const listDevices = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireFleetAccess(ctx);
    const devices = await ctx.db.query("devices").take(100);
    return devices.map((device) => ({
      deviceId: device.deviceId,
      name: device.name,
      location: device.location ?? null,
      status: deviceStatus(device),
      lastSeen: device.lastSeen ?? null,
      controlMode: device.controlMode ?? "auto",
      desiredPumpState: device.desiredPumpState ?? false,
      reportedPumpState: pumpReport(device),
      pumpReportedAt: device.pumpReportedAt ?? null,
    }));
  },
});

export const getLatestSensorReadings = internalQuery({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    await requireFleetAccess(ctx);
    const [device, reading] = await Promise.all([
      getDevice(ctx, args.deviceId),
      getLatestReading(ctx, args.deviceId),
    ]);
    const context = readingContext(device, reading);
    return {
      ...context,
      source: "device-ingested-hardware-data",
      deviceId: args.deviceId,
      reading: context.available && reading ? readingDetails(reading) : null,
    };
  },
});

export const getRecentSensorReadings = internalQuery({
  args: { deviceId: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    await requireFleetAccess(ctx);
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit)));
    const readings = await ctx.db
      .query("sensorReadings")
      .withIndex("by_deviceId_timestamp", (q) =>
        q.eq("deviceId", args.deviceId),
      )
      .order("desc")
      .take(limit);
    const now = Date.now();
    const validReadings = readings.filter((reading) =>
      validHistoricalReading(reading, now),
    );
    return {
      deviceId: args.deviceId,
      source: "device-ingested-hardware-data",
      count: validReadings.length,
      excludedInvalidCount: readings.length - validReadings.length,
      readings: validReadings.map(readingDetails),
    };
  },
});

export const getDeviceStatus = internalQuery({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    await requireFleetAccess(ctx);
    const device = await getDevice(ctx, args.deviceId);
    if (!device) return { available: false, reason: "Device not found." };
    const command = device.lastCommandId
      ? await ctx.db
          .query("deviceCommands")
          .withIndex("by_commandId", (q) =>
            q.eq("commandId", device.lastCommandId!),
          )
          .unique()
      : null;
    return {
      available: true,
      deviceId: device.deviceId,
      name: device.name,
      location: device.location ?? null,
      status: deviceStatus(device),
      lastSeen: device.lastSeen ?? null,
      controlMode: device.controlMode ?? "auto",
      desiredPumpState: device.desiredPumpState ?? false,
      reportedPumpState: pumpReport(device),
      pumpReportedAt: device.pumpReportedAt ?? null,
      lastControlMessage: device.lastControlMessage ?? null,
      latestCommand: command
        ? {
            status: command.status,
            pumpOn: command.pumpOn,
            source: command.source,
            createdAt: command.createdAt,
            acknowledgedAt: command.acknowledgedAt ?? null,
            message: command.message ?? null,
          }
        : null,
    };
  },
});

export const getActiveAlerts = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await requireFleetAccess(ctx);
    if (user._id !== args.userId)
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot read another user's notifications.",
      });
    const alerts = await ctx.db
      .query("notifications")
      .withIndex("by_userId_dismissed", (q) =>
        q.eq("userId", args.userId).eq("dismissed", false),
      )
      .order("desc")
      .take(50);
    return alerts.map((alert) => ({
      level: alert.level,
      category: alert.category,
      title: alert.title,
      message: alert.message,
      parameter: alert.parameter ?? null,
      value: alert.value ?? null,
      read: alert.read,
      createdAt: alert.createdAt,
    }));
  },
});

export const getRecentAlerts = internalQuery({
  args: { userId: v.id("users"), limit: v.number() },
  handler: async (ctx, args) => {
    const user = await requireFleetAccess(ctx);
    if (user._id !== args.userId)
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot read another user's notifications.",
      });
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit)));
    const alerts = await ctx.db
      .query("notifications")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
    return alerts.map((alert) => ({
      level: alert.level,
      category: alert.category,
      title: alert.title,
      message: alert.message,
      parameter: alert.parameter ?? null,
      value: alert.value ?? null,
      read: alert.read,
      dismissed: alert.dismissed,
      createdAt: alert.createdAt,
    }));
  },
});

export const getSystemMode = internalQuery({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    await requireFleetAccess(ctx);
    const device = await getDevice(ctx, args.deviceId);
    if (!device)
      return { available: false, mode: "unknown", reason: "Device not found." };
    return {
      available: true,
      deviceId: device.deviceId,
      mode: device.controlMode ?? "auto",
      source: "Convex device control state",
    };
  },
});

export const getDataMode = internalQuery({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    await requireFleetAccess(ctx);
    const [device, reading] = await Promise.all([
      getDevice(ctx, args.deviceId),
      getLatestReading(ctx, args.deviceId),
    ]);
    const context = readingContext(device, reading);
    return {
      ...context,
      timeBasis: reading?.timeBasis ?? (reading ? "server_receipt" : null),
      receivedAt: reading ? readingDetails(reading).receivedAt : null,
      source: "Arduino/device ingestion endpoint",
      note:
        context.freshness === "LIVE"
          ? "Recent device-ingested reading; gateway/receipt time is not independently established probe acquisition time or calibration evidence."
          : context.reason,
    };
  },
});

export const evaluateSafetyState = internalQuery({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    await requireFleetAccess(ctx);
    const [device, reading] = await Promise.all([
      getDevice(ctx, args.deviceId),
      getLatestReading(ctx, args.deviceId),
    ]);
    const context = readingContext(device, reading);
    if (context.freshness !== "LIVE") {
      return {
        ...evaluateSafetyData(null),
        reason:
          context.reason ??
          "Fresh device telemetry is required for safety evaluation.",
        deviceStatus: context.deviceStatus,
        emergencyLatched: device?.controlMode === "emergency",
      };
    }
    const result = evaluateSafetyData(reading ? toAgentReading(reading) : null);
    if (device?.controlMode === "emergency") {
      return {
        ...result,
        state: "critical" as const,
        emergencyLatched: true,
        pumpStartAllowed: false,
        automaticFiltrationRequested: false,
        reason:
          "Emergency mode remains latched. Recovered readings alone cannot permit restart; an authorized operator must acknowledge recovery through the dedicated control panel.",
      };
    }
    return { ...result, emergencyLatched: false };
  },
});

export const analyzeWaterQuality = internalQuery({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    await requireFleetAccess(ctx);
    const [device, reading] = await Promise.all([
      getDevice(ctx, args.deviceId),
      getLatestReading(ctx, args.deviceId),
    ]);
    const context = readingContext(device, reading);
    return {
      ...analyzeQualityData(
        context.available && reading ? toAgentReading(reading) : null,
      ),
      freshness: context.freshness,
      dataNote: context.reason,
      timeBasis: reading?.timeBasis ?? (reading ? "server_receipt" : null),
    };
  },
});

export const analyzeSensorTrends = internalQuery({
  args: { deviceId: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    await requireFleetAccess(ctx);
    const limit = Math.max(3, Math.min(50, Math.floor(args.limit)));
    const readings = await ctx.db
      .query("sensorReadings")
      .withIndex("by_deviceId_timestamp", (q) =>
        q.eq("deviceId", args.deviceId),
      )
      .order("desc")
      .take(limit);
    const now = Date.now();
    const validReadings = readings.filter((reading) =>
      validHistoricalReading(reading, now),
    );
    return {
      ...analyzeTrendData(validReadings.map(toAgentReading)),
      excludedInvalidCount: readings.length - validReadings.length,
      timestampNote:
        "Trend times use gateway observation or legacy server receipt, not independently established probe acquisition time.",
    };
  },
});

export const getRecentEvents = internalQuery({
  args: { deviceId: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    await requireFleetAccess(ctx);
    const limit = Math.max(1, Math.min(30, Math.floor(args.limit)));
    const events = await ctx.db
      .query("deviceCommands")
      .withIndex("by_deviceId_createdAt", (q) =>
        q.eq("deviceId", args.deviceId),
      )
      .order("desc")
      .take(limit);
    return events.map((event) => ({
      kind: "pump-command",
      pumpOn: event.pumpOn,
      mode: event.mode,
      source: event.source,
      status: event.status,
      createdAt: event.createdAt,
      acknowledgedAt: event.acknowledgedAt ?? null,
      message: event.message ?? null,
    }));
  },
});

export const getRelevantExperiences = internalQuery({
  args: { deviceId: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    await requireFleetAccess(ctx);
    const limit = Math.max(1, Math.min(8, Math.floor(args.limit)));
    const experiences = await ctx.db
      .query("agentExperiences")
      .withIndex("by_deviceId_createdAt", (q) =>
        q.eq("deviceId", args.deviceId),
      )
      .order("desc")
      .take(limit);
    return experiences.map((experience) => ({
      sensorState: experience.sensorState,
      condition: experience.condition,
      strategy: experience.strategy,
      toolsUsed: experience.toolsUsed,
      actionTaken: experience.actionTaken ?? null,
      result: experience.result,
      succeeded: experience.succeeded,
      outcomeMetrics: experience.outcomeMetrics ?? null,
      operatorFeedback: experience.operatorFeedback ?? null,
      createdAt: experience.createdAt,
    }));
  },
});

// Compatibility-only guard: the assistant has no actuator/proposal capability.
export const preflightPumpControl = internalQuery({
  args: { deviceId: v.string(), pumpOn: v.boolean() },
  handler: async () => ({
    allowed: false,
    reason:
      "The assistant is explanation-only. Use the dedicated operator control panel.",
  }),
});
