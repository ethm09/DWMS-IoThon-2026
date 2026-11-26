import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel.d.ts";
import type { MutationCtx } from "./_generated/server";
import { createSystemNotification } from "./notifications";
import {
  getCurrentUserOrThrow,
  hasFleetAccess,
  requireFleetAccess,
} from "./users";
import {
  classifyPh,
  classifyTds,
  classifyTurbidity,
  THRESHOLDS,
  automaticPumpTarget,
  isFreshTimestamp,
  isValidSensorValues,
  SENSOR_FRESHNESS_MS,
} from "./safetyPolicy";

import { telemetryFields, checkTelemetry } from "./telemetry";

const CONTROL_COMMAND_TTL_MS = 20_000;

async function requireOperator(ctx: MutationCtx) {
  const user = await getCurrentUserOrThrow(ctx);
  if (user.role !== "admin" && user.role !== "operator") {
    throw new ConvexError({
      message: "Operator access required to control hardware",
      code: "FORBIDDEN",
    });
  }
  return user;
}

async function findDevice(ctx: MutationCtx, deviceId: string) {
  const device = await ctx.db
    .query("devices")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
    .unique();
  if (!device) {
    throw new ConvexError({ message: "Device not found", code: "NOT_FOUND" });
  }
  return device;
}

async function getFreshReading(ctx: MutationCtx, deviceId: string) {
  const device = await findDevice(ctx, deviceId);
  const reading = await ctx.db
    .query("sensorReadings")
    .withIndex("by_deviceId_timestamp", (q) => q.eq("deviceId", deviceId))
    .order("desc")
    .first();
  if (
    device.status !== "online" ||
    !isFreshTimestamp(device.lastSeen) ||
    !reading ||
    !isFreshTimestamp(reading.timestamp) ||
    !isValidSensorValues(reading)
  ) {
    throw new ConvexError({
      message: "A fresh sensor reading is required before controlling the pump",
      code: "STALE_SENSOR_DATA",
    });
  }
  return reading;
}

function assertPumpStartAllowed(reading: { ph: number; turbidity: number }) {
  if (
    classifyPh(reading.ph) === "critical" ||
    classifyTurbidity(reading.turbidity) === "critical"
  ) {
    throw new ConvexError({
      message:
        "Pump start blocked by the safety interlock. Resolve critical pH or turbidity readings first.",
      code: "SAFETY_INTERLOCK",
    });
  }
}

async function createControlCommand(
  ctx: MutationCtx,
  device: Doc<"devices">,
  args: {
    pumpOn: boolean;
    mode: "auto" | "manual" | "emergency";
    source: "operator" | "automatic" | "emergency";
    requestedBy?: string;
    clearEmergency?: boolean;
  },
) {
  if (device.lastCommandId) {
    const previous = await ctx.db
      .query("deviceCommands")
      .withIndex("by_commandId", (q) =>
        q.eq("commandId", device.lastCommandId!),
      )
      .unique();
    if (previous?.status === "pending") {
      await ctx.db.patch(previous._id, {
        status: "superseded",
        message: "A newer control command replaced this one.",
      });
    }
  }

  const commandId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await ctx.db.insert("deviceCommands", {
    deviceId: device.deviceId,
    commandId,
    pumpOn: args.pumpOn,
    clearEmergency: args.clearEmergency ?? false,
    mode: args.mode,
    source: args.source,
    requestedBy: args.requestedBy,
    createdAt,
    status: "pending",
  });
  await ctx.db.patch(device._id, {
    controlMode: args.mode,
    desiredPumpState: args.pumpOn,
    lastCommandId: commandId,
    controlUpdatedAt: createdAt,
    lastControlMessage: undefined,
  });
  await ctx.scheduler.runAfter(
    CONTROL_COMMAND_TTL_MS,
    internal.devices.expireControlCommand,
    { commandId },
  );
  return { commandId, createdAt, pumpOn: args.pumpOn, mode: args.mode };
}

