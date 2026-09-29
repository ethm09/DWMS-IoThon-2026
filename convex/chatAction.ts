"use node";

import OpenAI, {
  type ChatCompletionMessageParam,
  type ChatCompletionTool,
} from "openai";
import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { MAX_FILTER_CAPACITY, THRESHOLDS } from "./safetyPolicy";

const MAX_TOOL_STEPS = 8;
const MAX_TOOLS_PER_RUN = 12;
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 1800;
const MAX_TOOL_OUTPUT_LENGTH = 12_000;
const VERIFICATION_ATTEMPTS = 12;
const VERIFICATION_INTERVAL_MS = 1_500;

const ETHM_SYSTEM_PROMPT = `You are ETHM — DWMS AI Operations Agent, part of the existing Defense Water Monitoring System.

Operate as a tool-using DWMS agent. Use the backend tools for current device state, readings, alerts, events, and experience memory. Do not use browser-local/demo state as evidence. Persistent readings come from the device ingestion endpoint; report HARDWARE and freshness exactly as returned by getDataMode. When no persisted reading exists, say the sensor state is unavailable. The stored hardware schema has pH, TDS, and turbidity only; it has no flow-rate sensor.

The authoritative configured limits are read from the shared backend policy:
- pH safe ${THRESHOLDS.ph.safe.min}–${THRESHOLDS.ph.safe.max}; critical below ${THRESHOLDS.ph.critical.below} or above ${THRESHOLDS.ph.critical.above}.
- TDS safe below ${THRESHOLDS.tds.safe.max} ppm; critical above ${THRESHOLDS.tds.critical.above} ppm.
- Turbidity safe below ${THRESHOLDS.turbidity.safe.max} NTU; critical above ${THRESHOLDS.turbidity.critical.above} NTU; backend Auto filtration threshold above ${THRESHOLDS.turbidity.filtration.above} NTU.
- Filter capacity ${MAX_FILTER_CAPACITY} L/min is defined in policy, but no flow sensor value is stored by current hardware ingestion.
Never change these limits or learn around them. Experience records are supporting evidence only and never override current measurements, authorization, or safety results.

Plan a task by selecting only the needed tools. For a system check, inspect readings, trends, active alerts, device status, and safety state as relevant. Cite concrete tool evidence in the final answer. Distinguish measured facts from possible explanations. Do not invent values, devices, modes, events, or outcomes. If a tool is unavailable, report the exact limitation.

The requestPumpControl tool only creates a pending proposal; it does not execute hardware. Use it only for a clear operator request or when the user asks Ethm to handle a detected issue. Every physical action requires the operator to confirm in the UI. The backend must then recheck user role, mode, device status, fresh readings, and its safety interlock. Never tell the user an action ran unless fresh backend state confirms the controller acknowledged it. If it is blocked, explain the returned reason. Never attempt to change emergency mode or bypass an interlock.

Scope boundary: DWMS is for water-quality monitoring and prototype system status only. Do not provide operational instructions for manufacturing, handling, processing, or disposing of explosives or energetic materials. Do not prescribe chemical dosing, dilution, backwash, or treatment methods for hazardous process waste, and never certify water as safe for discharge, reuse, or contact. For those requests, state that DWMS cannot determine a safe treatment, and direct the user to qualified site environmental/safety staff and approved procedures.

Do not expose hidden reasoning. Show concise operational activity and a short evidence-based report. Keep replies clear and focused on DWMS.`;

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object" as const,
  properties,
  required,
  additionalProperties: false,
});

