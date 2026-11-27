import { type Telemetry } from "./telemetry";
import { ConvexError } from "convex/values";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { isValidSensorValues } from "./safetyPolicy";
import { DEMO_AI_LIMITS, DemoAiError, demoOriginAllowed, validateDemoQuestion } from "./demoEthmPolicy";

const http = httpRouter();

// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key, X-Device-ID",
};

// OPTIONS preflight
http.route({
  path: "/arduino/data",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

/**
 * POST /arduino/data
 * Arduino Serial Bridge sends sensor readings to this endpoint.
 *
 * Headers:
 *   X-API-Key: <device api key>
 *   X-Device-ID: <device id>
 *
 * Body (JSON) — Arduino format:
 * {
 *   "ph": 7.21,
 *   "tds": 285.63,
 *   "turbidity": 12.45
 * }
 */
http.route({
  path: "/arduino/data",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("X-API-Key");
    const deviceId = request.headers.get("X-Device-ID");

    if (!apiKey || !deviceId) {
      return new Response(
        JSON.stringify({ error: "Missing X-API-Key or X-Device-ID headers" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate API key
    const device = await ctx.runQuery(internal.devices.validateApiKey, {
      apiKey,
    });
    if (!device || device.deviceId !== deviceId) {
      return new Response(
        JSON.stringify({ error: "Invalid API key or device ID" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse body
    let parsedBody: unknown;
    try {
      parsedBody = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      typeof parsedBody !== "object" ||
      parsedBody === null ||
      Array.isArray(parsedBody)
    ) {
      return new Response(
        JSON.stringify({ error: "JSON body must be an object" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const body = parsedBody as Record<string, unknown>;

    if (!isValidSensorValues(body)) {
      return new Response(
        JSON.stringify({
          error:
            "Expected finite ph (0–14), nonnegative tds and turbidity; all sensors are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const { ph, tds, turbidity } = body;
    const raw = parsedBody as Record<string, unknown>;
    const keys = ["sessionId", "seq", "gatewayObservedAt", "sourceSequence", "sourceUptimeMs"];
    const metadata = Object.fromEntries(keys.filter(key => raw[key] !== undefined).map(key => [key, raw[key]]));
    if (keys.some(key => metadata[key] !== undefined && typeof metadata[key] !==
        (["sessionId", "gatewayObservedAt"].includes(key) ? "string" : "number"))) {
      return new Response(JSON.stringify({ error: "Invalid telemetry metadata types" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save reading (triggers threshold alerts + offline scheduling)
    let result;
    try {
      result = await ctx.runMutation(internal.devices.internalSaveReading, {
        deviceId, ph, tds, turbidity,
        ...metadata as Telemetry,
      });
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "object" && error.data?.code === "TELEMETRY_REJECTED") {
        return new Response(JSON.stringify({ error: "Telemetry rejected: invalid, delayed or replayed frame." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw error;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: result?.duplicate ? "Duplicate ignored" : "Reading saved",
        duplicate: result?.duplicate ?? false,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }),
});

http.route({
  path: "/arduino/control/next",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

/**
 * POST /arduino/control/next
 * Returns the latest short-lived pump command for the authenticated device.
 * An empty 204 response means that there is no pending command.
 */
http.route({
  path: "/arduino/control/next",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("X-API-Key");
    const deviceId = request.headers.get("X-Device-ID");
    if (!apiKey || !deviceId) {
      return new Response(
        JSON.stringify({ error: "Missing X-API-Key or X-Device-ID headers" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const device = await ctx.runQuery(internal.devices.validateApiKey, {
      apiKey,
    });
    if (!device || device.deviceId !== deviceId) {
      return new Response(
        JSON.stringify({ error: "Invalid API key or device ID" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const command = await ctx.runQuery(
      internal.devices.getPendingControlCommand,
      {
        deviceId,
      },
    );
    if (!command)
      return new Response(null, { status: 204, headers: corsHeaders });
    return new Response(JSON.stringify(command), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/arduino/control/ack",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

/** POST /arduino/control/ack — records the Arduino relay result. */
http.route({
  path: "/arduino/control/ack",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("X-API-Key");
    const deviceId = request.headers.get("X-Device-ID");
    if (!apiKey || !deviceId) {
      return new Response(
        JSON.stringify({ error: "Missing X-API-Key or X-Device-ID headers" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const device = await ctx.runQuery(internal.devices.validateApiKey, {
      apiKey,
    });
    if (!device || device.deviceId !== deviceId) {
      return new Response(
        JSON.stringify({ error: "Invalid API key or device ID" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return new Response(
        JSON.stringify({ error: "JSON body must be an object" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const ack = body as Record<string, unknown>;
    if (
      typeof ack.commandId !== "string" ||
      typeof ack.ok !== "boolean" ||
      typeof ack.pumpOn !== "boolean" ||
      (ack.message !== undefined && typeof ack.message !== "string")
    ) {
      return new Response(
        JSON.stringify({
          error: "Expected commandId, ok, pumpOn, and optional message",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const result = await ctx.runMutation(
      internal.devices.acknowledgeControlCommand,
      {
        deviceId,
        commandId: ack.commandId,
        ok: ack.ok,
        pumpOn: ack.pumpOn,
        message:
          typeof ack.message === "string"
            ? ack.message.slice(0, 240)
            : undefined,
      },
    );
    return new Response(JSON.stringify(result), {
      status: result.accepted ? 200 : 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/arduino/control/status",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

/** POST /arduino/control/status — refreshes the controller's reported relay state. */
http.route({
  path: "/arduino/control/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = request.headers.get("X-API-Key");
    const deviceId = request.headers.get("X-Device-ID");
    if (!apiKey || !deviceId) {
      return new Response(
        JSON.stringify({ error: "Missing X-API-Key or X-Device-ID headers" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const device = await ctx.runQuery(internal.devices.validateApiKey, {
      apiKey,
    });
    if (!device || device.deviceId !== deviceId) {
      return new Response(
        JSON.stringify({ error: "Invalid API key or device ID" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body) ||
      typeof (body as Record<string, unknown>).pumpOn !== "boolean" ||
      ((body as Record<string, unknown>).emergencyLock !== undefined &&
        typeof (body as Record<string, unknown>).emergencyLock !== "boolean")
    ) {
      return new Response(
        JSON.stringify({ error: "Expected pumpOn: boolean" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    await ctx.runMutation(internal.devices.reportPumpStatus, {
      deviceId,
      pumpOn: (body as { pumpOn: boolean }).pumpOn,
      emergencyLock: (body as { emergencyLock?: boolean }).emergencyLock,
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
});

/** The guest surface has no operational query, user identity or device command path. */
function demoHeaders(origin: string | null) {
  return {
    ...(demoOriginAllowed(origin) ? { "Access-Control-Allow-Origin": origin! } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-DWMS-Demo-Session",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}
function demoResponse(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: demoHeaders(request.headers.get("Origin")) });
}
function guestError(error: unknown) {
  if (error instanceof DemoAiError) return { code: error.code, message: error.message, status: error.status };
  if (error instanceof ConvexError && error.data && typeof error.data === "object") {
    const data = error.data as { code?: unknown; message?: unknown };
    if (typeof data.code === "string" && data.code.startsWith("DEMO_AI_") && typeof data.message === "string") {
      const status = /SESSION_(INVALID|EXPIRED)/.test(data.code) ? 401 : /UNAVAILABLE/.test(data.code) ? 503 : /BAD_REQUEST/.test(data.code) ? 400 : 429;
      return { code: data.code, message: data.message, status };
    }
  }
  return { code: "DEMO_AI_UNAVAILABLE", message: "Guest Ethm is temporarily unavailable. Scenario monitoring remains available.", status: 503 };
}
async function guestBody(request: Request, allowed: readonly string[]) {
  if (!demoOriginAllowed(request.headers.get("Origin"))) throw new DemoAiError("DEMO_AI_ORIGIN_DENIED", "Use the published demonstration to access guest Ethm.", 403);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) throw new DemoAiError("DEMO_AI_BAD_REQUEST", "Use a JSON request.", 415);
  const length = request.headers.get("Content-Length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > DEMO_AI_LIMITS.bodyBytes)) throw new DemoAiError("DEMO_AI_BODY_LIMIT", "The demonstration request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new DemoAiError("DEMO_AI_BAD_REQUEST", "Use a JSON request.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > DEMO_AI_LIMITS.bodyBytes) { await reader.cancel(); throw new DemoAiError("DEMO_AI_BODY_LIMIT", "The demonstration request is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let parsed: unknown;
  try {
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { throw new DemoAiError("DEMO_AI_BAD_REQUEST", "Use a valid JSON request."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).some(key => !allowed.includes(key))) throw new DemoAiError("DEMO_AI_BAD_REQUEST", "Use only the supported demonstration request fields.");
  return parsed as Record<string, unknown>;
}
async function sessionHash(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new DemoAiError("DEMO_AI_SESSION_INVALID", "Start a new guest conversation.", 401);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}
function newSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(Array.from(bytes, value => String.fromCharCode(value)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
for (const path of ["/demo/ethm/session", "/demo/ethm/chat"]) {
  http.route({ path, method: "OPTIONS", handler: httpAction(async (_ctx, request) => new Response(null, { status: demoOriginAllowed(request.headers.get("Origin")) ? 204 : 403, headers: demoHeaders(request.headers.get("Origin")) })) });
}
http.route({
  path: "/demo/ethm/session", method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await guestBody(request, ["clearHistory"]);
      if (body.clearHistory !== undefined && typeof body.clearHistory !== "boolean") throw new DemoAiError("DEMO_AI_BAD_REQUEST", "Use a valid conversation request.");
      let token = request.headers.get("X-DWMS-Demo-Session");
      if (!token && body.clearHistory === true) throw new DemoAiError("DEMO_AI_SESSION_INVALID", "Start a guest conversation before clearing it.", 401);
      if (!token) {
        token = newSessionToken();
        const session = await ctx.runMutation(internal.demoEthm.createSession, { tokenHash: await sessionHash(token) });
        return demoResponse(request, { enabled: true, ...session, sessionToken: token });
      }
      const tokenHash = await sessionHash(token);
      const session = body.clearHistory === true
        ? await ctx.runMutation(internal.demoEthm.clearHistory, { tokenHash })
        : await ctx.runQuery(internal.demoEthm.getSession, { tokenHash });
      return demoResponse(request, { enabled: true, expiresAt: session.expiresAt, remainingTurns: session.remainingTurns, limits: session.limits, nextRequestAt: session.nextRequestAt, messages: session.messages, sessionToken: token });
    } catch (error) { const safe = guestError(error); return demoResponse(request, { error: { code: safe.code, message: safe.message } }, safe.status); }
  }),
});
http.route({
  path: "/demo/ethm/chat", method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await guestBody(request, ["question", "context", "language"]);
      const token = request.headers.get("X-DWMS-Demo-Session");
      if (!token) throw new DemoAiError("DEMO_AI_SESSION_INVALID", "Start a guest conversation before asking Ethm.", 401);
      if (body.language !== undefined && body.language !== "en" && body.language !== "ar") throw new DemoAiError("DEMO_AI_BAD_REQUEST", "Choose English or Arabic.");
      if (!body.context || typeof body.context !== "object" || Array.isArray(body.context)) throw new DemoAiError("DEMO_AI_INVALID_CONTEXT", "Use the official demonstration context.");
      const result = await ctx.runAction(internal.demoEthmAction.respond, { tokenHash: await sessionHash(token), question: validateDemoQuestion(body.question), contextJson: JSON.stringify(body.context), ...(body.language === undefined ? {} : { language: body.language }) });
      if (!result.ok) return demoResponse(request, { error: result.error, ...(result.remainingTurns === undefined ? {} : { remainingTurns: result.remainingTurns }) }, result.status);
      return demoResponse(request, result);
    } catch (error) { const safe = guestError(error); return demoResponse(request, { error: { code: safe.code, message: safe.message } }, safe.status); }
  }),
});

export default http;