/** Reissue lost/failed commands and reconcile controller resets without flooding pending commands. */
async function reconcileControl(
  ctx: MutationCtx,
  device: Doc<"devices">,
  target: { mode: "auto" | "emergency"; pumpOn: boolean },
) {
  const previous = device.lastCommandId
    ? await ctx.db
        .query("deviceCommands")
        .withIndex("by_commandId", (q) =>
          q.eq("commandId", device.lastCommandId!),
        )
        .unique()
    : null;
  const modeChanged = (device.controlMode ?? "auto") !== target.mode;
  const desiredChanged = (device.desiredPumpState ?? false) !== target.pumpOn;
  const pending =
    previous?.status === "pending" &&
    Date.now() - Date.parse(previous.createdAt) <= CONTROL_COMMAND_TTL_MS &&
    previous.pumpOn === target.pumpOn &&
    previous.mode === target.mode;
  if (!modeChanged && !desiredChanged && pending) return;
  const confirmed =
    isFreshTimestamp(device.pumpReportedAt) &&
    device.reportedPumpState === target.pumpOn;
  if (!modeChanged && !desiredChanged && confirmed) return;
  await createControlCommand(ctx, device, {
    ...target,
    source: target.mode === "emergency" ? "emergency" : "automatic",
  });
}

async function autoPumpTarget(ctx: MutationCtx, deviceId: string) {
  const reading = await getFreshReading(ctx, deviceId);
  return { reading, ...automaticPumpTarget(reading) };
}

// Helper to require admin
async function requireAdmin(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity)
    throw new ConvexError({
      message: "Not authenticated",
      code: "UNAUTHENTICATED",
    });
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user || user.role !== "admin")
    throw new ConvexError({
      message: "Admin access required",
      code: "FORBIDDEN",
    });
  return user;
}

// Shared prototype fleet: only authenticated, registered users may read device data.
export const listDevices = query({
  args: {},
  handler: async (ctx): Promise<Array<Omit<Doc<"devices">, "apiKey">>> => {
    await requireFleetAccess(ctx);
    const devices = await ctx.db.query("devices").collect();
    return devices.map((device) => {
      const { apiKey, ...publicDevice } = device;
      void apiKey;
      return publicDevice;
    });
  },
});

// Authenticated dashboard state; API keys are never returned from this query.
export const getControlState = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    await requireFleetAccess(ctx);
    const device = await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    if (!device) return null;
    const command = await ctx.db
      .query("deviceCommands")
      .withIndex("by_deviceId_createdAt", (q) =>
        q.eq("deviceId", args.deviceId),
      )
      .order("desc")
      .first();
    return {
      mode: device.controlMode ?? "auto",
      desiredPumpState: device.desiredPumpState ?? false,
      reportedPumpState:
        device.reportedPumpState !== undefined &&
        device.pumpReportedAt !== undefined &&
        isFreshTimestamp(device.pumpReportedAt)
          ? device.reportedPumpState
          : null,
      reportedAt: device.pumpReportedAt ?? null,
      updatedAt: device.controlUpdatedAt ?? null,
      message: device.lastControlMessage ?? null,
      command: command
        ? {
            commandId: command.commandId,
            pumpOn: command.pumpOn,
            source: command.source,
            createdAt: command.createdAt,
            status: command.status,
            message: command.message ?? null,
          }
        : null,
    };
  },
});

