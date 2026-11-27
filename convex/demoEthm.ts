import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { DEMO_AI_LIMITS, demoAiConfiguration } from "./demoEthmPolicy";

const publicLimits = { turns: DEMO_AI_LIMITS.sessionTurns, maxQuestionCharacters: DEMO_AI_LIMITS.questionCharacters, requestIntervalMs: DEMO_AI_LIMITS.requestIntervalMs };
function fail(code: string, message: string): never { throw new ConvexError({ code, message }); }
function enabled() { const settings = demoAiConfiguration(); if (!settings.enabled) fail("DEMO_AI_UNAVAILABLE", "Guest Ethm is temporarily unavailable. Monitoring and scenario controls remain available."); return settings; }
const hashValid = (value: string) => /^[a-f0-9]{64}$/.test(value);
const source = v.object({ id: v.string(), title: v.string(), url: v.string() });

export const createSession = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const settings = enabled();
    if (!hashValid(tokenHash)) fail("DEMO_AI_BAD_REQUEST", "Invalid session request.");
    const now = Date.now();
    let budget = await ctx.db.query("demoEthmBudgets").withIndex("by_key", q => q.eq("key", "lifetime-v1")).unique();
    if (budget && budget.reservedTokens >= settings.tokenBudget) fail("DEMO_AI_BUDGET_EXHAUSTED", "The public Ethm allowance has been used. The interactive demonstration remains available.");
    if (!budget) {
      const id = await ctx.db.insert("demoEthmBudgets", { key: "lifetime-v1", reservedTokens: 0, requests: 0, sessions: 0, windowAt: now, windowRequests: 0, windowSessions: 0 });
      budget = await ctx.db.get(id);
    }
    if (!budget) fail("DEMO_AI_UNAVAILABLE", "Guest Ethm is temporarily unavailable.");
    const reset = now - budget.windowAt >= 60_000;
    const windowSessions = reset ? 0 : budget.windowSessions;
    if (budget.sessions >= DEMO_AI_LIMITS.globalSessions) fail("DEMO_AI_BUDGET_EXHAUSTED", "The public session allowance has been used. The interactive scenarios remain available.");
    if (windowSessions >= DEMO_AI_LIMITS.sessionsPerMinute) fail("DEMO_AI_RATE_LIMITED", "New guest sessions are temporarily limited. Please try again later.");
    const duplicate = await ctx.db.query("demoEthmSessions").withIndex("by_tokenHash", q => q.eq("tokenHash", tokenHash)).unique();
    if (duplicate) fail("DEMO_AI_BAD_REQUEST", "Invalid session request.");
    await ctx.db.patch(budget._id, { sessions: budget.sessions + 1, windowAt: reset ? now : budget.windowAt, windowSessions: windowSessions + 1, windowRequests: reset ? 0 : budget.windowRequests });
    const expiresAt = new Date(now + DEMO_AI_LIMITS.sessionTtlMs).toISOString();
    await ctx.db.insert("demoEthmSessions", { tokenHash, expiresAt, turns: 0, reservedTokens: 0, lastRequestAt: 0, revision: 0, messages: [] });
    return { expiresAt, remainingTurns: DEMO_AI_LIMITS.sessionTurns, limits: publicLimits, nextRequestAt: null, messages: [] };
  },
});

export const getSession = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    enabled();
    if (!hashValid(tokenHash)) fail("DEMO_AI_SESSION_INVALID", "Start a new guest conversation.");
    const session = await ctx.db.query("demoEthmSessions").withIndex("by_tokenHash", q => q.eq("tokenHash", tokenHash)).unique();
    if (!session || Date.parse(session.expiresAt) <= Date.now()) fail("DEMO_AI_SESSION_EXPIRED", "This guest conversation has expired. Start a new conversation.");
    return { expiresAt: session.expiresAt, remainingTurns: Math.max(0, DEMO_AI_LIMITS.sessionTurns - session.turns), limits: publicLimits, nextRequestAt: session.lastRequestAt ? new Date(session.lastRequestAt + DEMO_AI_LIMITS.requestIntervalMs).toISOString() : null, messages: session.messages, revision: session.revision };
  },
});

export const clearHistory = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    enabled();
    const session = await ctx.db.query("demoEthmSessions").withIndex("by_tokenHash", q => q.eq("tokenHash", tokenHash)).unique();
    if (!session || Date.parse(session.expiresAt) <= Date.now()) fail("DEMO_AI_SESSION_EXPIRED", "This guest conversation has expired. Start a new conversation.");
    // Clearing chat never resets turns, the global allowance or a pending request.
    await ctx.db.patch(session._id, { messages: [], revision: session.revision + 1 });
    return { expiresAt: session.expiresAt, remainingTurns: Math.max(0, DEMO_AI_LIMITS.sessionTurns - session.turns), limits: publicLimits, nextRequestAt: session.lastRequestAt ? new Date(session.lastRequestAt + DEMO_AI_LIMITS.requestIntervalMs).toISOString() : null, messages: [] };
  },
});

