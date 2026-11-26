"use node";

import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { ConvexError, v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { MAX_FILTER_CAPACITY, THRESHOLDS } from "./safetyPolicy";

const MAX_TOOL_STEPS = 8;
const MAX_TOOLS_PER_RUN = 12;
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 1800;
const MAX_TOOL_OUTPUT_LENGTH = 12_000;

/** Deployment-only check: no device tools, records, identities or actuator access. */
export const verifyConnection = internalAction({
  args: {},
  handler: async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.ETHM_MODEL?.trim() || "gpt-5-mini";
    if (!apiKey) return { available: false, model, reason: "not_configured" };
    try {
      const client = new OpenAI({ apiKey, timeout: 25_000, maxRetries: 0 });
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: "Reply with exactly DWMS_CONNECTIVITY_OK. This is a service connection check; no sensor readings are provided." }],
        max_completion_tokens: 1200,
      });
      const text = response.choices[0]?.message.content?.trim();
      return { available: text === "DWMS_CONNECTIVITY_OK", model, reason: text === "DWMS_CONNECTIVITY_OK" ? "completion_received" : "unexpected_response" };
    } catch (error) {
      const status = error instanceof OpenAI.APIError ? error.status : undefined;
      const quotaExhausted = error instanceof OpenAI.APIError && error.code === "insufficient_quota";
      return { available: false, model, reason: quotaExhausted ? "provider_quota_exhausted" : status === 401 ? "provider_authentication_failed" : status === 429 ? "provider_rate_limit" : "provider_request_failed" };
    }
  },
});

const ETHM_SYSTEM_PROMPT = `You are ETHM — DWMS AI Operations Agent, part of the existing Defense Water Monitoring System.

Operate as a tool-using DWMS agent. Use the backend tools for current device state, readings, alerts, events, and experience memory. Do not use browser-local/demo state as evidence. Persistent readings come from the device ingestion endpoint; report HARDWARE and freshness exactly as returned by getDataMode. When no persisted reading exists, say the sensor state is unavailable. The stored hardware schema has pH, TDS, and turbidity only; it has no flow-rate sensor.

The authoritative configured limits are read from the shared backend policy:
- pH safe ${THRESHOLDS.ph.safe.min}–${THRESHOLDS.ph.safe.max}; critical below ${THRESHOLDS.ph.critical.below} or above ${THRESHOLDS.ph.critical.above}.
- TDS safe below ${THRESHOLDS.tds.safe.max} ppm; critical above ${THRESHOLDS.tds.critical.above} ppm.
- Turbidity safe below ${THRESHOLDS.turbidity.safe.max} NTU; critical above ${THRESHOLDS.turbidity.critical.above} NTU; backend Auto filtration threshold above ${THRESHOLDS.turbidity.filtration.above} NTU.
- Filter capacity ${MAX_FILTER_CAPACITY} L/min is defined in policy, but no flow sensor value is stored by current hardware ingestion.
Never change these limits or learn around them. Experience records are supporting evidence only and never override current measurements, authorization, or safety results.

Plan a task by selecting only the needed tools. For a system check, inspect readings, trends, active alerts, device status, and safety state as relevant. Cite concrete tool evidence in the final answer. Distinguish measured facts from possible explanations. Do not invent values, devices, modes, events, or outcomes. If a tool is unavailable, report the exact limitation.

You are explanation-only. You can read and explain telemetry, alerts, thresholds and recorded device events. You have no actuator or pump proposal tools and cannot create, confirm or execute hardware commands. For an operating request, explain the current evidence and direct an authorized operator to the dedicated control panel. Deterministic backend rules remain authoritative. Never claim you changed equipment or bypassed an interlock.

Scope boundary: DWMS is for water-quality monitoring and prototype system status only. Do not provide operational instructions for manufacturing, handling, processing, or disposing of explosives or energetic materials. Do not prescribe chemical dosing, dilution, backwash, or treatment methods for hazardous process waste, and never certify water as safe for discharge, reuse, or contact. For those requests, state that DWMS cannot determine a safe treatment, and direct the user to qualified site environmental/safety staff and approved procedures.

Do not expose hidden reasoning. Show concise operational activity and a short evidence-based report. Keep replies clear and focused on DWMS.`;

