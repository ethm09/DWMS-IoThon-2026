import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel.d.ts";
import type { MutationCtx } from "./_generated/server";
import { createSystemNotification } from "./notifications";
import { classifyPh, classifyTds, classifyTurbidity, THRESHOLDS } from "./safety-policy";

// Helper to require admin
async function requireAdmin(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
  const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  if (!user || user.role !== "admin") throw new ConvexError({ message: "Admin access required", code: "FORBIDDEN" });
  return user;
}

// List all registered devices (public read — guests can view)
export const listDevices = query({
  args: {},
  handler: async (ctx): Promise<Array<Omit<Doc<"devices">, "apiKey">>> => {
    const devices = await ctx.db.query("devices").collect();
    return devices.map((device) => {
      const { apiKey, ...publicDevice } = device;
      void apiKey;
      return publicDevice;
    });
  },
});

// Register a new Arduino device (admin only)
export const registerDevice = mutation({
  args: {
    deviceId: v.string(),
    name: v.string(),
    apiKey: v.string(),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Check for duplicate
    const existing = await ctx.db.query("devices").withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId)).unique();
    if (existing) throw new ConvexError({ message: "Device ID already registered", code: "CONFLICT" });

    const existingKey = await ctx.db
      .query("devices")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (existingKey) throw new ConvexError({ message: "API key collision — try again", code: "CONFLICT" });
    await ctx.db.insert("devices", {
      deviceId: args.deviceId,
      name: args.name,
      location: args.location,
      apiKey: args.apiKey,
      status: "offline",
    });
    return { apiKey: args.apiKey };
  },
});

// Delete a device (admin only)
export const deleteDevice = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const device = await ctx.db.query("devices").withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId)).unique();
    if (!device) throw new ConvexError({ message: "Device not found", code: "NOT_FOUND" });
    await ctx.db.delete(device._id);
  },
});

// Get latest sensor reading for a device (public)
export const getLatestReading = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args): Promise<Doc<"sensorReadings"> | null> => {
    return await ctx.db
      .query("sensorReadings")
      .withIndex("by_deviceId_timestamp", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .first();
  },
});