// Manual control is limited to authenticated operators and requires fresh data.
export const setDeviceControlMode = mutation({
  args: {
    deviceId: v.string(),
    mode: v.union(
      v.literal("auto"),
      v.literal("manual"),
      v.literal("emergency"),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireOperator(ctx);
    const device = await findDevice(ctx, args.deviceId);
    const currentMode = device.controlMode ?? "auto";

    if (args.mode === "emergency") {
      return await createControlCommand(ctx, device, {
        pumpOn: false,
        mode: "emergency",
        source: "emergency",
        requestedBy: user.email ?? user._id,
      });
    }
    if (currentMode === "emergency") {
      throw new ConvexError({
        message:
          "Acknowledge the emergency after conditions are safe before changing mode.",
        code: "EMERGENCY_LOCKED",
      });
    }

    const reading = await getFreshReading(ctx, args.deviceId);
    const pumpOn = device.desiredPumpState ?? false;
    if (args.mode === "auto") {
      const target = await autoPumpTarget(ctx, args.deviceId);
      if (target.mode === "emergency") {
        return await createControlCommand(ctx, device, {
          pumpOn: false,
          mode: "emergency",
          source: "emergency",
          requestedBy: user.email ?? user._id,
        });
      }
      return await createControlCommand(ctx, device, {
        pumpOn: target.pumpOn,
        mode: "auto",
        source: "operator",
        requestedBy: user.email ?? user._id,
      });
    }

    if (pumpOn) assertPumpStartAllowed(reading);
    return await createControlCommand(ctx, device, {
      pumpOn,
      mode: "manual",
      source: "operator",
      requestedBy: user.email ?? user._id,
    });
  },
});

export const setDevicePump = mutation({
  args: { deviceId: v.string(), pumpOn: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireOperator(ctx);
    const device = await findDevice(ctx, args.deviceId);
    if ((device.controlMode ?? "auto") !== "manual") {
      throw new ConvexError({
        message: "Switch the device to Manual mode before operating the pump.",
        code: "MANUAL_MODE_REQUIRED",
      });
    }
    if (args.pumpOn) {
      const reading = await getFreshReading(ctx, args.deviceId);
      assertPumpStartAllowed(reading);
    }
    return await createControlCommand(ctx, device, {
      pumpOn: args.pumpOn,
      mode: "manual",
      source: "operator",
      requestedBy: user.email ?? user._id,
    });
  },
});

export const acknowledgeDeviceEmergency = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireOperator(ctx);
    const device = await findDevice(ctx, args.deviceId);
    if ((device.controlMode ?? "auto") !== "emergency") {
      throw new ConvexError({
        message: "The device is not in emergency shutdown.",
        code: "NOT_IN_EMERGENCY",
      });
    }
    const target = await autoPumpTarget(ctx, args.deviceId);
    if (target.mode === "emergency") {
      throw new ConvexError({
        message:
          "Emergency conditions are still present; the pump remains stopped.",
        code: "SAFETY_INTERLOCK",
      });
    }
    return await createControlCommand(ctx, device, {
      pumpOn: target.pumpOn,
      clearEmergency: true,
      mode: "auto",
      source: "operator",
      requestedBy: user.email ?? user._id,
    });
  },
});

// Internal serial-bridge API helpers.
export const getPendingControlCommand = internalQuery({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    if (!device?.lastCommandId) return null;
    const command = await ctx.db
      .query("deviceCommands")
      .withIndex("by_commandId", (q) =>
        q.eq("commandId", device.lastCommandId!),
      )
      .unique();
    if (
      !command ||
      command.status !== "pending" ||
      (command.pumpOn &&
        (device.controlMode === "emergency" ||
          device.status !== "online" ||
          !isFreshTimestamp(device.lastSeen))) ||
      Date.now() - Date.parse(command.createdAt) > CONTROL_COMMAND_TTL_MS
    ) {
      return null;
    }
    return {
      commandId: command.commandId,
      pumpOn: command.pumpOn,
      clearEmergency: command.clearEmergency ?? false,
      mode: command.mode,
    };
  },
});