const TOOL_DEFINITIONS: ChatCompletionTool[] = [
  { type: "function", function: { name: "listDevices", description: "List registered DWMS devices and their persisted status.", parameters: objectSchema({}) } },
  { type: "function", function: { name: "getLatestSensorReadings", description: "Read the latest persisted pH, TDS, and turbidity values for a device.", parameters: objectSchema({ deviceId: { type: "string" } }, ["deviceId"]) } },
  { type: "function", function: { name: "getRecentSensorReadings", description: "Read a bounded history of persisted readings for trend or comparison analysis.", parameters: objectSchema({ deviceId: { type: "string" }, limit: { type: "integer", minimum: 3, maximum: 50 } }, ["deviceId"]) } },
  { type: "function", function: { name: "getDeviceStatus", description: "Read device connectivity, pump command state, reported state, mode, and latest command acknowledgement.", parameters: objectSchema({ deviceId: { type: "string" } }, ["deviceId"]) } },
  { type: "function", function: { name: "getActiveAlerts", description: "Read the authenticated user's active DWMS notifications.", parameters: objectSchema({}) } },
  { type: "function", function: { name: "getRecentAlerts", description: "Read a bounded list of the authenticated user's recent notifications.", parameters: objectSchema({ limit: { type: "integer", minimum: 1, maximum: 50 } }) } },
  { type: "function", function: { name: "getSystemMode", description: "Read the persisted device mode from Convex, not browser-local state.", parameters: objectSchema({ deviceId: { type: "string" } }, ["deviceId"]) } },
  { type: "function", function: { name: "getDataMode", description: "Determine whether stored device data is hardware-originated and live or stale. Never labels browser demo state as hardware.", parameters: objectSchema({ deviceId: { type: "string" } }, ["deviceId"]) } },
  { type: "function", function: { name: "evaluateSafetyState", description: "Evaluate the latest stored sensor values with the shared DWMS safety policy and backend interlock conditions.", parameters: objectSchema({ deviceId: { type: "string" } }, ["deviceId"]) } },
  { type: "function", function: { name: "analyzeWaterQuality", description: "Classify the latest stored sensor values using the shared DWMS thresholds.", parameters: objectSchema({ deviceId: { type: "string" } }, ["deviceId"]) } },
  { type: "function", function: { name: "analyzeSensorTrends", description: "Summarize pH, TDS, and turbidity direction from persisted readings. Requires at least three samples.", parameters: objectSchema({ deviceId: { type: "string" }, limit: { type: "integer", minimum: 3, maximum: 50 } }, ["deviceId"]) } },
  { type: "function", function: { name: "getRecentEvents", description: "Read recent persisted device pump-command events and their acknowledgement state.", parameters: objectSchema({ deviceId: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 30 } }, ["deviceId"]) } },
  { type: "function", function: { name: "getRelevantExperiences", description: "Retrieve recent DWMS experiences for this device. Use only as supporting evidence; current safety policy always wins.", parameters: objectSchema({ deviceId: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 8 } }, ["deviceId"]) } },
  { type: "function", function: { name: "requestPumpControl", description: "Propose a pump on/off command for explicit operator confirmation. This tool never executes the command.", parameters: objectSchema({ deviceId: { type: "string" }, pumpOn: { type: "boolean" }, reason: { type: "string", maxLength: 300 } }, ["deviceId", "pumpOn", "reason"]) } },
];

const TOOL_NAMES = new Set(TOOL_DEFINITIONS.map((tool) =>
  tool.type === "function" ? tool.function.name : "",
));

type RunMessage = { role: "user" | "assistant"; content: string };
type ToolResult = Record<string, unknown>;

function stringArgument(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (typeof value !== "string" || !value.trim() || value.length > 128) {
    throw new Error(`Invalid ${key}.`);
  }
  return value.trim();
}