export const reserve = internalMutation({
  args: { tokenHash: v.string(), requestId: v.string(), expectedRevision: v.number(), tokens: v.number() },
  handler: async (ctx, args) => {
    const settings = enabled(); const now = Date.now();
    if (!/^[a-f0-9]{32}$/.test(args.requestId) || !Number.isSafeInteger(args.tokens) || args.tokens < DEMO_AI_LIMITS.completionTokens || args.tokens > DEMO_AI_LIMITS.promptBytes + 4096) fail("DEMO_AI_BAD_REQUEST", "Invalid inference reservation.");
    const session = await ctx.db.query("demoEthmSessions").withIndex("by_tokenHash", q => q.eq("tokenHash", args.tokenHash)).unique();
    if (!session || Date.parse(session.expiresAt) <= now) fail("DEMO_AI_SESSION_EXPIRED", "This guest conversation has expired. Start a new conversation.");
    if (session.pendingId && (session.pendingUntil ?? 0) > now) fail("DEMO_AI_BUSY", "Ethm is already reviewing this conversation. Please wait.");
    if (session.revision !== args.expectedRevision) fail("DEMO_AI_CONTEXT_CHANGED", "The conversation changed. Please try again.");
    if (session.turns >= DEMO_AI_LIMITS.sessionTurns || session.reservedTokens + args.tokens > DEMO_AI_LIMITS.sessionTokens) fail("DEMO_AI_SESSION_QUOTA", "This guest conversation has reached its allowance. The interactive demonstration remains available.");
    if (now - session.lastRequestAt < DEMO_AI_LIMITS.requestIntervalMs) fail("DEMO_AI_RATE_LIMITED", "Please wait a few seconds before asking another question.");
    const budget = await ctx.db.query("demoEthmBudgets").withIndex("by_key", q => q.eq("key", "lifetime-v1")).unique();
    if (!budget || budget.requests >= DEMO_AI_LIMITS.globalRequests || budget.reservedTokens + args.tokens > Math.min(settings.tokenBudget, DEMO_AI_LIMITS.globalTokens)) fail("DEMO_AI_BUDGET_EXHAUSTED", "The public Ethm allowance has been used. The interactive demonstration remains available.");
    const reset = now - budget.windowAt >= 60_000; const requests = reset ? 0 : budget.windowRequests;
    if (requests >= DEMO_AI_LIMITS.requestsPerMinute) fail("DEMO_AI_RATE_LIMITED", "Guest Ethm is busy. Please try again in a minute.");
    await ctx.db.patch(budget._id, { reservedTokens: budget.reservedTokens + args.tokens, requests: budget.requests + 1, windowAt: reset ? now : budget.windowAt, windowRequests: requests + 1, windowSessions: reset ? 0 : budget.windowSessions });
    await ctx.db.patch(session._id, { turns: session.turns + 1, reservedTokens: session.reservedTokens + args.tokens, lastRequestAt: now, pendingId: args.requestId, pendingUntil: now + DEMO_AI_LIMITS.requestLeaseMs });
    return { remainingTurns: DEMO_AI_LIMITS.sessionTurns - session.turns - 1, expiresAt: session.expiresAt, nextRequestAt: new Date(now + DEMO_AI_LIMITS.requestIntervalMs).toISOString() };
  },
});

export const finish = internalMutation({
  args: { tokenHash: v.string(), requestId: v.string(), expectedRevision: v.number(), question: v.string(), text: v.string(), generatedAt: v.string(), contextScenario: v.string(), contextAsOf: v.string(), sources: v.array(source), successful: v.boolean() },
  handler: async (ctx, args) => {
    const session = await ctx.db.query("demoEthmSessions").withIndex("by_tokenHash", q => q.eq("tokenHash", args.tokenHash)).unique();
    if (!session || session.pendingId !== args.requestId) return;
    // Every reservation is consumed, including failures and ambiguous timeouts.
    // No refund/reset path can create a parallel-call or late-result budget bypass.
    const messages = session.revision === args.expectedRevision && Date.parse(session.expiresAt) > Date.now()
      ? [...session.messages, { role: "user" as const, content: args.question.slice(0, DEMO_AI_LIMITS.questionCharacters), generatedAt: args.generatedAt, kind: "question" as const },
          { role: "assistant" as const, content: args.text.slice(0, 6000), generatedAt: args.generatedAt, kind: args.successful ? "ai_interpretation" as const : "service_status" as const, contextScenario: args.contextScenario, contextAsOf: args.contextAsOf, sources: args.sources.slice(0, 6) }].slice(-12)
      : session.messages;
    await ctx.db.patch(session._id, { messages, pendingId: undefined, pendingUntil: undefined, revision: session.revision + 1 });
  },
});