const objectSchema = (
  properties: Record<string, unknown>,
  required: string[] = [],
) => ({
  type: "object" as const,
  properties,
  required,
  additionalProperties: false,
});

const TOOL_DEFINITIONS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "listDevices",
      description: "List registered DWMS devices and their persisted status.",
      parameters: objectSchema({}),
    },
  },
  {
    type: "function",
    function: {
      name: "getLatestSensorReadings",
      description:
        "Read the latest persisted pH, TDS, and turbidity values for a device.",
      parameters: objectSchema({ deviceId: { type: "string" } }, ["deviceId"]),
    },
  },
  {
    type: "function",
    function: {
      name: "getRecentSensorReadings",
      description:
        "Read a bounded history of persisted readings for trend or comparison analysis.",
      parameters: objectSchema(
        {
          deviceId: { type: "string" },
          limit: { type: "integer", minimum: 3, maximum: 50 },
        },
        ["deviceId"],
      ),
    },
  },
  {
    type: "function",
    function: {
      name: "getDeviceStatus",
      description:
        "Read device connectivity, pump command state, reported state, mode, and latest command acknowledgement.",
      parameters: objectSchema({ deviceId: { type: "string" } }, ["deviceId"]),
    },
  },
  {
    type: "function",
    function: {
      name: "getActiveAlerts",
      description: "Read the authenticated user's active DWMS notifications.",
      parameters: objectSchema({}),
    },
  },
  {
    type: "function",
    function: {
      name: "getRecentAlerts",
      description:
        "Read a bounded list of the authenticated user's recent notifications.",
      parameters: objectSchema({
        limit: { type: "integer", minimum: 1, maximum: 50 },
      }),
    },
  },
  {
    type: "function",
    function: {
      name: "getSystemMode",
      description:
        "Read the persisted device mode from Convex, not browser-local state.",
      parameters: objectSchema({ deviceId: { type: "string" } }, ["deviceId"]),
    },
  },
  {
    type: "function",
    function: {
      name: "getDataMode",
      description:
        "Determine whether stored device data is hardware-originated and live or stale. Never labels browser demo state as hardware.",
      parameters: objectSchema({ deviceId: { type: "string" } }, ["deviceId"]),
    },
  },
  {
    type: "function",
    function: {
      name: "evaluateSafetyState",
      description:
        "Evaluate the latest stored sensor values with the shared DWMS safety policy and backend interlock conditions.",
      parameters: objectSchema({ deviceId: { type: "string" } }, ["deviceId"]),
    },
  },
  {
    type: "function",
    function: {
      name: "analyzeWaterQuality",
      description:
        "Classify the latest stored sensor values using the shared DWMS thresholds.",
      parameters: objectSchema({ deviceId: { type: "string" } }, ["deviceId"]),
    },
  },
  {
    type: "function",
    function: {
      name: "analyzeSensorTrends",
      description:
        "Summarize pH, TDS, and turbidity direction from persisted readings. Requires at least three samples.",
      parameters: objectSchema(
        {
          deviceId: { type: "string" },
          limit: { type: "integer", minimum: 3, maximum: 50 },
        },
        ["deviceId"],
      ),
    },
  },
  {
    type: "function",
    function: {
      name: "getRecentEvents",
      description:
        "Read recent persisted device pump-command events and their acknowledgement state.",
      parameters: objectSchema(
        {
          deviceId: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 30 },
        },
        ["deviceId"],
      ),
    },
  },
  {
    type: "function",
    function: {
      name: "getRelevantExperiences",
      description:
        "Retrieve recent DWMS experiences for this device. Use only as supporting evidence; current safety policy always wins.",
      parameters: objectSchema(
        {
          deviceId: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 8 },
        },
        ["deviceId"],
      ),
    },
  },
];

const TOOL_NAMES = new Set(
  TOOL_DEFINITIONS.map((tool) =>
    tool.type === "function" ? tool.function.name : "",
  ),
);

type RunMessage = { role: "user" | "assistant"; content: string };
type ToolResult = Record<string, unknown>;

function stringArgument(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (typeof value !== "string" || !value.trim() || value.length > 128) {
    throw new Error(`Invalid ${key}.`);
  }
  return value.trim();
}

