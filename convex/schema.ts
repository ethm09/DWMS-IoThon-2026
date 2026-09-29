import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.union(
      v.literal("admin"),
      v.literal("operator"),
      v.literal("viewer"),
    ),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  // Arduino device registry
  devices: defineTable({
    deviceId: v.string(), // unique device identifier
    name: v.string(),
    location: v.optional(v.string()),
    apiKey: v.string(), // secret key for device auth
    lastSeen: v.optional(v.string()), // ISO timestamp
    status: v.union(
      v.literal("online"),
      v.literal("offline"),
      v.literal("error"),
    ),
    controlMode: v.optional(
      v.union(v.literal("auto"), v.literal("manual"), v.literal("emergency")),
    ),
    desiredPumpState: v.optional(v.boolean()),
    reportedPumpState: v.optional(v.boolean()),
    pumpReportedAt: v.optional(v.string()),
    lastCommandId: v.optional(v.string()),
    controlUpdatedAt: v.optional(v.string()),
    lastControlMessage: v.optional(v.string()),
  })
    .index("by_deviceId", ["deviceId"])
    .index("by_apiKey", ["apiKey"]),

  // Auditable, short-lived pump commands acknowledged by the serial bridge.
  deviceCommands: defineTable({
    deviceId: v.string(),
    commandId: v.string(),
    pumpOn: v.boolean(),
    mode: v.union(v.literal("auto"), v.literal("manual"), v.literal("emergency")),
    source: v.union(v.literal("operator"), v.literal("automatic"), v.literal("emergency")),
    requestedBy: v.optional(v.string()),
    createdAt: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("applied"),
      v.literal("failed"),
      v.literal("expired"),
      v.literal("superseded"),
    ),
    reportedPumpState: v.optional(v.boolean()),
    message: v.optional(v.string()),
    acknowledgedAt: v.optional(v.string()),
  })
    .index("by_commandId", ["commandId"])
    .index("by_deviceId_createdAt", ["deviceId", "createdAt"]),

  // Sensor readings from Arduino (pH, TDS, Turbidity only)
  sensorReadings: defineTable({
    deviceId: v.string(),
    timestamp: v.string(), // ISO timestamp
    ph: v.number(),
    tds: v.number(),
    turbidity: v.number(),
  })
    .index("by_deviceId", ["deviceId"])
    .index("by_deviceId_timestamp", ["deviceId", "timestamp"]),

  // Persistent alert notifications
  notifications: defineTable({
    userId: v.id("users"),
    level: v.union(
      v.literal("critical"),
      v.literal("warning"),
      v.literal("info"),
    ),
    category: v.union(
      v.literal("threshold"),
      v.literal("device"),
      v.literal("system"),
      v.literal("maintenance"),
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
    .index("by_userId_createdAt", ["userId", "createdAt"])
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
  }).index("by_userId", ["userId"]),

  // S.A.M.I chat messages
  chatMessages: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  }).index("by_userId", ["userId"]),

  // Ethm operational runs contain concise status and outcome data only. They
  // deliberately do not persist model reasoning or client-supplied sensor state.
  agentRuns: defineTable({
    userId: v.id("users"),
    objective: v.string(),
    selectedDeviceId: v.optional(v.string()),
    status: v.union(
      v.literal("running"),
      v.literal("awaiting_confirmation"),
      v.literal("completed"),
      v.literal("blocked"),
      v.literal("failed"),
    ),
    pendingAction: v.optional(
      v.object({
        kind: v.literal("setPump"),
        deviceId: v.string(),
        pumpOn: v.boolean(),
        reason: v.string(),
        proposedAt: v.string(),
      }),
    ),
    result: v.optional(v.string()),
    startedAt: v.string(),
    executionClaimedAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
  })
    .index("by_userId_startedAt", ["userId", "startedAt"]),

  agentRunEvents: defineTable({
    runId: v.id("agentRuns"),
    userId: v.id("users"),
    state: v.union(
      v.literal("thinking"),
      v.literal("reading_sensors"),
      v.literal("analyzing"),
      v.literal("checking_safety"),
      v.literal("executing_action"),
      v.literal("verifying"),
      v.literal("awaiting_confirmation"),
      v.literal("completed"),
      v.literal("blocked"),
      v.literal("failed"),
    ),
    label: v.string(),
    toolName: v.optional(v.string()),
    summary: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_runId_createdAt", ["runId", "createdAt"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),

  // DWMS operating experience, not personal user memory. Safety thresholds,
  // authorization, and interlocks are never represented as learned settings.
  agentExperiences: defineTable({
    deviceId: v.string(),
    sensorState: v.object({
      ph: v.optional(v.number()),
      tds: v.optional(v.number()),
      turbidity: v.optional(v.number()),
      timestamp: v.optional(v.string()),
    }),
    condition: v.string(),
    strategy: v.string(),
    toolsUsed: v.array(v.string()),
    actionTaken: v.optional(v.string()),
    result: v.string(),
    succeeded: v.boolean(),
    outcomeMetrics: v.optional(
      v.object({
        phDelta: v.optional(v.number()),
        tdsDelta: v.optional(v.number()),
        turbidityDelta: v.optional(v.number()),
        observedAt: v.optional(v.string()),
        note: v.optional(v.string()),
      }),
    ),
    confidence: v.number(),
    operatorFeedback: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_deviceId_createdAt", ["deviceId", "createdAt"]),
});