// Get recent readings for a device (public)
export const getRecentReadings = query({
  args: { deviceId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Doc<"sensorReadings">[]> => {
    return await ctx.db
      .query("sensorReadings")
      .withIndex("by_deviceId_timestamp", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// Internal: save a sensor reading (called from HTTP action)
export const internalSaveReading = internalMutation({
  args: {
    deviceId: v.string(),
    ph: v.number(),
    tds: v.number(),
    turbidity: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const now = new Date().toISOString();
    const previousReading = await ctx.db
      .query("sensorReadings")
      .withIndex("by_deviceId_timestamp", (q) => q.eq("deviceId", args.deviceId))
      .order("desc")
      .first();

    // Update device lastSeen + status to online
    const device = await ctx.db.query("devices").withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId)).unique();
    if (device) {
      await ctx.db.patch(device._id, { lastSeen: now, status: "online" });
    }

    // Insert reading
    await ctx.db.insert("sensorReadings", {
      deviceId: args.deviceId,
      timestamp: now,
      ph: args.ph,
      tds: args.tds,
      turbidity: args.turbidity,
    });

    // Schedule offline check in 10 seconds
    await ctx.scheduler.runAfter(10_000, internal.devices.checkDeviceStale, {
      deviceId: args.deviceId,
      expectedLastSeen: now,
    });

    // Threshold alert logic — broadcast to all admin/operator users
    const alerts: Array<{ level: "critical" | "warning"; title: string; message: string; parameter: string; value: string }> = [];
    const severity = { safe: 0, warning: 1, critical: 2 } as const;
    const shouldNotify = (
      previous: "safe" | "warning" | "critical" | undefined,
      current: "safe" | "warning" | "critical",
    ): current is "warning" | "critical" =>
      current !== "safe" && (previous === undefined || severity[current] > severity[previous]);

    const phLevel = classifyPh(args.ph);
    const previousPhLevel = previousReading ? classifyPh(previousReading.ph) : undefined;
    if (shouldNotify(previousPhLevel, phLevel)) {
      const level = phLevel;
      alerts.push({
        level,
        title: `pH ${level === "critical" ? "CRITICAL" : "Warning"}: ${args.ph.toFixed(2)}`,
        message: `pH reading of ${args.ph.toFixed(2)} is outside the safe range (${THRESHOLDS.ph.safe.min}–${THRESHOLDS.ph.safe.max}). Device: ${args.deviceId}`,
        parameter: "pH",
        value: args.ph.toFixed(2),
      });
    }

    const tdsLevel = classifyTds(args.tds);
    const previousTdsLevel = previousReading ? classifyTds(previousReading.tds) : undefined;
    if (shouldNotify(previousTdsLevel, tdsLevel)) {
      const level = tdsLevel;
      alerts.push({
        level,
        title: `TDS ${level === "critical" ? "CRITICAL" : "Warning"}: ${args.tds.toFixed(0)} ppm`,
        message: `TDS reading of ${args.tds.toFixed(0)} ppm is at or above the recommended limit of ${THRESHOLDS.tds.safe.max} ppm. Device: ${args.deviceId}`,
        parameter: "TDS",
        value: `${args.tds.toFixed(0)} ppm`,
      });
    }

    const turbidityLevel = classifyTurbidity(args.turbidity);
    const previousTurbidityLevel = previousReading ? classifyTurbidity(previousReading.turbidity) : undefined;
    if (shouldNotify(previousTurbidityLevel, turbidityLevel)) {
      const level = turbidityLevel;
      alerts.push({
        level,
        title: `Turbidity ${level === "critical" ? "CRITICAL" : "Warning"}: ${args.turbidity.toFixed(1)} NTU`,
        message: `Turbidity reading of ${args.turbidity.toFixed(1)} NTU is at or above the warning threshold of ${THRESHOLDS.turbidity.warning.min} NTU. Device: ${args.deviceId}`,
        parameter: "Turbidity",
        value: `${args.turbidity.toFixed(1)} NTU`,
      });
    }

    // Water-quality alerts are visible to every authenticated dashboard role.
    if (alerts.length > 0) {
      const users = await ctx.db.query("users").collect();
      for (const alert of alerts) {
        for (const target of users) {
          await createSystemNotification(ctx, target._id, {
            level: alert.level,
            category: "threshold",
            title: alert.title,
            message: alert.message,
            parameter: alert.parameter,
            value: alert.value,
          });
        }
      }
    }
  },
});

// Scheduled: check if a device has gone stale (no new data in 10s)
export const checkDeviceStale = internalMutation({
  args: {
    deviceId: v.string(),
    expectedLastSeen: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const device = await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    if (!device) return;

    // If lastSeen hasn't changed since we scheduled this check, mark offline
    if (device.lastSeen === args.expectedLastSeen && device.status === "online") {
      await ctx.db.patch(device._id, { status: "offline" });

      // Notify admin/operator users
      const users = await ctx.db.query("users").collect();
      const targets = users.filter((u) => u.role === "admin" || u.role === "operator");
      for (const target of targets) {
        await createSystemNotification(ctx, target._id, {
          level: "warning",
          category: "device",
          title: `Device offline: ${device.name}`,
          message: `Device ${device.deviceId} (${device.name}) has not sent data for 10+ seconds. Last seen: ${device.lastSeen ?? "unknown"}`,
        });
      }
    }
  },
});

// Internal: validate API key and return device
export const validateApiKey = internalQuery({
  args: { apiKey: v.string() },
  handler: async (ctx, args): Promise<Doc<"devices"> | null> => {
    return await ctx.db.query("devices").withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey)).unique();
  },
});
