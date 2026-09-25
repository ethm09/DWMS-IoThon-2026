import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ── Queries ────────────────────────────────────────────────────────────────

export const list = query({
  args: {
    limit: v.optional(v.number()),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const limit = args.limit ?? 50;

    if (args.unreadOnly) {
      return await ctx.db
        .query("notifications")
        .withIndex("by_userId_read", (q) =>
          q.eq("userId", user._id).eq("read", false)
        )
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("notifications")
      .withIndex("by_userId_dismissed", (q) =>
        q.eq("userId", user._id).eq("dismissed", false)
      )
      .order("desc")
      .take(limit);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_read", (q) =>
        q.eq("userId", user._id).eq("read", false)
      )
      .take(100);
    return unread.length;
  },
});

export const getPreferences = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!prefs) {
      // Return defaults
      return {
        enableCritical: true,
        enableWarning: true,
        enableInfo: true,
        enableThreshold: true,
        enableDevice: true,
        enableSystem: true,
        enableMaintenance: true,
        soundEnabled: true,
        browserNotifications: false,
      };
    }
    return prefs;
  },
});

// ── Mutations ──────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    return await ctx.db.insert("notifications", {
      userId: user._id,
      level: args.level,
      category: args.category,
      title: args.title,
      message: args.message,
      parameter: args.parameter,
      value: args.value,
      read: false,
      dismissed: false,
      createdAt: new Date().toISOString(),
    });
  },
});

// Bulk create notifications for all users of a certain role or above
export const broadcast = mutation({
  args: {
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
    minRole: v.union(v.literal("admin"), v.literal("operator"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const admin = await getCurrentUserOrThrow(ctx);
    if (admin.role !== "admin" && admin.role !== "operator") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Insufficient permissions" });
    }

    const roleOrder = ["viewer", "operator", "admin"];
    const minIdx = roleOrder.indexOf(args.minRole);
    const users = await ctx.db.query("users").collect();
    const targets = users.filter(
      (u) => roleOrder.indexOf(u.role) >= minIdx
    );

    const now = new Date().toISOString();
    for (const target of targets) {
      await ctx.db.insert("notifications", {
        userId: target._id,
        level: args.level,
        category: args.category,
        title: args.title,
        message: args.message,
        parameter: args.parameter,
        value: args.value,
        read: false,
        dismissed: false,
        createdAt: now,
      });
    }
    return targets.length;
  },
});

export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Notification not found" });
    }
    await ctx.db.patch(args.notificationId, { read: true });
  },
});

export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_read", (q) =>
        q.eq("userId", user._id).eq("read", false)
      )
      .take(200);

    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
    return unread.length;
  },
});

export const dismiss = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Notification not found" });
    }
    await ctx.db.patch(args.notificationId, { dismissed: true, read: true });
  },
});

export const dismissAll = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const active = await ctx.db
      .query("notifications")
      .withIndex("by_userId_dismissed", (q) =>
        q.eq("userId", user._id).eq("dismissed", false)
      )
      .take(200);

    for (const n of active) {
      await ctx.db.patch(n._id, { dismissed: true, read: true });
    }
    return active.length;
  },
});

export const updatePreferences = mutation({
  args: {
    enableCritical: v.boolean(),
    enableWarning: v.boolean(),
    enableInfo: v.boolean(),
    enableThreshold: v.boolean(),
    enableDevice: v.boolean(),
    enableSystem: v.boolean(),
    enableMaintenance: v.boolean(),
    soundEnabled: v.boolean(),
    browserNotifications: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("notificationPreferences", {
      userId: user._id,
      ...args,
    });
  },
});

// ── Internal helper for creating notifications from system events ──────────

export async function createSystemNotification(
  ctx: MutationCtx,
  userId: Id<"users">,
  data: {
    level: "critical" | "warning" | "info";
    category: "threshold" | "device" | "system" | "maintenance";
    title: string;
    message: string;
    parameter?: string;
    value?: string;
  }
) {
  await ctx.db.insert("notifications", {
    userId,
    level: data.level,
    category: data.category,
    title: data.title,
    message: data.message,
    parameter: data.parameter,
    value: data.value,
    read: false,
    dismissed: false,
    createdAt: new Date().toISOString(),
  });
}
