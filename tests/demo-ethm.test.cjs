const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const { getFunctionName } = require("convex/server");
const { createHash } = require("node:crypto");
const { Completions } = require("openai/resources/chat/completions");
const build = process.env.DWMS_TEST_BUILD_DIR;
const policy = require(path.join(build, "convex/demoEthmPolicy.js"));
const sessions = require(path.join(build, "convex/demoEthm.js"));
const action = require(path.join(build, "convex/demoEthmAction.js"));
const http = require(path.join(build, "convex/http.js")).default;
const origin = policy.DEMO_AI_ORIGIN;
const hash = value => createHash("sha256").update(value).digest("hex");
const stamp = (offset = 0) => new Date(Date.now() + offset).toISOString();
const context = (scenario = "normal", overrides = {}) => ({ scenario, mode: "auto", pumpOn: false, emergencyLatched: false, history: [{ scenario, timestamp: stamp(-100) }], ...overrides });

function fixture() {
  let sequence = 0;
  const tables = { demoEthmBudgets: [], demoEthmSessions: [] };
  const allowed = table => { assert.ok(Object.hasOwn(tables, table), `Guest code attempted non-demo table ${table}`); return tables[table]; };
  const ctx = { db: {
    query(table) {
      const rows = allowed(table), conditions = [];
      const query = { withIndex(_name, callback) { const range = { eq(key, value) { conditions.push([key, value]); return range; } }; callback(range); return query; },
        unique: async () => { const found = rows.filter(row => conditions.every(([key, value]) => row[key] === value)); assert.ok(found.length <= 1); return found[0] ? structuredClone(found[0]) : null; },
      }; return query;
    },
    insert: async (table, fields) => { const id = `${table}:${++sequence}`; allowed(table).push({ _id: id, ...structuredClone(fields) }); return id; },
    get: async id => Object.values(tables).flat().find(row => row._id === id) ?? null,
    patch: async (id, fields) => { const row = Object.values(tables).flat().find(row => row._id === id); assert.ok(row); Object.assign(row, structuredClone(fields)); },
  } };
  const invoke = (name, args) => sessions[name]._handler(ctx, args);
  const internal = (fn, args) => { const [module, name] = getFunctionName(fn).split(":"); assert.equal(module, "demoEthm", "Guest request cannot call operational APIs"); return invoke(name, args); };
  ctx.runQuery = internal; ctx.runMutation = internal;
  ctx.runAction = (fn, args) => { assert.equal(getFunctionName(fn), "demoEthmAction:respond"); return action.respond._handler(ctx, args); };
  const request = (endpoint, body, { token, requestOrigin = origin, raw, headers = {} } = {}) => {
    const [handler] = http.lookup(endpoint, "POST");
    return handler._handler(ctx, new Request(`https://fixture.convex.site${endpoint}`, { method: "POST", headers: { Origin: requestOrigin, "Content-Type": "application/json", ...(token ? { "X-DWMS-Demo-Session": token } : {}), ...headers }, body: raw ?? JSON.stringify(body), ...(raw instanceof ReadableStream ? { duplex: "half" } : {}) }));
  };
  return { tables, ctx, invoke, request };
}
async function enabled(execute, budget = "250000") {
  const previous = { enabled: process.env.DWMS_DEMO_AI_ENABLED, budget: process.env.DWMS_DEMO_AI_TOKEN_BUDGET, key: process.env.OPENAI_API_KEY };
  process.env.DWMS_DEMO_AI_ENABLED = "true"; process.env.DWMS_DEMO_AI_TOKEN_BUDGET = budget; process.env.OPENAI_API_KEY = "synthetic-no-network";
  try { return await execute(); }
  finally {
    for (const [key, value] of [["DWMS_DEMO_AI_ENABLED", previous.enabled], ["DWMS_DEMO_AI_TOKEN_BUDGET", previous.budget], ["OPENAI_API_KEY", previous.key]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
}
async function completion(callback, execute) { const original = Completions.prototype.create; Completions.prototype.create = callback; try { return await execute(); } finally { Completions.prototype.create = original; } }
const rejected = code => error => error.data?.code === code;

// Handler fixtures never contact a model, impersonate Auth0 or write production.
test("guest context rejects supplied measurements and inconsistent interlocks; official history is not inflated", () => {
  const canonical = policy.canonicalDemoContext(context("warning"));
  assert.equal(canonical.readings.tds, 650); assert.equal(canonical.history.length, 1); assert.equal(canonical.history[0].tds, 650);
  assert.equal(canonical.dataBasis, "SIMULATED"); assert.equal(canonical.response.physicalEquipmentConnected, false);
  assert.deepEqual(canonical.units, { ph: "dimensionless", tds: "ppm", turbidity: "NTU", flowRate: "L/min (demonstration only)" });
  for (const bad of [context("normal", { deviceId: "operational-id" }), context("normal", { ph: 1 }), context("critical"), context("normal", { history: [{ scenario: "normal", timestamp: stamp(1000) }] }), context("normal", { history: [{ scenario: "warning", timestamp: stamp(-100) }] })]) assert.throws(() => policy.canonicalDemoContext(bad), error => error.code === "DEMO_AI_INVALID_CONTEXT");
  const recovery = policy.canonicalDemoContext(context("recovery", { history: [{ scenario: "critical", timestamp: stamp(-200) }, { scenario: "recovery", timestamp: stamp(-100) }], mode: "emergency", emergencyLatched: true }));
  assert.equal(recovery.response.emergencyLatched, true); assert.equal(recovery.response.pumpOn, false);
});

test("guest session capability is random, stored hashed, privately resumed and origin/body constrained", () => enabled(async () => {
  const f = fixture(); const response = await f.request("/demo/ethm/session", {}); assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin); assert.equal(response.headers.get("Cache-Control"), "no-store");
  const session = await response.json(); assert.match(session.sessionToken, /^[A-Za-z0-9_-]{43}$/); assert.equal(session.remainingTurns, 6);
  const stored = f.tables.demoEthmSessions[0]; assert.equal(stored.tokenHash, hash(session.sessionToken)); assert.ok(!JSON.stringify(stored).includes(session.sessionToken));
  const resume = await f.request("/demo/ethm/session", {}, { token: session.sessionToken }); assert.equal((await resume.json()).remainingTurns, 6); assert.equal(f.tables.demoEthmSessions.length, 1);
  const denied = await f.request("/demo/ethm/session", {}, { requestOrigin: "https://untrusted.invalid" }); assert.equal(denied.status, 403); assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal((await f.request("/demo/ethm/session", {}, { raw: "x".repeat(8193) })).status, 413);
  const oversizedStream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(4096)); controller.enqueue(new Uint8Array(4097)); controller.close(); } });
  assert.equal((await f.request("/demo/ethm/session", {}, { raw: oversizedStream, headers: { "Content-Length": "2" } })).status, 413);
  assert.equal((await f.request("/demo/ethm/session", { unauthorizedField: true })).status, 400);
  assert.equal((await f.request("/demo/ethm/chat", { question: "Explain", context: context() })).status, 401);
  assert.equal((await f.request("/demo/ethm/session", {}, { token: "malformed" })).status, 401);
  assert.equal(f.tables.demoEthmSessions.length, 1);
}));

