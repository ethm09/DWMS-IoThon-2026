import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// CORS headers for all responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
      return new Response(JSON.stringify({ error: "Missing X-API-Key or X-Device-ID headers" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate API key
    const device = await ctx.runQuery(internal.devices.validateApiKey, { apiKey });
    if (!device || device.deviceId !== deviceId) {
      return new Response(JSON.stringify({ error: "Invalid API key or device ID" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    if (typeof parsedBody !== "object" || parsedBody === null || Array.isArray(parsedBody)) {
      return new Response(JSON.stringify({ error: "JSON body must be an object" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = parsedBody as Record<string, unknown>;

    // Validate: must have all three sensor values as numbers
    const ph = typeof body.ph === "number" ? body.ph : undefined;
    const tds = typeof body.tds === "number" ? body.tds : undefined;
    const turbidity = typeof body.turbidity === "number" ? body.turbidity : undefined;

    if (ph === undefined || tds === undefined || turbidity === undefined) {
      return new Response(JSON.stringify({ error: "Missing required fields: ph, tds, turbidity (all must be numbers)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      !Number.isFinite(ph) ||
      !Number.isFinite(tds) ||
      !Number.isFinite(turbidity) ||
      ph < 0 ||
      ph > 14 ||
      tds < 0 ||
      turbidity < 0
    ) {
      return new Response(JSON.stringify({ error: "Sensor values are outside valid measurement ranges" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save reading (triggers threshold alerts + offline scheduling)
    await ctx.runMutation(internal.devices.internalSaveReading, {
      deviceId,
      ph,
      tds,
      turbidity,
    });

    return new Response(JSON.stringify({ ok: true, message: "Reading saved", timestamp: new Date().toISOString() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
});

export default http;
