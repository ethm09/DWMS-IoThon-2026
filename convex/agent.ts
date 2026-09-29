import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";

const eventState = v.union(
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
);

const pendingAction = v.object({
  kind: v.literal("setPump"),
  deviceId: v.string(),
  pumpOn: v.boolean(),
  reason: v.string(),
  proposedAt: v.string(),
});

export const createRun = mutation({
  args: {
    objective: v.string(),
    selectedDeviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const objective = args.objective.trim();
    if (!objective || objective.length > 1000) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Enter an objective between 1 and 1000 characters.",
      });
    }
    if (args.selectedDeviceId && args.selectedDeviceId.length > 128) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Invalid device ID." });
    }

    const startedAt = new Date().toISOString();
    const runId = await ctx.db.insert("agentRuns", {
      userId: user._id,
      objective,
      selectedDeviceId: args.selectedDeviceId,
      status: "running",
      startedAt,
    });
    await ctx.db.insert("agentRunEvents", {
      runId,
      userId: user._id,
      state: "thinking",
      label: "Understanding the request",
      createdAt: startedAt,
    });
    return runId;
  },
});

export const getRun = query({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const run = await ctx.db.get(args.runId);
    if (!run || run.userId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Agent run not found." });
    }
    return {
      _id: run._id,
      objective: run.objective,
      selectedDeviceId: run.selectedDeviceId ?? null,
      status: run.status,
      pendingAction: run.pendingAction ?? null,
      result: run.result ?? null,
      startedAt: run.startedAt,
      completedAt: run.completedAt ?? null,
    };
  },
});

export const cancelPendingAction = mutation({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const run = await ctx.db.get(args.runId);
    if (!run || run.userId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Agent run not found." });
    }
    if (run.status !== "awaiting_confirmation" || !run.pendingAction) {
      throw new ConvexError({ code: "INVALID_ACTION", message: "No pending action is available." });
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.runId, {
      status: "blocked",
      pendingAction: undefined,
      result: "Operator dismissed the pump proposal. No hardware command was created.",
      completedAt: now,
    });
    await ctx.db.insert("agentRunEvents", {
      runId: args.runId,
      userId: user._id,
      state: "blocked",
      label: "Proposal dismissed",
      summary: "Operator dismissed the proposal before a device command was created.",
      createdAt: now,
    });
    return true;
  },
});

export const getRunEvents = query({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const run = await ctx.db.get(args.runId);
    if (!run || run.userId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Agent run not found." });
    }
    return await ctx.db
      .query("agentRunEvents")
      .withIndex("by_runId_createdAt", (q) => q.eq("runId", args.runId))
      .order("asc")
      .take(80);
  },
});

export const submitExperienceFeedback = mutation({
  args: {
    experienceId: v.id("agentExperiences"),
    feedback: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    if (user.role !== "admin" && user.role !== "operator") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Operator access required." });
    }
    const feedback = args.feedback.trim();
    if (!feedback || feedback.length > 1000) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Feedback must be between 1 and 1000 characters.",
      });
    }
    const experience = await ctx.db.get(args.experienceId);
    if (!experience) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Experience not found." });
    }
    await ctx.db.patch(args.experienceId, { operatorFeedback: feedback });
  },
});

export const getRunForExecution = internalQuery({
  args: {
    runId: v.id("agentRuns"),
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .unique();
    const run = await ctx.db.get(args.runId);
    if (!user || !run || run.userId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Agent run not found." });
    }
    return {
      run,
      user: { _id: user._id, role: user.role },
    };
  },
});

export const claimRun = internalMutation({
  args: { runId: v.id("agentRuns"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.userId !== args.userId || run.status !== "running") return false;
    if (run.executionClaimedAt) return false;
    await ctx.db.patch(args.runId, { executionClaimedAt: new Date().toISOString() });
    return true;
  },
});

export const appendEvent = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    userId: v.id("users"),
    state: eventState,
    label: v.string(),
    toolName: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.userId !== args.userId) return;
    const events = await ctx.db
      .query("agentRunEvents")
      .withIndex("by_runId_createdAt", (q) => q.eq("runId", args.runId))
      .order("asc")
      .take(81);
    if (events.length >= 80) await ctx.db.delete(events[0]._id);
    await ctx.db.insert("agentRunEvents", {
      runId: args.runId,
      userId: args.userId,
      state: args.state,
      label: args.label.slice(0, 100),
      toolName: args.toolName?.slice(0, 80),
      summary: args.summary?.slice(0, 500),
      createdAt: new Date().toISOString(),
    });
  },
});

export const setPendingAction = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    userId: v.id("users"),
    action: pendingAction,
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.userId !== args.userId || run.status !== "running") {
      throw new ConvexError({ code: "INVALID_RUN", message: "This run cannot accept an action." });
    }
    await ctx.db.patch(args.runId, {
      status: "awaiting_confirmation",
      pendingAction: args.action,
    });
  },
});

export const saveRunResult = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    userId: v.id("users"),
    result: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.userId !== args.userId) return;
    await ctx.db.patch(args.runId, { result: args.result.slice(0, 6000) });
  },
});

export const claimPendingAction = internalMutation({
  args: { runId: v.id("agentRuns"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (
      !run ||
      run.userId !== args.userId ||
      run.status !== "awaiting_confirmation" ||
      !run.pendingAction
    ) {
      throw new ConvexError({ code: "INVALID_ACTION", message: "No pending action is available." });
    }
    const action = run.pendingAction;
    await ctx.db.patch(args.runId, {
      status: "running",
      pendingAction: undefined,
    });
    return action;
  },
});

export const finishRun = internalMutation({
  args: {
    runId: v.id("agentRuns"),
    userId: v.id("users"),
    status: v.union(v.literal("completed"), v.literal("blocked"), v.literal("failed")),
    result: v.string(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.userId !== args.userId) return;
    await ctx.db.patch(args.runId, {
      status: args.status,
      result: args.result.slice(0, 6000),
      pendingAction: undefined,
      completedAt: new Date().toISOString(),
    });
  },
});

export const recordExperience = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentExperiences", {
      ...args,
      condition: args.condition.slice(0, 500),
      strategy: args.strategy.slice(0, 500),
      toolsUsed: args.toolsUsed.slice(0, 20).map((tool) => tool.slice(0, 80)),
      actionTaken: args.actionTaken?.slice(0, 300),
      result: args.result.slice(0, 1000),
      confidence: Math.min(1, Math.max(0, args.confidence)),
      createdAt: new Date().toISOString(),
    });
  },
});