export const acknowledgeControlCommand = internalMutation({
  args: {
    deviceId: v.string(),
    commandId: v.string(),
    ok: v.boolean(),
    pumpOn: v.boolean(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const command = await ctx.db
      .query("deviceCommands")
      .withIndex("by_commandId", (q) => q.eq("commandId", args.commandId))
      .unique();
    if (!command || command.deviceId !== args.deviceId)
      return { accepted: false };
    if (command.status !== "pending") {
      return { accepted: command.status === "applied" };
    }
    if (Date.now() - Date.parse(command.createdAt) > CONTROL_COMMAND_TTL_MS) {
      await ctx.db.patch(command._id, {
        status: "expired",
        message: "The acknowledgement arrived after the command expired.",
      });
      return { accepted: false };
    }

    const success = args.ok && args.pumpOn === command.pumpOn;
    const message = success
      ? undefined
      : (
          args.message ??
          "The controller rejected or did not apply the command."
        ).slice(0, 240);
    await ctx.db.patch(command._id, {
      status: success ? "applied" : "failed",
      reportedPumpState: args.pumpOn,
      message,
      acknowledgedAt: new Date().toISOString(),
    });
    const device = await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    if (device?.lastCommandId === command.commandId) {
      await ctx.db.patch(device._id, {
        reportedPumpState: args.pumpOn,
        pumpReportedAt: new Date().toISOString(),
        lastControlMessage: message,
      });
    }
    return { accepted: success };
  },
});

export const reportPumpStatus = internalMutation({
  args: {
    deviceId: v.string(),
    pumpOn: v.boolean(),
    emergencyLock: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    if (!device) return;
    if (args.emergencyLock) {
      const command = device.lastCommandId
        ? await ctx.db
            .query("deviceCommands")
            .withIndex("by_commandId", (q) =>
              q.eq("commandId", device.lastCommandId!),
            )
            .unique()
        : null;
      // STATUS may precede delivery of the operator's explicit reset. Preserve
      // that short-lived command until ACK/expiry, rather than superseding it.
      const resetPending =
        command?.status === "pending" &&
        command.clearEmergency === true &&
        Date.now() - Date.parse(command.createdAt) <= CONTROL_COMMAND_TTL_MS;
      if (!resetPending)
        await reconcileControl(ctx, device, {
          mode: "emergency",
          pumpOn: false,
        });
    }
    await ctx.db.patch(device._id, {
      reportedPumpState: args.pumpOn,
      pumpReportedAt: new Date().toISOString(),
    });
  },
});

export const expireControlCommand = internalMutation({
  args: { commandId: v.string() },
  handler: async (ctx, args) => {
    const command = await ctx.db
      .query("deviceCommands")
      .withIndex("by_commandId", (q) => q.eq("commandId", args.commandId))
      .unique();
    if (!command || command.status !== "pending") return;
    await ctx.db.patch(command._id, {
      status: "expired",
      message:
        "No controller acknowledgement arrived; the physical output is unknown.",
    });
    const device = await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", command.deviceId))
      .unique();
    if (device?.lastCommandId === command.commandId) {
      await ctx.db.patch(device._id, {
        reportedPumpState: undefined,
        lastControlMessage:
          "No controller acknowledgement arrived; the physical output is unknown.",
      });
    }
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
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    if (existing)
      throw new ConvexError({
        message: "Device ID already registered",
        code: "CONFLICT",
      });

    const existingKey = await ctx.db
      .query("devices")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (existingKey)
      throw new ConvexError({
        message: "API key collision — try again",
        code: "CONFLICT",
      });
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
    const device = await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    if (!device)
      throw new ConvexError({ message: "Device not found", code: "NOT_FOUND" });
    await ctx.db.delete(device._id);
  },
});

// Get latest sensor reading for an authenticated registered user.
export const getLatestReading = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args): Promise<Doc<"sensorReadings"> | null> => {
    await requireFleetAccess(ctx);
    return await ctx.db
      .query("sensorReadings")
      .withIndex("by_deviceId_timestamp", (q) =>
        q.eq("deviceId", args.deviceId),
      )
      .order("desc")
      .first();
  },
});

