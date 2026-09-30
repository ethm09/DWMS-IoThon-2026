import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  analyzeSensorTrends as analyzeTrendData,
  analyzeWaterQuality as analyzeQualityData,
  evaluateSafetyState as evaluateSafetyData,
  type AgentReading,
} from "./agentAnalysis";
import { classifyPh, classifyTurbidity } from "./safetyPolicy";

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

export const listDevices = internalQuery({
  args: {},
  handler: async (ctx) => {
    const devices = await ctx.db.query("devices").take(100);
    return devices.map((device) => ({
      deviceId: device.deviceId,
      name: device.name,
      location: device.location ?? null,
      status: device.status,
      lastSeen: device.lastSeen ?? null,
      controlMode: device.controlMode ?? "auto",
      desiredPumpState: device.desiredPumpState ?? false,
      reportedPumpState: device.reportedPumpState ?? null,
    }));
  },
});

export const getLatestSensorReadings = internalQuery({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const [device, reading] = await Promise.all([
      getDevice(ctx, args.deviceId),
      getLatestReading(ctx, args.deviceId),
    ]);
    if (!device) return { available: false, reason: "Device not found.", reading: null };
    return {
      available: reading !== null,
      source: "device-ingested-hardware-data",
      deviceId: device.deviceId,
      deviceStatus: device.status,
      reason: reading ? null : "No reading has been persisted for this device.",
      reading: reading
        ? {
            ph: reading.ph,
            tds: reading.tds,
            turbidity: reading.turbidity,
            timestamp: reading.timestamp,
          }
        : null,
    };
  },
});

export const getRecentSensorReadings = internalQuery({
  args: { deviceId: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit)));
    const readings = await ctx.db
      .query("sensorReadings")
      .withIndex("by_deviceId_timestamp", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .take(limit);
    return {
      deviceId: args.deviceId,
      source: "device-ingested-hardware-data",
      count: readings.length,
      readings: readings.map((reading) => ({
        ph: reading.ph,
        tds: reading.tds,
        turbidity: reading.turbidity,
        timestamp: reading.timestamp,
      })),
    };
  },
});

export const getDeviceStatus = internalQuery({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const device = await getDevice(ctx, args.deviceId);
    if (!device) return { available: false, reason: "Device not found." };
    const command = device.lastCommandId
      ? await ctx.db
          .query("deviceCommands")
          .withIndex("by_commandId", (q) => q.eq("commandId", device.lastCommandId!))
          .unique()
      : null;
    return {
      available: true,
      deviceId: device.deviceId,
      name: device.name,
      location: device.location ?? null,
      status: device.status,
      lastSeen: device.lastSeen ?? null,
      controlMode: device.controlMode ?? "auto",
      desiredPumpState: device.desiredPumpState ?? false,
      reportedPumpState: device.reportedPumpState ?? null,
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
    const device = await getDevice(ctx, args.deviceId);
    if (!device) return { available: false, mode: "unknown", reason: "Device not found." };
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
    const [device, reading] = await Promise.all([
      getDevice(ctx, args.deviceId),
      getLatestReading(ctx, args.deviceId),
    ]);
    if (!device) return { mode: "UNKNOWN", reason: "Device not found." };
    if (!reading) {
      return {
        mode: "UNKNOWN",
        deviceStatus: device.status,
        reason: "No persisted hardware reading is available; demo state is browser-local and is not used by Ethm.",
      };
    }
    const ageMs = Math.max(0, Date.now() - Date.parse(reading.timestamp));
    return {
      mode: "HARDWARE",
      freshness: ageMs <= 10_000 && device.status === "online" ? "LIVE" : "STALE",
      ageMs,
      deviceStatus: device.status,
      readingTimestamp: reading.timestamp,
      source: "Arduino/device ingestion endpoint",
      note:
        ageMs <= 10_000 && device.status === "online"
          ? "Recent device-ingested reading."
          : "Persisted device reading is historical; do not describe it as live.",
    };
  },
});

export const evaluateSafetyState = internalQuery({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const reading = await getLatestReading(ctx, args.deviceId);
    return evaluateSafetyData(reading ? toAgentReading(reading) : null);
  },
});

export const analyzeWaterQuality = internalQuery({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const reading = await getLatestReading(ctx, args.deviceId);
    return analyzeQualityData(reading ? toAgentReading(reading) : null);
  },
});

export const analyzeSensorTrends = internalQuery({
  args: { deviceId: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    const limit = Math.max(3, Math.min(50, Math.floor(args.limit)));
    const readings = await ctx.db
      .query("sensorReadings")
      .withIndex("by_deviceId_timestamp", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .take(limit);
    return analyzeTrendData(readings.map(toAgentReading));
  },
});

export const getRecentEvents = internalQuery({
  args: { deviceId: v.string(), limit: v.number() },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(30, Math.floor(args.limit)));
    const events = await ctx.db
      .query("deviceCommands")
      .withIndex("by_deviceId_createdAt", (q) => q.eq("deviceId", args.deviceId))
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
    const limit = Math.max(1, Math.min(8, Math.floor(args.limit)));
    const experiences = await ctx.db
      .query("agentExperiences")
      .withIndex("by_deviceId_createdAt", (q) => q.eq("deviceId", args.deviceId))
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
      confidence: experience.confidence,
      operatorFeedback: experience.operatorFeedback ?? null,
      createdAt: experience.createdAt,
    }));
  },
});

export const preflightPumpControl = internalQuery({
  args: { deviceId: v.string(), pumpOn: v.boolean() },
  handler: async (ctx, args) => {
    const device = await getDevice(ctx, args.deviceId);
    if (!device) return { allowed: false, reason: "Device not found." };
    const reading = await getLatestReading(ctx, args.deviceId);
    if (!reading) return { allowed: false, reason: "No sensor reading is available." };
    const readingAgeMs = Date.now() - Date.parse(reading.timestamp);
    if (
      device.status !== "online" ||
      !Number.isFinite(readingAgeMs) ||
      readingAgeMs < 0 ||
      readingAgeMs > 10_000
    ) {
      return {
        allowed: false,
        reason: "A current online device and sensor reading no older than 10 seconds are required.",
      };
    }
    const mode = device.controlMode ?? "auto";
    if (mode !== "manual") {
      return {
        allowed: false,
        reason: `Device is in ${mode.toUpperCase()} mode. Ethm cannot override the backend control mode.`,
      };
    }
    if (device.desiredPumpState === args.pumpOn) {
      return {
        allowed: false,
        reason: `The backend already requests the pump to be ${args.pumpOn ? "on" : "off"}.`,
      };
    }
    if (args.pumpOn && (classifyPh(reading.ph) === "critical" || classifyTurbidity(reading.turbidity) === "critical")) {
      return {
        allowed: false,
        reason: "The safety interlock blocks pump start while pH or turbidity is critical.",
      };
    }
    if (device.lastCommandId) {
      const latestCommand = await ctx.db
        .query("deviceCommands")
        .withIndex("by_commandId", (q) => q.eq("commandId", device.lastCommandId!))
        .unique();
      if (latestCommand?.status === "pending") {
        return { allowed: false, reason: "A previous pump command is still awaiting controller acknowledgement." };
      }
    }
    return {
      allowed: true,
      deviceId: device.deviceId,
      deviceStatus: device.status,
      mode,
      currentDesiredPumpState: device.desiredPumpState ?? false,
      reportedPumpState: device.reportedPumpState ?? null,
      reading: toAgentReading(reading),
      readingAgeMs,
    };
  },
});