function numberArgument(
  args: Record<string, unknown>,
  key: string,
  fallback: number,
) {
  const value = args[key];
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`Invalid ${key}.`);
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
  if (
    [
      "getLatestSensorReadings",
      "getRecentSensorReadings",
      "getDataMode",
    ].includes(name)
  ) {
    return { state: "reading_sensors" as const, label: "Reading sensor data" };
  }
  if (["evaluateSafetyState"].includes(name)) {
    return {
      state: "checking_safety" as const,
      label: "Checking backend safety rules",
    };
  }
  if (
    [
      "analyzeWaterQuality",
      "analyzeSensorTrends",
      "getRelevantExperiences",
    ].includes(name)
  ) {
    return { state: "analyzing" as const, label: "Analyzing DWMS records" };
  }
  return { state: "reading_sensors" as const, label: "Reading DWMS status" };
}

function summarizeToolResult(name: string, result: ToolResult) {
  if (result.available === false) {
    return String(result.reason ?? "Requested data is unavailable.").slice(
      0,
      350,
    );
  }
  if (name === "getLatestSensorReadings") {
    const reading = result.reading as Record<string, unknown> | null;
    if (!reading) return "No persisted sensor reading is available.";
    return `pH ${reading.ph}; TDS ${reading.tds} ppm; turbidity ${reading.turbidity} NTU. Timestamp ${reading.timestamp}.`;
  }
  if (name === "getRecentSensorReadings")
    return `${String(result.count ?? 0)} persisted readings retrieved.`;
  if (name === "getActiveAlerts" || name === "getRecentAlerts") {
    const count = Array.isArray(result.alerts) ? result.alerts.length : 0;
    return `${count} notification record${count === 1 ? "" : "s"} retrieved.`;
  }
  if (name === "analyzeWaterQuality")
    return String(result.summary ?? "Water-quality analysis completed.").slice(
      0,
      350,
    );
  if (name === "analyzeSensorTrends")
    return String(result.summary ?? "Trend analysis completed.").slice(0, 350);
  if (name === "evaluateSafetyState")
    return String(result.reason ?? "Safety evaluation completed.").slice(
      0,
      350,
    );
  if (name === "getDataMode")
    return `Data mode ${String(result.mode ?? "UNKNOWN")}; freshness ${String(result.freshness ?? "unknown")}.`;
  if (name === "getDeviceStatus")
    return `Device status ${String(result.status ?? "unknown")}; mode ${String(result.controlMode ?? "unknown")}; reported pump ${String(result.reportedPumpState ?? "unknown")}.`;
  if (name === "listDevices")
    return `${Array.isArray(result.devices) ? result.devices.length : 0} registered device records retrieved.`;
  if (name === "getRecentEvents")
    return `${Array.isArray(result.events) ? result.events.length : 0} persisted control events retrieved.`;
  if (name === "getRelevantExperiences")
    return `${Array.isArray(result.experiences) ? result.experiences.length : 0} relevant DWMS experiences retrieved.`;
  return "DWMS data retrieved.";
}

function errorForTool(error: unknown) {
  if (error instanceof ConvexError) {
    const message = typeof error.data === "string" ? error.data : error.message;
    return message.slice(0, 300);
  }
  return error instanceof Error
    ? error.message.slice(0, 300)
    : "Tool execution failed.";
}

