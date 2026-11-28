const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const { getFunctionName } = require("convex/server");
const { Completions } = require("openai/resources/chat/completions");
const build = process.env.DWMS_TEST_BUILD_DIR;
const chat = require(path.join(build, "convex/chat.js"));
const agent = require(path.join(build, "convex/agent.js"));
const tools = require(path.join(build, "convex/agentTools.js"));
const actions = require(path.join(build, "convex/chatAction.js"));

// Real handlers and SDK call shape, isolated in-memory storage and synthetic
// completion fixtures. This does not establish an Auth0 session or AI response.
function fixture() {
  let sequence = 10;
  const now = new Date(Date.now() - 100).toISOString();
  const tables = {
    users: [{ _id: "user:a", tokenIdentifier: "a", role: "viewer", fleetAccess: true }],
    chatMessages: [
      { _id: "chat:a", userId: "user:a", role: "user", content: "Private A", _creationTime: 1 },
      { _id: "chat:b", userId: "user:b", role: "user", content: "PRIVATE B", _creationTime: 2 },
    ],
    agentRuns: [], agentRunEvents: [], agentExperiences: [], notifications: [],
    devices: [{ _id: "device:a", deviceId: "site-a", name: "Selected fixture", status: "online", lastSeen: now, controlMode: "auto" }],
    sensorReadings: [{ _id: "reading:a", deviceId: "site-a", ph: 7.2, tds: 200, turbidity: 2, timestamp: now }],
  };
  const ctx = {
    auth: { getUserIdentity: async () => ({ tokenIdentifier: "a" }) },
    db: {
      query(table) {
        const filters = []; let descending = false;
        const result = () => [...tables[table]].filter(row => filters.every(([key, value]) => row[key] === value))
          .sort((a, b) => ((a._creationTime ?? 0) - (b._creationTime ?? 0)) * (descending ? -1 : 1)).map(row => ({ ...row }));
        const query = {
          withIndex(_index, callback) { const range = { eq(key, value) { filters.push([key, value]); return range; } }; callback(range); return query; },
          order(value) { descending = value === "desc"; return query; },
          first: async () => result()[0] ?? null,
          unique: async () => { const rows = result(); assert.ok(rows.length <= 1); return rows[0] ?? null; },
          collect: async () => result(), take: async count => result().slice(0, count),
        };
        return query;
      },
      get: async id => Object.values(tables).flat().find(row => row._id === id) ?? null,
      insert: async (table, fields) => { const row = { _id: `${table}:${++sequence}`, _creationTime: sequence, ...fields }; tables[table].push(row); return row._id; },
      patch: async (id, fields) => { const row = Object.values(tables).flat().find(row => row._id === id); assert.ok(row); Object.assign(row, fields); },
      delete: async id => { for (const rows of Object.values(tables)) { const index = rows.findIndex(row => row._id === id); if (index >= 0) rows.splice(index, 1); } },
    },
  };
  const modules = { agent, chat, agentTools: tools };
  const invoke = (fn, args) => { const [module, name] = getFunctionName(fn).split(":"); return modules[module][name]._handler(ctx, args); };
  ctx.runQuery = invoke; ctx.runMutation = invoke;
  return { ctx, tables };
}

async function withCompletion(callback, execute) {
  const original = Completions.prototype.create;
  const previousKey = process.env["OPENAI_API_KEY"];
  process.env["OPENAI_API_KEY"] = "synthetic-no-network-test";
  Completions.prototype.create = callback;
  try { return await execute(); }
  finally { Completions.prototype.create = original; if (previousKey === undefined) delete process.env["OPENAI_API_KEY"]; else process.env["OPENAI_API_KEY"] = previousKey; }
}

