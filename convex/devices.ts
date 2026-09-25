import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel.d.ts";
import type { MutationCtx } from "./_generated/server";
import { createSystemNotification } from "./notifications";

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
  handler: async (ctx): Promise<Doc<"devices">[]> => {
    return await ctx.db.query("devices").collect();
  },
});

// Register a new Arduino device (admin only)
export const registerDevice = mutation({
  args: {
    deviceId: v.string(),
    name: v.string(),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Check for duplicate
    const existing = await ctx.db.query("devices").withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId)).unique();
    if (existing) throw new ConvexError({ message: "Device ID already registered", code: "CONFLICT" });

    // Generate a simple API key
    const apiKey = `ldwms_${args.deviceId}_${Date.now()}`;
    await ctx.db.insert("devices", {
      deviceId: args.deviceId,
      name: args.name,
      location: args.location,
      apiKey,
      status: "offline",
    });
    return { apiKey };
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
export const internalSaveReading = mutation({
  args: {
    deviceId: v.string(),
    ph: v.number(),
    tds: v.number(),
    turbidity: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const now = new Date().toISOString();

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

    // pH thresholds: safe 6.5–8.5, critical <5.0 or >10.0
    if (args.ph < 6.5 || args.ph > 8.5) {
      const level = args.ph < 5.0 || args.ph > 10.0 ? "critical" : "warning";
      alerts.push({
        level,
        title: `pH ${level === "critical" ? "CRITICAL" : "Warning"}: ${args.ph.toFixed(2)}`,
        message: `pH reading of ${args.ph.toFixed(2)} is outside the safe range (6.5–8.5). Device: ${args.deviceId}`,
        parameter: "pH",
        value: args.ph.toFixed(2),
      });
    }

    // TDS thresholds: warning >500, critical >800
    if (args.tds > 500) {
      const level = args.tds > 800 ? "critical" : "warning";
      alerts.push({
        level,
        title: `TDS ${level === "critical" ? "CRITICAL" : "Warning"}: ${args.tds.toFixed(0)} ppm`,
        message: `TDS reading of ${args.tds.toFixed(0)} ppm exceeds 500 ppm threshold. Device: ${args.deviceId}`,
        parameter: "TDS",
        value: `${args.tds.toFixed(0)} ppm`,
      });
    }

    // Turbidity thresholds: warning >20, critical >50
    if (args.turbidity > 20) {
      const level = args.turbidity > 50 ? "critical" : "warning";
      alerts.push({
        level,
        title: `Turbidity ${level === "critical" ? "CRITICAL" : "Warning"}: ${args.turbidity.toFixed(1)} NTU`,
        message: `Turbidity reading of ${args.turbidity.toFixed(1)} NTU exceeds 20 NTU threshold. Device: ${args.deviceId}`,
        parameter: "Turbidity",
        value: `${args.turbidity.toFixed(1)} NTU`,
      });
    }

    // Broadcast alerts to all admin/operator users
    if (alerts.length > 0) {
      const users = await ctx.db.query("users").collect();
      const targets = users.filter((u) => u.role === "admin" || u.role === "operator");
      for (const alert of alerts) {
        for (const target of targets) {
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
export const validateApiKey = query({
  args: { apiKey: v.string() },
  handler: async (ctx, args): Promise<Doc<"devices"> | null> => {
    return await ctx.db.query("devices").withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey)).unique();
  },
});
