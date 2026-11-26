import { type Telemetry } from "./telemetry";
import { ConvexError } from "convex/values";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { isValidSensorValues } from "./safetyPolicy";

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

export default http;