test("guest gates default closed and immutable maximum cannot be raised through configuration", () => {
  assert.equal(policy.demoAiConfiguration({}).enabled, false);
  assert.equal(policy.demoAiConfiguration({ DWMS_DEMO_AI_ENABLED: "true", DWMS_DEMO_AI_TOKEN_BUDGET: "99999999" }).tokenBudget, 250000);
  assert.equal(policy.demoAiConfiguration({ DWMS_DEMO_AI_ENABLED: "true", DWMS_DEMO_AI_TOKEN_BUDGET: "Infinity" }).enabled, false);
  const expected = policy.reservedPromptTokens([{ role: "user", content: "بيانات" }]); assert.ok(expected > new TextEncoder().encode("بيانات").byteLength + policy.DEMO_AI_LIMITS.completionTokens);
  assert.throws(() => policy.reservedPromptTokens([{ role: "user", content: "a".repeat(28001) }]), error => error.code === "DEMO_AI_CONTEXT_LIMIT");
});

test("serialized reservations enforce pending ownership, session quota and no-refund lifetime allowance", () => enabled(async () => {
  const f = fixture(), tokenHash = hash("a"), requestId = "1".repeat(32);
  await f.invoke("createSession", { tokenHash });
  const reserve = { tokenHash, requestId, expectedRevision: 0, tokens: 10000 };
  await f.invoke("reserve", reserve);
  await assert.rejects(f.invoke("reserve", { ...reserve, requestId: "2".repeat(32) }), rejected("DEMO_AI_BUSY"));
  const before = f.tables.demoEthmBudgets[0].reservedTokens;
  await f.invoke("finish", { tokenHash, requestId, expectedRevision: 0, question: "Question", text: "Synthetic failed status", generatedAt: stamp(), contextScenario: "normal", contextAsOf: stamp(), sources: [], successful: false });
  await f.invoke("finish", { tokenHash, requestId, expectedRevision: 0, question: "Question", text: "Late duplicate", generatedAt: stamp(), contextScenario: "normal", contextAsOf: stamp(), sources: [], successful: true });
  assert.equal(f.tables.demoEthmBudgets[0].reservedTokens, before); assert.equal(f.tables.demoEthmSessions[0].messages.length, 2); assert.equal(f.tables.demoEthmSessions[0].messages[1].kind, "service_status");
  await f.invoke("clearHistory", { tokenHash }); assert.equal(f.tables.demoEthmSessions[0].turns, 1); assert.equal(f.tables.demoEthmSessions[0].reservedTokens, before);
  f.tables.demoEthmSessions[0].lastRequestAt = 0; f.tables.demoEthmSessions[0].turns = 6;
  await assert.rejects(f.invoke("reserve", { ...reserve, expectedRevision: 2 }), rejected("DEMO_AI_SESSION_QUOTA"));
  f.tables.demoEthmSessions[0].turns = 1; f.tables.demoEthmBudgets[0].reservedTokens = 245000; f.tables.demoEthmBudgets[0].windowAt = Date.now() - 120000;
  await assert.rejects(f.invoke("reserve", { ...reserve, expectedRevision: 2 }), rejected("DEMO_AI_BUDGET_EXHAUSTED"));
  assert.equal(f.tables.demoEthmBudgets[0].reservedTokens, 245000);
}));