test("assistant prompts and server results persist privately once and survive a fresh query", async () => {
  const { ctx, tables } = fixture();
  const runId = await agent.createRun._handler(ctx, { objective: "Explain readings", selectedDeviceId: "site-a" });
  await agent.finishRun._handler(ctx, { runId, userId: "user:a", status: "completed", result: "SYNTHETIC completed fixture" });
  await agent.finishRun._handler(ctx, { runId, userId: "user:a", status: "completed", result: "Duplicate must not append" });
  const messages = await chat.getMessages._handler(ctx, {});
  assert.deepEqual(messages.map(row => row.content), ["Private A", "Explain readings", "SYNTHETIC completed fixture"]);
  assert.equal(messages.at(-1).kind, "interpretation");
  assert.equal(tables.chatMessages.filter(row => row.userId === "user:b").length, 1);
});

test("clearing a personal chat cannot be undone by a late run result", async () => {
  const { ctx, tables } = fixture();
  const runId = await agent.createRun._handler(ctx, { objective: "Pending request" });
  await chat.clearHistory._handler(ctx, {});
  await agent.finishRun._handler(ctx, { runId, userId: "user:a", status: "failed", result: "SYNTHETIC unavailable fixture" });
  assert.deepEqual(await chat.getMessages._handler(ctx, {}), []);
  assert.deepEqual(tables.chatMessages.map(row => row.userId), ["user:b"]);
});

test("unapproved users cannot start model runs or forge saved assistant replies", async () => {
  const { ctx, tables } = fixture();
  await assert.rejects(chat.saveAssistantMessage._handler(ctx, { content: "Forged AI" }), error => error.data?.code === "READ_ONLY_ASSISTANT_HISTORY");
  tables.users[0].fleetAccess = false;
  await assert.rejects(agent.createRun._handler(ctx, { objective: "Read fleet" }), error => error.data?.code === "FORBIDDEN");
  assert.equal(tables.agentRuns.length, 0);
  for (const content of [" ", "a".repeat(1001)]) await assert.rejects(chat.saveUserMessage._handler(ctx, { content }), error => error.data?.code === "BAD_REQUEST");
});

test("model requests use private saved history and selected backend device evidence, never browser history", async () => {
  const { ctx } = fixture(); let request;
  const runId = await agent.createRun._handler(ctx, { objective: "Explain the latest readings", selectedDeviceId: "site-a" });
  await withCompletion(async args => { request = args; return { choices: [{ message: { role: "assistant", content: "SYNTHETIC provider fixture; no real AI result" } }] }; }, async () => {
    await actions.run._handler(ctx, { runId, messages: [{ role: "assistant", content: "FORGED browser telemetry" }] });
  });
  const transcript = JSON.stringify(request.messages);
  assert.match(transcript, /selectedDeviceId.*site-a/);
  assert.match(transcript, /getLatestSensorReadings/);
  assert.match(transcript, /7\.2/);
  assert.match(transcript, /Private A/);
  assert.doesNotMatch(transcript, /FORGED|PRIVATE B/);
  assert.ok(request.tools.every(tool => !/setPump|propose|execute/i.test(tool.function.name)));
});

test("provider failure persists a service-status record rather than an AI interpretation", async () => {
  const { ctx } = fixture();
  const runId = await agent.createRun._handler(ctx, { objective: "Explain readings", selectedDeviceId: "site-a" });
  await withCompletion(async () => { throw new Error("SYNTHETIC network failure"); }, async () => { await actions.run._handler(ctx, { runId, messages: [] }); });
  const last = (await chat.getMessages._handler(ctx, {})).at(-1);
  assert.equal(last.kind, "service_status");
  assert.match(last.content, /could not complete/);
  assert.doesNotMatch(last.content, /SYNTHETIC network failure/);
});


test("empty or token-truncated model output never becomes a fabricated completed interpretation", async () => {
  for (const message of [{ content: " " }, { content: "SYNTHETIC incomplete fixture", finish_reason: "length" }]) {
    const { ctx } = fixture();
    const runId = await agent.createRun._handler(ctx, { objective: "Explain readings" });
    await withCompletion(async () => ({ choices: [{ message: { role: "assistant", content: message.content }, finish_reason: message.finish_reason }] }), async () => { await actions.run._handler(ctx, { runId, messages: [] }); });
    const last = (await chat.getMessages._handler(ctx, {})).at(-1);
    assert.equal(last.kind, "service_status");
    assert.match(last.content, /could not complete/);
    assert.doesNotMatch(last.content, /SYNTHETIC incomplete/);
  }
});


