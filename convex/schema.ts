import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("operator"), v.literal("viewer")),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_role", ["role"]),

  // Arduino device registry
  devices: defineTable({
    deviceId: v.string(),       // unique device identifier
    name: v.string(),
    location: v.optional(v.string()),
    apiKey: v.string(),         // secret key for device auth
    lastSeen: v.optional(v.string()), // ISO timestamp
    status: v.union(v.literal("online"), v.literal("offline"), v.literal("error")),
  })
    .index("by_deviceId", ["deviceId"])
    .index("by_apiKey", ["apiKey"]),

  // Sensor readings from Arduino (pH, TDS, Turbidity only)
  sensorReadings: defineTable({
    deviceId: v.string(),
    timestamp: v.string(),      // ISO timestamp
    ph: v.number(),
    tds: v.number(),
    turbidity: v.number(),
  })
    .index("by_deviceId", ["deviceId"])
    .index("by_deviceId_timestamp", ["deviceId", "timestamp"]),

  // Persistent alert notifications
  notifications: defineTable({
    userId: v.id("users"),
    level: v.union(v.literal("critical"), v.literal("warning"), v.literal("info")),
    category: v.union(
      v.literal("threshold"),
      v.literal("device"),
      v.literal("system"),
      v.literal("maintenance")
    ),
    title: v.string(),
    message: v.string(),
    parameter: v.optional(v.string()),
    value: v.optional(v.string()),
    read: v.boolean(),
    dismissed: v.boolean(),
    createdAt: v.string(), // ISO timestamp
  })
    .index("by_userId_read", ["userId", "read"])
    .index("by_userId_dismissed", ["userId", "dismissed"])
    .index("by_userId_category", ["userId", "category"]),

  // Per-user notification preferences
  notificationPreferences: defineTable({
    userId: v.id("users"),
    enableCritical: v.boolean(),
    enableWarning: v.boolean(),
    enableInfo: v.boolean(),
    enableThreshold: v.boolean(),
    enableDevice: v.boolean(),
    enableSystem: v.boolean(),
    enableMaintenance: v.boolean(),
    soundEnabled: v.boolean(),
    browserNotifications: v.boolean(),
  })
    .index("by_userId", ["userId"]),

  // S.A.M.I chat messages
  chatMessages: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  })
    .index("by_userId", ["userId"]),
});