function numberArgument(args: Record<string, unknown>, key: string, fallback: number) {
  const value = args[key];
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid ${key}.`);
  return Math.max(1, Math.min(50, Math.floor(value)));
}

function parseToolArguments(raw: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Tool arguments must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function toolActivity(name: string) {
  if (["getLatestSensorReadings", "getRecentSensorReadings", "getDataMode"].includes(name)) {
    return { state: "reading_sensors" as const, label: "Reading sensor data" };
  }
  if (["evaluateSafetyState", "requestPumpControl"].includes(name)) {
    return { state: "checking_safety" as const, label: "Checking backend safety rules" };
  }
  if (["analyzeWaterQuality", "analyzeSensorTrends", "getRelevantExperiences"].includes(name)) {
    return { state: "analyzing" as const, label: "Analyzing DWMS records" };
  }
  return { state: "reading_sensors" as const, label: "Reading DWMS status" };
}

function summarizeToolResult(name: string, result: ToolResult) {
  if (result.available === false) {
    return String(result.reason ?? "Requested data is unavailable.").slice(0, 350);
  }
  if (name === "getLatestSensorReadings") {
    const reading = result.reading as Record<string, unknown> | null;
    if (!reading) return "No persisted sensor reading is available.";
    return `pH ${reading.ph}; TDS ${reading.tds} ppm; turbidity ${reading.turbidity} NTU. Timestamp ${reading.timestamp}.`;
  }
  if (name === "getRecentSensorReadings") return `${String(result.count ?? 0)} persisted readings retrieved.`;
  if (name === "getActiveAlerts" || name === "getRecentAlerts") {
    const count = Array.isArray(result) ? result.length : 0;
    return `${count} notification record${count === 1 ? "" : "s"} retrieved.`;
  }
  if (name === "analyzeWaterQuality") return String(result.summary ?? "Water-quality analysis completed.").slice(0, 350);
  if (name === "analyzeSensorTrends") return String(result.summary ?? "Trend analysis completed.").slice(0, 350);
  if (name === "evaluateSafetyState") return String(result.reason ?? "Safety evaluation completed.").slice(0, 350);
  if (name === "getDataMode") return `Data mode ${String(result.mode ?? "UNKNOWN")}; freshness ${String(result.freshness ?? "unknown")}.`;
  if (name === "getDeviceStatus") return `Device status ${String(result.status ?? "unknown")}; mode ${String(result.controlMode ?? "unknown")}; reported pump ${String(result.reportedPumpState ?? "unknown")}.`;
  if (name === "listDevices") return `${Array.isArray(result) ? result.length : 0} registered device records retrieved.`;
  if (name === "getRecentEvents") return `${Array.isArray(result) ? result.length : 0} persisted control events retrieved.`;
  if (name === "getRelevantExperiences") return `${Array.isArray(result) ? result.length : 0} relevant DWMS experiences retrieved.`;
  return "DWMS data retrieved.";
}

function errorForTool(error: unknown) {
  if (error instanceof ConvexError) {
    const message = typeof error.data === "string" ? error.data : error.message;
    return message.slice(0, 300);
  }
  return error instanceof Error ? error.message.slice(0, 300) : "Tool execution failed.";
}

async function executeReadTool(
  ctx: ActionCtx,
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  switch (toolName) {
    case "listDevices":
      return await ctx.runQuery(internal.agentTools.listDevices, {});
    case "getLatestSensorReadings":
      return await ctx.runQuery(internal.agentTools.getLatestSensorReadings, { deviceId: stringArgument(args, "deviceId") });
    case "getRecentSensorReadings":
      return await ctx.runQuery(internal.agentTools.getRecentSensorReadings, { deviceId: stringArgument(args, "deviceId"), limit: numberArgument(args, "limit", 20) });
    case "getDeviceStatus":
      return await ctx.runQuery(internal.agentTools.getDeviceStatus, { deviceId: stringArgument(args, "deviceId") });
    case "getActiveAlerts":
      return await ctx.runQuery(internal.agentTools.getActiveAlerts, { userId: userId as never });
    case "getRecentAlerts":
      return await ctx.runQuery(internal.agentTools.getRecentAlerts, { userId: userId as never, limit: numberArgument(args, "limit", 20) });
    case "getSystemMode":
      return await ctx.runQuery(internal.agentTools.getSystemMode, { deviceId: stringArgument(args, "deviceId") });
    case "getDataMode":
      return await ctx.runQuery(internal.agentTools.getDataMode, { deviceId: stringArgument(args, "deviceId") });
    case "evaluateSafetyState":
      return await ctx.runQuery(internal.agentTools.evaluateSafetyState, { deviceId: stringArgument(args, "deviceId") });
    case "analyzeWaterQuality":
      return await ctx.runQuery(internal.agentTools.analyzeWaterQuality, { deviceId: stringArgument(args, "deviceId") });
    case "analyzeSensorTrends":
      return await ctx.runQuery(internal.agentTools.analyzeSensorTrends, { deviceId: stringArgument(args, "deviceId"), limit: numberArgument(args, "limit", 20) });
    case "getRecentEvents":
      return await ctx.runQuery(internal.agentTools.getRecentEvents, { deviceId: stringArgument(args, "deviceId"), limit: numberArgument(args, "limit", 10) });
    case "getRelevantExperiences":
      return await ctx.runQuery(internal.agentTools.getRelevantExperiences, { deviceId: stringArgument(args, "deviceId"), limit: numberArgument(args, "limit", 4) });
    default:
      throw new Error("Tool is not in the Ethm registry.");
  }
}

function buildHistory(messages: RunMessage[], objective: string): ChatCompletionMessageParam[] {
  const history = messages
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((message) =>
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0,
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }));
  const last = history[history.length - 1];
  if (!last || last.role !== "user" || last.content !== objective) {
    history.push({ role: "user", content: objective.slice(0, MAX_MESSAGE_LENGTH) });
  }
  return history as ChatCompletionMessageParam[];
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export const run = action({
  args: {
    runId: v.id("agentRuns"),
    messages: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
    })),
  },
  handler: async (ctx, args): Promise<{ text: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in to use Ethm." });
    const { run: agentRun, user } = await ctx.runQuery(internal.agent.getRunForExecution, {
      runId: args.runId,
      tokenIdentifier: identity.tokenIdentifier,
    });
    const claimed = await ctx.runMutation(internal.agent.claimRun, {
      runId: agentRun._id,
      userId: user._id,
    });
    if (!claimed) return { text: "This Ethm run has already started or finished." };

    const appendEvent = async (
      state: "thinking" | "reading_sensors" | "analyzing" | "checking_safety" | "executing_action" | "verifying" | "awaiting_confirmation" | "completed" | "blocked" | "failed",
      label: string,
      summary?: string,
      toolName?: string,
    ) => ctx.runMutation(internal.agent.appendEvent, {
      runId: agentRun._id,
      userId: user._id,
      state,
      label,
      summary,
      toolName,
    });

    const toolsUsed = new Set<string>();
    let currentReading: { ph?: number; tds?: number; turbidity?: number; timestamp?: string } | undefined;
    let importantCondition: string | undefined;
    let proposedAction: { deviceId: string; pumpOn: boolean; reason: string } | undefined;
    let blockedReason: string | undefined;

    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("NOT_CONFIGURED");
      const openai = new OpenAI({ apiKey, timeout: 25_000, maxRetries: 1 });
      const conversation: ChatCompletionMessageParam[] = [
        { role: "system", content: ETHM_SYSTEM_PROMPT },
        ...buildHistory(args.messages, agentRun.objective),
      ];
      const toolCallCount = new Map<string, number>();

      for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
        const response = await openai.chat.completions.create({
          model: process.env.ETHM_MODEL?.trim() || "gpt-5-mini",
          messages: conversation,
          tools: TOOL_DEFINITIONS,
          tool_choice: "auto",
          parallel_tool_calls: false,
          max_completion_tokens: 1200,
        });
        const assistantMessage = response.choices[0]?.message;
        if (!assistantMessage) throw new Error("The model returned an empty response.");
        const toolCalls = assistantMessage.tool_calls?.filter((call) => call.type === "function") ?? [];
        if (toolCalls.length === 0) {
          const text = assistantMessage.content?.trim() || "I could not produce a DWMS report from the available data.";
          const finalText = text.slice(0, 6000);
          await ctx.runMutation(internal.agent.finishRun, {
            runId: agentRun._id,
            userId: user._id,
            status: "completed",
            result: finalText,
          });
          await appendEvent("completed", "Completed", "Reported findings from backend tools.");
          if (currentReading && importantCondition) {
            await ctx.runMutation(internal.agent.recordExperience, {
              deviceId: agentRun.selectedDeviceId ?? "unspecified",
              sensorState: currentReading,
              condition: importantCondition,
              strategy: toolsUsed.size ? `Observed using ${[...toolsUsed].join(", ")}.` : "Read-only DWMS assessment.",
              toolsUsed: [...toolsUsed],
              result: "Read-only analysis completed; no hardware action was taken.",
              succeeded: true,
              confidence: 0.6,
              outcomeMetrics: { note: "Analysis outcome only; no treatment effect was measured." },
            });
          }
          return { text: finalText };
        }
        conversation.push(assistantMessage);
        if (toolsUsed.size >= MAX_TOOLS_PER_RUN) throw new Error("TOOL_LIMIT");

        for (const call of toolCalls) {
          const name = call.function.name;
          if (!TOOL_NAMES.has(name)) {
            conversation.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "Tool is not permitted." }) });
            continue;
          }
          const count = (toolCallCount.get(name) ?? 0) + 1;
          toolCallCount.set(name, count);
          if (count > 2) {
            conversation.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "Retry limit reached for this tool." }) });
            continue;
          }
          toolsUsed.add(name);
          const activity = toolActivity(name);
          await appendEvent(activity.state, activity.label, undefined, name);

          let output: ToolResult;
          try {
            const toolArgs = parseToolArguments(call.function.arguments);
            if (name === "requestPumpControl") {
              if (user.role !== "admin" && user.role !== "operator") {
                blockedReason = "Operator or admin role is required for pump control. No command was created.";
                output = { allowed: false, reason: blockedReason };
              } else {
                const deviceId = stringArgument(toolArgs, "deviceId");
                if (typeof toolArgs.pumpOn !== "boolean") throw new Error("Invalid pumpOn.");
                const reason = typeof toolArgs.reason === "string" ? toolArgs.reason.trim().slice(0, 300) : "Operator requested pump control.";
                const preflight = await ctx.runQuery(internal.agentTools.preflightPumpControl, {
                  deviceId,
                  pumpOn: toolArgs.pumpOn,
                });
                if (!preflight.allowed) {
                  blockedReason = preflight.reason;
                  output = { allowed: false, reason: preflight.reason, executed: false };
                } else {
                  proposedAction = { deviceId, pumpOn: toolArgs.pumpOn, reason };
                  await ctx.runMutation(internal.agent.setPendingAction, {
                    runId: agentRun._id,
                    userId: user._id,
                    action: {
                      kind: "setPump",
                      ...proposedAction,
                      proposedAt: new Date().toISOString(),
                    },
                  });
                  output = {
                    allowed: true,
                    requiresConfirmation: true,
                    executed: false,
                    deviceId,
                    requestedPumpState: toolArgs.pumpOn,
                    reason,
                    message: "Proposal only. The operator must confirm; the backend will recheck authorization, mode, fresh data, and interlocks before creating a command.",
                  };
                }
              }
            } else {
              output = await executeReadTool(ctx, name, toolArgs, user._id);
            }

            if (name === "getLatestSensorReadings" && output.reading && typeof output.reading === "object") {
              const reading = output.reading as Record<string, unknown>;
              if (typeof reading.ph === "number" && typeof reading.tds === "number" && typeof reading.turbidity === "number") {
                currentReading = {
                  ph: reading.ph,
                  tds: reading.tds,
                  turbidity: reading.turbidity,
                  timestamp: typeof reading.timestamp === "string" ? reading.timestamp : undefined,
                };
              }
            }
            if (name === "analyzeWaterQuality" && typeof output.overall === "string" && output.overall !== "safe") {
              importantCondition = String(output.summary ?? `Water quality classified ${output.overall}.`).slice(0, 400);
            }
            if (name === "evaluateSafetyState" && typeof output.state === "string" && output.state !== "safe") {
              importantCondition = String(output.reason ?? `Safety state classified ${output.state}.`).slice(0, 400);
            }
            if (name === "analyzeSensorTrends" && output.available === true) {
              const trends = output.trends;
              if (Array.isArray(trends) && trends.some((trend) => typeof trend === "object" && trend !== null && (trend as { direction?: string }).direction !== "stable")) {
                importantCondition = String(output.summary ?? "Sensor trend deviated from stable.").slice(0, 400);
              }
            }
          } catch (error) {
            output = { available: false, error: errorForTool(error) };
          }

          const summary = proposedAction
            ? "Action proposed; waiting for explicit operator confirmation."
            : blockedReason ?? summarizeToolResult(name, output);
          await appendEvent(
            proposedAction ? "awaiting_confirmation" : blockedReason ? "blocked" : activity.state,
            proposedAction ? "Waiting for operator confirmation" : blockedReason ? "Action blocked" : activity.label,
            summary,
            name,
          );
          conversation.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(output).slice(0, MAX_TOOL_OUTPUT_LENGTH),
          });
          if (proposedAction || blockedReason) break;
        }

        if (proposedAction) {
          const actionText = `Ethm proposes turning the pump ${proposedAction.pumpOn ? "ON" : "OFF"} for device ${proposedAction.deviceId}. No command has been sent and the hardware action has not been executed. Confirm below to let the backend recheck permissions, device mode, fresh sensor data, and safety interlocks.`;
          await ctx.runMutation(internal.agent.saveRunResult, {
            runId: agentRun._id,
            userId: user._id,
            result: actionText,
          });
          return { text: actionText };
        }
        if (blockedReason) {
          const blockedText = `Ethm blocked the requested pump action. ${blockedReason} No hardware command was executed.`;
          await ctx.runMutation(internal.agent.finishRun, {
            runId: agentRun._id,
            userId: user._id,
            status: "blocked",
            result: blockedText,
          });
          await appendEvent("blocked", "Blocked", blockedReason);
          return { text: blockedText };
        }
      }

      const limitText = "Ethm reached its bounded tool-step limit before completing the assessment. No physical action was executed.";
      await ctx.runMutation(internal.agent.finishRun, {
        runId: agentRun._id,
        userId: user._id,
        status: "blocked",
        result: limitText,
      });
      await appendEvent("blocked", "Stopped safely", "Tool-step limit reached.");
      return { text: limitText };
    } catch (error) {
      const text =
        error instanceof Error && error.message === "NOT_CONFIGURED"
          ? "Ethm AI is not configured on this Convex deployment. No DWMS data was accessed and no action was executed."
          : error instanceof Error && error.message === "TOOL_LIMIT"
            ? "Ethm stopped safely after reaching the tool-call limit. No physical action was executed."
            : "Ethm could not complete this run because the model service or backend tool call failed. No action was executed.";
      await ctx.runMutation(internal.agent.finishRun, {
        runId: agentRun._id,
        userId: user._id,
        status: "failed",
        result: text,
      });
      await appendEvent("failed", "Run failed", text);
      return { text };
    }
  },
});

export const confirmPumpAction = action({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, args): Promise<{ text: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in to confirm this action." });
    const { run: agentRun, user } = await ctx.runQuery(internal.agent.getRunForExecution, {
      runId: args.runId,
      tokenIdentifier: identity.tokenIdentifier,
    });
    const appendEvent = async (
      state: "executing_action" | "verifying" | "completed" | "blocked" | "failed",
      label: string,
      summary?: string,
    ) => ctx.runMutation(internal.agent.appendEvent, {
      runId: agentRun._id,
      userId: user._id,
      state,
      label,
      summary,
    });

    if (user.role !== "admin" && user.role !== "operator") {
      const text = "Ethm blocked the action: current account does not have operator or admin permission. No hardware command was executed.";
      await ctx.runMutation(internal.agent.finishRun, { runId: agentRun._id, userId: user._id, status: "blocked", result: text });
      await appendEvent("blocked", "Blocked", "Operator or admin role required.");
      return { text };
    }

    let pending: { kind: "setPump"; deviceId: string; pumpOn: boolean; reason: string; proposedAt: string };
    try {
      pending = await ctx.runMutation(internal.agent.claimPendingAction, {
        runId: agentRun._id,
        userId: user._id,
      });
    } catch {
      return { text: "This proposal is no longer available. No hardware command was executed." };
    }

    await appendEvent("checking_safety" as never, "Rechecking authorization and safety", "Checking current role, mode, online state, fresh readings, and interlocks.");
    try {
      const preflight = await ctx.runQuery(internal.agentTools.preflightPumpControl, {
        deviceId: pending.deviceId,
        pumpOn: pending.pumpOn,
      });
      if (!preflight.allowed) {
        const text = `Ethm blocked the confirmed action. ${preflight.reason} No hardware command was executed.`;
        await ctx.runMutation(internal.agent.finishRun, { runId: agentRun._id, userId: user._id, status: "blocked", result: text });
        await appendEvent("blocked", "Blocked by current system state", preflight.reason);
        return { text };
      }

      await appendEvent("executing_action", "Sending pump command", "Calling the existing operator-authorized DWMS control mutation.");
      const command = await ctx.runMutation(api.devices.setDevicePump, {
        deviceId: pending.deviceId,
        pumpOn: pending.pumpOn,
      });
      await appendEvent("verifying", "Verifying controller acknowledgement", "Waiting for the device command status and reported pump state.");

      let verified = false;
      let failure: string | undefined;
      let lastState: Awaited<ReturnType<typeof ctx.runQuery<typeof api.devices.getControlState>>> | null = null;
      for (let attempt = 0; attempt < VERIFICATION_ATTEMPTS; attempt += 1) {
        await delay(VERIFICATION_INTERVAL_MS);
        const state = await ctx.runQuery(api.devices.getControlState, { deviceId: pending.deviceId });
        lastState = state;
        const currentCommand = state?.command;
        if (!currentCommand || currentCommand.commandId !== command.commandId) continue;
        if (currentCommand.status === "applied" && state?.reportedPumpState === pending.pumpOn) {
          verified = true;
          break;
        }
        if (["failed", "expired", "superseded"].includes(currentCommand.status)) {
          failure = currentCommand.message ?? `Controller command status is ${currentCommand.status}.`;
          break;
        }
      }

      const latestReading = await ctx.runQuery(internal.agentTools.getLatestSensorReadings, {
        deviceId: pending.deviceId,
      });
      const after = latestReading.reading as { ph: number; tds: number; turbidity: number; timestamp: string } | null;
      const before = preflight.reading;
      const outcomeMetrics = after && before && Date.parse(after.timestamp) > Date.parse(before.timestamp)
        ? {
            phDelta: after.ph - before.ph,
            tdsDelta: after.tds - before.tds,
            turbidityDelta: after.turbidity - before.turbidity,
            observedAt: after.timestamp,
            note: "Sensor deltas measured from persisted readings before command and after controller acknowledgement.",
          }
        : {
            note: "No newer persisted sensor sample was available during command verification; water-treatment effect is unknown.",
          };

      const text = verified
        ? `DWMS controller acknowledged the pump ${pending.pumpOn ? "ON" : "OFF"} command for ${pending.deviceId}. The reported pump state matches the request. ${outcomeMetrics.note}`
        : failure
          ? `The pump command was not verified. The controller reported: ${failure} The physical state is not confirmed.`
          : `The pump command was queued for ${pending.deviceId}, but no matching controller acknowledgement arrived during verification. Ethm cannot confirm that the hardware action executed; the physical pump state is unknown.`;
      await ctx.runMutation(internal.agent.recordExperience, {
        deviceId: pending.deviceId,
        sensorState: before ?? {},
        condition: pending.reason,
        strategy: "Operator-confirmed pump command through the existing backend control path.",
        toolsUsed: ["getDeviceStatus", "getLatestSensorReadings", "evaluateSafetyState", "requestPumpControl"],
        actionTaken: `Pump ${pending.pumpOn ? "ON" : "OFF"} command`,
        result: verified ? "Controller acknowledgement matched the requested pump state." : failure ?? "No controller acknowledgement was received before the verification deadline.",
        succeeded: verified,
        outcomeMetrics,
        confidence: verified ? 0.95 : 0.25,
      });
      const finalStatus = verified ? "completed" : failure ? "blocked" : "blocked";
      await ctx.runMutation(internal.agent.finishRun, {
        runId: agentRun._id,
        userId: user._id,
        status: finalStatus,
        result: text,
      });
      await appendEvent(
        verified ? "completed" : "blocked",
        verified ? "Completed" : "Verification incomplete",
        verified ? "Controller acknowledged the requested pump state." : failure ?? "No acknowledgement; physical state unknown.",
      );
      return { text };
    } catch (error) {
      const reason = errorForTool(error);
      const text = `Ethm could not execute or verify the pump action. ${reason} No success is claimed; check the device state in DWMS.`;
      await ctx.runMutation(internal.agent.finishRun, {
        runId: agentRun._id,
        userId: user._id,
        status: "blocked",
        result: text,
      });
      await appendEvent("blocked", "Action blocked", reason);
      return { text };
    }
  },
});