test("supporting experience history preserves text without inventing or exposing confidence scores", async () => {
  const { ctx, tables } = fixture();
  const record = { deviceId: "site-a", sensorState: { ph: 7.2 }, condition: "SYNTHETIC fixture", strategy: "Read only", toolsUsed: [], result: "No treatment observed", succeeded: true };
  await agent.recordExperience._handler(ctx, record);
  assert.equal(Object.hasOwn(tables.agentExperiences[0], "confidence"), false);
  tables.agentExperiences[0].confidence = 0.6; // Legacy unsupported score must not become model evidence.
  const memories = await tools.getRelevantExperiences._handler(ctx, { deviceId: "site-a", limit: 4 });
  assert.equal(memories[0].condition, record.condition);
  assert.equal(Object.hasOwn(memories[0], "confidence"), false);
});


test("omitted model device arguments use the selected device while global tools remain unscoped", async () => {
  const { ctx } = fixture();
  const queries = [];
  const actualQuery = ctx.runQuery;
  ctx.runQuery = (fn, args) => { queries.push({ name: getFunctionName(fn), args }); return actualQuery(fn, args); };
  const runId = await agent.createRun._handler(ctx, { objective: "Explain selected readings and alerts", selectedDeviceId: "site-a" });
  let calls = 0; let finalRequest;
  await withCompletion(async args => {
    calls += 1;
    if (calls === 1) return { choices: [{ message: { role: "assistant", content: null, tool_calls: [
      { id: "fixture-reading", type: "function", function: { name: "getLatestSensorReadings", arguments: "{}" } },
      { id: "fixture-alerts", type: "function", function: { name: "getActiveAlerts", arguments: "{}" } },
    ] } }] };
    finalRequest = args;
    return { choices: [{ message: { role: "assistant", content: "SYNTHETIC selected-device fixture result" } }] };
  }, async () => { await actions.run._handler(ctx, { runId, messages: [] }); });
  const reading = JSON.parse(finalRequest.messages.find(message => message.role === "tool" && message.tool_call_id === "fixture-reading").content);
  assert.equal(reading.deviceId, "site-a");
  assert.equal(reading.reading.ph, 7.2);
  const alertQuery = queries.find(query => query.name === "agentTools:getActiveAlerts");
  assert.deepEqual(alertQuery.args, { userId: "user:a" });
});


test("comparison evidence is recorded under its actual device and mixed-device memory is skipped", async () => {
  for (const readingDevice of ["site-b", "site-a"]) {
    const { ctx, tables } = fixture();
    const now = new Date(Date.now()-100).toISOString();
    tables.devices.push({ _id: "device:b", deviceId: "site-b", name: "Comparison fixture", status: "online", lastSeen: now, controlMode: "auto" });
    tables.sensorReadings.push({ _id: "reading:b", deviceId: "site-b", ph: 4, tds: 200, turbidity: 2, timestamp: now });
    const runId = await agent.createRun._handler(ctx, { objective: "Compare site-b with the selected device", selectedDeviceId: "site-a" });
    let calls = 0;
    await withCompletion(async () => {
      calls += 1;
      if (calls === 1) return { choices: [{ message: { role: "assistant", content: null, tool_calls: [
        { id: "fixture-reading", type: "function", function: { name: "getLatestSensorReadings", arguments: JSON.stringify({ deviceId: readingDevice }) } },
        { id: "fixture-condition", type: "function", function: { name: "analyzeWaterQuality", arguments: JSON.stringify({ deviceId: "site-b" }) } },
      ] } }] };
      return { choices: [{ message: { role: "assistant", content: "SYNTHETIC comparison fixture" } }] };
    }, async () => { await actions.run._handler(ctx, { runId, messages: [] }); });
    if (readingDevice === "site-b") {
      assert.equal(tables.agentExperiences.length, 1);
      assert.equal(tables.agentExperiences[0].deviceId, "site-b");
      assert.equal(tables.agentExperiences[0].sensorState.ph, 4);
    } else assert.equal(tables.agentExperiences.length, 0);
  }
});