// Get bounded recent readings for an authenticated registered user.
export const getRecentReadings = query({
  args: { deviceId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Doc<"sensorReadings">[]> => {
    await requireFleetAccess(ctx);
    return await ctx.db
      .query("sensorReadings")
      .withIndex("by_deviceId_timestamp", (q) =>
        q.eq("deviceId", args.deviceId),
      )
      .order("desc")
      .take(
        Number.isFinite(args.limit)
          ? Math.max(1, Math.min(200, Math.floor(args.limit!)))
          : 50,
      );
  },
});

/** Persistent operational history, without actor emails or device credentials. */
export const getRecentCommands = query({
  args: { deviceId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireFleetAccess(ctx);
    const limit = Number.isFinite(args.limit) ? Math.max(1, Math.min(50, Math.floor(args.limit!))) : 30;
    const commands = await ctx.db.query("deviceCommands")
      .withIndex("by_deviceId_createdAt", q => q.eq("deviceId", args.deviceId))
      .order("desc").take(limit);
    return commands.map(command => ({
      commandId: command.commandId, pumpOn: command.pumpOn,
      reportedPumpState: command.reportedPumpState ?? null,
      mode: command.mode, source: command.source, status: command.status,
      createdAt: command.createdAt, acknowledgedAt: command.acknowledgedAt ?? null,
      expiresAt: new Date(Date.parse(command.createdAt) + CONTROL_COMMAND_TTL_MS).toISOString(),
      message: command.message ?? null,
    }));
  },
});

// Internal: save a sensor reading (called from HTTP action)
export const internalSaveReading = internalMutation({
  args: {
    ...telemetryFields,
    deviceId: v.string(),
    ph: v.number(),
    tds: v.number(),
    turbidity: v.number(),
  },
  handler: async (ctx, args) => {
    if (!isValidSensorValues(args)) {
      throw new ConvexError({
        code: "INVALID_SENSOR_DATA",
        message:
          "All three finite sensor values within measurement ranges are required.",
      });
    }
    const now = new Date().toISOString();
    const previousReading = await ctx.db
      .query("sensorReadings")
      .withIndex("by_deviceId_timestamp", (q) =>
        q.eq("deviceId", args.deviceId),
      )
      .order("desc")
      .first();

    // Update device lastSeen + status to online
    const device = await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    if (!device)
      throw new ConvexError({ code: "NOT_FOUND", message: "Device not found" });
    const frame = {
      sessionId: args.sessionId, seq: args.seq, gatewayObservedAt: args.gatewayObservedAt,
      sourceSequence: args.sourceSequence, sourceUptimeMs: args.sourceUptimeMs,
    };
    const fingerprint = JSON.stringify({ ...frame, ph: args.ph, tds: args.tds, turbidity: args.turbidity });
    const identity = checkTelemetry(frame, device, fingerprint, Date.parse(now));
    if (identity.duplicate) return { duplicate: true };
    const timestamp = args.gatewayObservedAt ?? now;
    await ctx.db.patch(device._id, {
      lastSeen: now, status: "online",
      ...(args.sessionId ? {
        telemetrySessionId: args.sessionId, telemetrySeq: args.seq,
        telemetryObservedAt: args.gatewayObservedAt, telemetryFingerprint: fingerprint,
        telemetrySourceSequence: args.sourceSequence, telemetrySourceUptimeMs: args.sourceUptimeMs,
      } : {}),
    });

    // Insert reading
    await ctx.db.insert("sensorReadings", {
      deviceId: args.deviceId,
      timestamp, receivedAt: now, timeBasis: identity.timeBasis,
      ...(args.sessionId ? { sessionId: args.sessionId, seq: args.seq } : {}),
      ...(args.sourceSequence !== undefined ? { sourceSequence: args.sourceSequence, sourceUptimeMs: args.sourceUptimeMs } : {}),
      ph: args.ph,
      tds: args.tds,
      turbidity: args.turbidity,
    });

    // Emergency stays latched until a fresh, explicit operator acknowledgement.
    const mode = device.controlMode ?? "auto";
    const target = automaticPumpTarget(args);
    if (mode === "emergency" || target.mode === "emergency") {
      await reconcileControl(ctx, device, { mode: "emergency", pumpOn: false });
    } else if (mode === "auto") {
      await reconcileControl(ctx, device, target);
    }

    // Schedule offline check in 10 seconds
    await ctx.scheduler.runAfter(
      Math.max(0, SENSOR_FRESHNESS_MS - (Date.parse(now) - Date.parse(timestamp))),
      internal.devices.checkDeviceStale,
      {
        deviceId: args.deviceId,
        expectedLastSeen: now,
      },
    );

    // Threshold alert logic — broadcast to all admin/operator users
    const alerts: Array<{
      level: "critical" | "warning";
      title: string;
      message: string;
      parameter: string;
      value: string;
    }> = [];
    const severity = { safe: 0, warning: 1, critical: 2 } as const;
    const shouldNotify = (
      previous: "safe" | "warning" | "critical" | undefined,
      current: "safe" | "warning" | "critical",
    ): current is "warning" | "critical" =>
      current !== "safe" &&
      (previous === undefined || severity[current] > severity[previous]);

    const phLevel = classifyPh(args.ph);
    const previousPhLevel = previousReading
      ? classifyPh(previousReading.ph)
      : undefined;
    if (shouldNotify(previousPhLevel, phLevel)) {
      const level = phLevel;
      alerts.push({
        level,
        title: `pH ${level === "critical" ? "CRITICAL" : "Warning"}: ${args.ph.toFixed(2)}`,
        message: `pH reading of ${args.ph.toFixed(2)} is outside the configured prototype range (${THRESHOLDS.ph.safe.min}–${THRESHOLDS.ph.safe.max}). Device: ${args.deviceId}`,
        parameter: "pH",
        value: args.ph.toFixed(2),
      });
    }

    const tdsLevel = classifyTds(args.tds);
    const previousTdsLevel = previousReading
      ? classifyTds(previousReading.tds)
      : undefined;
    if (shouldNotify(previousTdsLevel, tdsLevel)) {
      const level = tdsLevel;
      alerts.push({
        level,
        title: `TDS ${level === "critical" ? "CRITICAL" : "Warning"}: ${args.tds.toFixed(0)} ppm`,
        message: `TDS reading of ${args.tds.toFixed(0)} ppm is at or above the configured prototype limit of ${THRESHOLDS.tds.safe.max} ppm. Device: ${args.deviceId}`,
        parameter: "TDS",
        value: `${args.tds.toFixed(0)} ppm`,
      });
    }

    const turbidityLevel = classifyTurbidity(args.turbidity);
    const previousTurbidityLevel = previousReading
      ? classifyTurbidity(previousReading.turbidity)
      : undefined;
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
        for (const target of users.filter(hasFleetAccess)) {
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
    return { duplicate: false };
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
    if (
      device.lastSeen === args.expectedLastSeen &&
      device.status === "online"
    ) {
      await ctx.db.patch(device._id, {
        status: "offline",
        reportedPumpState: undefined,
      });
      // Backend records a stop request; the controller's local lease watchdog
      // remains responsible for stopping during a disconnected link.
      await reconcileControl(ctx, device, { mode: "emergency", pumpOn: false });

      // Notify admin/operator users
      const users = await ctx.db.query("users").collect();
      const targets = users.filter(
        (u) => u.role === "admin" || u.role === "operator",
      );
      for (const target of targets) {
        await createSystemNotification(ctx, target._id, {
          level: "warning",
          category: "device",
          title: `Device offline: ${device.name}`,
          message: `Device ${device.deviceId} (${device.name}) has stale measurement data. Latest accepted receipt: ${device.lastSeen ?? "unknown"}`,
        });
      }
    }
  },
});

// Internal: validate API key and return device
export const validateApiKey = internalQuery({
  args: { apiKey: v.string() },
  handler: async (ctx, args): Promise<Doc<"devices"> | null> => {
    return await ctx.db
      .query("devices")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();
  },
});