test("clearing during an in-flight guest request never resurrects history or refunds a reservation", () => enabled(async () => {
  const f = fixture(), tokenHash = hash("b"), requestId = "3".repeat(32);
  await f.invoke("createSession", { tokenHash }); await f.invoke("reserve", { tokenHash, requestId, expectedRevision: 0, tokens: 10000 }); await f.invoke("clearHistory", { tokenHash });
  await f.invoke("finish", { tokenHash, requestId, expectedRevision: 0, question: "Question", text: "Late result", generatedAt: stamp(), contextScenario: "normal", contextAsOf: stamp(), sources: [], successful: true });
  assert.deepEqual((await f.invoke("getSession", { tokenHash })).messages, []); assert.equal(f.tables.demoEthmBudgets[0].reservedTokens, 10000);
  f.tables.demoEthmSessions[0].expiresAt = stamp(-1); await assert.rejects(f.invoke("getSession", { tokenHash }), rejected("DEMO_AI_SESSION_EXPIRED"));
}));

test("guest model request uses only official fixtures/private guest history, never tools or operational tables", () => enabled(async () => {
  const f = fixture(); const session = await (await f.request("/demo/ethm/session", {})).json(); let modelRequest;
  await completion(async request => { modelRequest = request; return { choices: [{ message: { content: "SYNTHETIC model fixture: pH7.2 from simulated data [WHO_PH_2022]" }, finish_reason: "stop" }] }; }, async () => {
    const answer = await f.request("/demo/ethm/chat", { question: "اشرح البيانات", context: context("warning"), language: "ar" }, { token: session.sessionToken });
    assert.equal(answer.status, 200); const data = await answer.json(); assert.equal(data.dataBasis, "simulated"); assert.equal(data.remainingTurns, 5); assert.equal(data.sources[0].id, "WHO_PH_2022");
  });
  assert.equal(modelRequest.model, "gpt-5-mini"); assert.equal(modelRequest.max_completion_tokens, 1200); assert.equal(modelRequest.tools, undefined); assert.match(JSON.stringify(modelRequest.messages), /Respond in Arabic/); assert.match(JSON.stringify(modelRequest.messages), /650/); assert.doesNotMatch(JSON.stringify(modelRequest.messages), /OPENAI_API_KEY|operational-id/);
  const reserved = f.tables.demoEthmBudgets[0].reservedTokens; assert.ok(reserved > 1200); assert.equal(f.tables.demoEthmSessions[0].messages.length, 2);
  f.tables.demoEthmSessions[0].lastRequestAt = 0;
  await completion(async () => { throw new Error("PRIVATE PROVIDER DETAIL"); }, async () => {
    const response = await f.request("/demo/ethm/chat", { question: "Follow-up", context: context() }, { token: session.sessionToken }); assert.equal(response.status, 503); const data = await response.json(); assert.equal(data.remainingTurns, 4); assert.ok(!JSON.stringify(data).includes("PRIVATE PROVIDER DETAIL"));
  });
  assert.ok(f.tables.demoEthmBudgets[0].reservedTokens > reserved); assert.equal(f.tables.demoEthmSessions[0].messages.at(-1).kind, "service_status");
}));


test("global mint/request throttles reset only minute buckets while lifetime reservation survives", () => enabled(async () => {
  const f = fixture(), tokenHash = hash("rates"); await f.invoke("createSession", { tokenHash });
  const budget = f.tables.demoEthmBudgets[0]; budget.windowSessions = policy.DEMO_AI_LIMITS.sessionsPerMinute;
  await assert.rejects(f.invoke("createSession", { tokenHash: hash("new") }), rejected("DEMO_AI_RATE_LIMITED"));
  budget.windowSessions = 1; budget.windowRequests = policy.DEMO_AI_LIMITS.requestsPerMinute; budget.reservedTokens = 12345;
  const reservation = { tokenHash, requestId: "4".repeat(32), expectedRevision: 0, tokens: 10000 };
  await assert.rejects(f.invoke("reserve", reservation), rejected("DEMO_AI_RATE_LIMITED"));
  budget.windowAt = Date.now() - 61000;
  await f.invoke("reserve", reservation); assert.equal(budget.reservedTokens, 22345); assert.equal(budget.windowRequests, 1);
  const session = f.tables.demoEthmSessions[0]; session.pendingId = undefined; session.pendingUntil = undefined;
  await assert.rejects(f.invoke("reserve", { ...reservation, requestId: "5".repeat(32) }), rejected("DEMO_AI_RATE_LIMITED"));
  session.lastRequestAt = 0; session.turns = 6;
  await assert.rejects(f.invoke("reserve", { ...reservation, requestId: "6".repeat(32) }), rejected("DEMO_AI_SESSION_QUOTA"));
  assert.equal(budget.reservedTokens, 22345);
}));