async function executeReadTool(
  ctx: ActionCtx,
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<ToolResult> {
  switch (toolName) {
    case "listDevices":
      return {
        devices: await ctx.runQuery(internal.agentTools.listDevices, {}),
      };
    case "getLatestSensorReadings":
      return await ctx.runQuery(internal.agentTools.getLatestSensorReadings, {
        deviceId: stringArgument(args, "deviceId"),
      });
    case "getRecentSensorReadings":
      return await ctx.runQuery(internal.agentTools.getRecentSensorReadings, {
        deviceId: stringArgument(args, "deviceId"),
        limit: numberArgument(args, "limit", 20),
      });
    case "getDeviceStatus":
      return await ctx.runQuery(internal.agentTools.getDeviceStatus, {
        deviceId: stringArgument(args, "deviceId"),
      });
    case "getActiveAlerts":
      return {
        alerts: await ctx.runQuery(internal.agentTools.getActiveAlerts, {
          userId: userId as never,
        }),
      };
    case "getRecentAlerts":
      return {
        alerts: await ctx.runQuery(internal.agentTools.getRecentAlerts, {
          userId: userId as never,
          limit: numberArgument(args, "limit", 20),
        }),
      };
    case "getSystemMode":
      return await ctx.runQuery(internal.agentTools.getSystemMode, {
        deviceId: stringArgument(args, "deviceId"),
      });
    case "getDataMode":
      return await ctx.runQuery(internal.agentTools.getDataMode, {
        deviceId: stringArgument(args, "deviceId"),
      });
    case "evaluateSafetyState":
      return await ctx.runQuery(internal.agentTools.evaluateSafetyState, {
        deviceId: stringArgument(args, "deviceId"),
      });
    case "analyzeWaterQuality":
      return await ctx.runQuery(internal.agentTools.analyzeWaterQuality, {
        deviceId: stringArgument(args, "deviceId"),
      });
    case "analyzeSensorTrends":
      return await ctx.runQuery(internal.agentTools.analyzeSensorTrends, {
        deviceId: stringArgument(args, "deviceId"),
        limit: numberArgument(args, "limit", 20),
      });
    case "getRecentEvents":
      return {
        events: await ctx.runQuery(internal.agentTools.getRecentEvents, {
          deviceId: stringArgument(args, "deviceId"),
          limit: numberArgument(args, "limit", 10),
        }),
      };
    case "getRelevantExperiences":
      return {
        experiences: await ctx.runQuery(
          internal.agentTools.getRelevantExperiences,
          {
            deviceId: stringArgument(args, "deviceId"),
            limit: numberArgument(args, "limit", 4),
          },
        ),
      };
    default:
      throw new Error("Tool is not in the Ethm registry.");
  }
}

function buildHistory(
  messages: RunMessage[],
  objective: string,
): ChatCompletionMessageParam[] {
  const history = messages
    .slice(-MAX_HISTORY_MESSAGES)
    .filter(
      (message) =>
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
    history.push({
      role: "user",
      content: objective.slice(0, MAX_MESSAGE_LENGTH),
    });
  }
  return history as ChatCompletionMessageParam[];
}

export const run = action({
  args: {
    runId: v.id("agentRuns"),
    messages: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
      }),
    ),
  },
  handler: async (ctx, args): Promise<{ text: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity)
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Sign in to use Ethm.",
      });
    const { run: agentRun, user } = await ctx.runQuery(
      internal.agent.getRunForExecution,
      {
        runId: args.runId,
        tokenIdentifier: identity.tokenIdentifier,
      },
    );
    const claimed = await ctx.runMutation(internal.agent.claimRun, {
      runId: agentRun._id,
      userId: user._id,
    });
    if (!claimed)
      return { text: "This Ethm run has already started or finished." };

    const appendEvent = async (
      state:
        | "thinking"
        | "reading_sensors"
        | "analyzing"
        | "checking_safety"
        | "executing_action"
        | "verifying"
        | "awaiting_confirmation"
        | "completed"
        | "blocked"
        | "failed",
      label: string,
      summary?: string,
      toolName?: string,
    ) =>
      ctx.runMutation(internal.agent.appendEvent, {
        runId: agentRun._id,
        userId: user._id,
        state,
        label,
        summary,
        toolName,
      });

    const toolsUsed = new Set<string>();
    let currentReading:
      | { ph?: number; tds?: number; turbidity?: number; timestamp?: string }
      | undefined;
    let importantCondition: string | undefined;

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
        if (!assistantMessage)
          throw new Error("The model returned an empty response.");
        const toolCalls =
          assistantMessage.tool_calls?.filter(
            (call) => call.type === "function",
          ) ?? [];
        if (toolCalls.length === 0) {
          const text =
            assistantMessage.content?.trim() ||
            "I could not produce a DWMS report from the available data.";
          const finalText = text.slice(0, 6000);
          await ctx.runMutation(internal.agent.finishRun, {
            runId: agentRun._id,
            userId: user._id,
            status: "completed",
            result: finalText,
          });
          await appendEvent(
            "completed",
            "Completed",
            "Reported findings from backend tools.",
          );
          if (currentReading && importantCondition) {
            await ctx.runMutation(internal.agent.recordExperience, {
              deviceId: agentRun.selectedDeviceId ?? "unspecified",
              sensorState: currentReading,
              condition: importantCondition,
              strategy: toolsUsed.size
                ? `Observed using ${[...toolsUsed].join(", ")}.`
                : "Read-only DWMS assessment.",
              toolsUsed: [...toolsUsed],
              result:
                "Read-only analysis completed; no hardware action was taken.",
              succeeded: true,
              confidence: 0.6,
              outcomeMetrics: {
                note: "Analysis outcome only; no treatment effect was measured.",
              },
            });
          }
          return { text: finalText };
        }
        conversation.push(assistantMessage);
        if (toolsUsed.size >= MAX_TOOLS_PER_RUN) throw new Error("TOOL_LIMIT");

        for (const call of toolCalls) {
          const name = call.function.name;
          if (!TOOL_NAMES.has(name)) {
            conversation.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({ error: "Tool is not permitted." }),
            });
            continue;
          }
          const count = (toolCallCount.get(name) ?? 0) + 1;
          toolCallCount.set(name, count);
          if (count > 2) {
            conversation.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify({
                error: "Retry limit reached for this tool.",
              }),
            });
            continue;
          }
          toolsUsed.add(name);
          const activity = toolActivity(name);
          await appendEvent(activity.state, activity.label, undefined, name);

          let output: ToolResult;
          try {
            const toolArgs = parseToolArguments(call.function.arguments);
            output = await executeReadTool(ctx, name, toolArgs, user._id);

            if (
              name === "getLatestSensorReadings" &&
              output.reading &&
              typeof output.reading === "object"
            ) {
              const reading = output.reading as Record<string, unknown>;
              if (
                typeof reading.ph === "number" &&
                typeof reading.tds === "number" &&
                typeof reading.turbidity === "number"
              ) {
                currentReading = {
                  ph: reading.ph,
                  tds: reading.tds,
                  turbidity: reading.turbidity,
                  timestamp:
                    typeof reading.timestamp === "string"
                      ? reading.timestamp
                      : undefined,
                };
              }
            }
            if (
              name === "analyzeWaterQuality" &&
              typeof output.overall === "string" &&
              output.overall !== "safe"
            ) {
              importantCondition = String(
                output.summary ?? `Water quality classified ${output.overall}.`,
              ).slice(0, 400);
            }
            if (
              name === "evaluateSafetyState" &&
              typeof output.state === "string" &&
              output.state !== "safe"
            ) {
              importantCondition = String(
                output.reason ?? `Safety state classified ${output.state}.`,
              ).slice(0, 400);
            }
            if (name === "analyzeSensorTrends" && output.available === true) {
              const trends = output.trends;
              if (
                Array.isArray(trends) &&
                trends.some(
                  (trend) =>
                    typeof trend === "object" &&
                    trend !== null &&
                    (trend as { direction?: string }).direction !== "stable",
                )
              ) {
                importantCondition = String(
                  output.summary ?? "Sensor trend deviated from stable.",
                ).slice(0, 400);
              }
            }
          } catch (error) {
            output = { available: false, error: errorForTool(error) };
          }

          await appendEvent(
            activity.state,
            activity.label,
            summarizeToolResult(name, output),
            name,
          );
          conversation.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(output).slice(0, MAX_TOOL_OUTPUT_LENGTH),
          });
        }
      }

      const limitText =
        "Ethm reached its bounded tool-step limit before completing the assessment. No physical action was executed.";
      await ctx.runMutation(internal.agent.finishRun, {
        runId: agentRun._id,
        userId: user._id,
        status: "blocked",
        result: limitText,
      });
      await appendEvent(
        "blocked",
        "Stopped safely",
        "Tool-step limit reached.",
      );
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

// Compatibility endpoint for older clients. AI never reaches the actuator path.
export const confirmPumpAction = action({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx): Promise<{ text: string }> => {
    if (!(await ctx.auth.getUserIdentity())) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Sign in to use the assistant.",
      });
    }
    throw new ConvexError({
      code: "READ_ONLY_ASSISTANT",
      message:
        "The assistant explains device data only. Authorized operators must use the dedicated control panel.",
    });
  },
});
