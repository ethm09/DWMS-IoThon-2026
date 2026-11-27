import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";

// Recent private conversation, bounded for subscriptions and model context.
export const getMessages = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const messages = await ctx.db.query("chatMessages")
      .withIndex("by_userId", q => q.eq("userId", user._id))
      .order("desc").take(100);
    return messages.reverse();
  },
});

// Compatibility endpoint for saving a personal note; it cannot impersonate AI.
export const saveUserMessage = mutation({
  args: { content: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const content = args.content.trim();
    if (!content || content.length > 1000) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Enter a message between 1 and 1000 characters." });
    }
    return ctx.db.insert("chatMessages", { userId: user._id, role: "user", content });
  },
});

// Older clients cannot manufacture an AI reply. finishRun writes actual outcomes.
export const saveAssistantMessage = mutation({
  args: { content: v.string() },
  handler: async (ctx) => {
    await getCurrentUserOrThrow(ctx);
    throw new ConvexError({ code: "READ_ONLY_ASSISTANT_HISTORY", message: "Assistant replies are saved by the backend after a run." });
  },
});

export const clearHistory = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    const messages = await ctx.db.query("chatMessages")
      .withIndex("by_userId", q => q.eq("userId", user._id)).collect();
    for (const message of messages) await ctx.db.delete(message._id);
  },
});
