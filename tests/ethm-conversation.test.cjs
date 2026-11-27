const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const build = process.env.DWMS_TEST_BUILD_DIR;
const conversation = require(path.join(build, "src/lib/ethm-conversation.js"));
const { initialDemoState, demoReducer } = require(path.join(build, "src/lib/demo-state.js"));
const { ETHM_KNOWLEDGE_SOURCES } = require(path.join(build, "convex/knowledge.js"));

test("guest conversation sends bounded scenario identity rather than client-supplied sensor or device claims", () => {
  const start = Date.parse("2026-11-27T12:00:00Z");
  let state = initialDemoState(new Date(start).toISOString());
  for (let index = 1; index <= 16; index++) {
    state = demoReducer(state, { type: "scenario", scenario: index % 2 ? "warning" : "normal", timestamp: new Date(start + index * 1000).toISOString() });
  }
  state.readings.ph = 77777;
  const context = conversation.demoIntelligenceContext(state);
  assert.equal(context.history.length, 12);
  assert.deepEqual(Object.keys(context).sort(), ["scenario", "mode", "pumpOn", "emergencyLatched", "history"].sort());
  assert.ok(context.history.every(row => Object.keys(row).sort().join(",") === "scenario,timestamp"));
  assert.doesNotMatch(JSON.stringify(context), /77777|deviceId|apiKey|userId/);
});

test("conversation citations expose only exact reviewed sources, never arbitrary model links", () => {
  for (const source of ETHM_KNOWLEDGE_SOURCES) {
    assert.equal(conversation.safeEthmSourceUrl(source.url), new URL(source.url).href);
    assert.equal(conversation.ethmSourcesForContent(`Context [${source.id}]`)[0].id, source.id);
    assert.equal(conversation.ethmSourcesForContent(`Read [reference](${source.url}).`)[0].id, source.id);
    assert.deepEqual(conversation.ethmSourcesForContent(source.url + "/unreviewed-suffix"), []);
  }
  for (const unsafe of ["javascript:alert(1)", "data:text/html,unsafe", "https://example.com/unreviewed", "https://user:password@www.who.int/", ETHM_KNOWLEDGE_SOURCES[0].url + "?unreviewed=1"]) {
    assert.equal(conversation.safeEthmSourceUrl(unsafe), null);
  }
});

test("guest quota, expiry and rate failures have actionable bilingual status without invented AI text", () => {
  for (const code of ["DEMO_AI_SESSION_EXPIRED", "DEMO_AI_SESSION_INVALID"]) {
    assert.equal(conversation.ethmDemoSessionInvalid(code), true);
    assert.match(conversation.ethmDemoError(code, "en"), /expired/);
  }
  assert.equal(conversation.ethmDemoSessionInvalid("DEMO_AI_BUDGET_EXHAUSTED"), false);
  assert.match(conversation.ethmDemoError("DEMO_AI_BUDGET_EXHAUSTED", "en"), /shared usage allowance/);
  assert.match(conversation.ethmDemoError("DEMO_AI_SESSION_QUOTA", "en"), /question limit/);
  assert.match(conversation.ethmDemoError("DEMO_AI_RATE_LIMITED", "en"), /wait/);
  assert.match(conversation.ethmDemoError("DEMO_AI_CONTEXT_LIMIT", "en"), /does not reset/);
  assert.match(conversation.ethmDemoError("DEMO_AI_BUDGET_EXHAUSTED", "ar"), /الحد المشترك/);
  assert.match(conversation.ethmDemoError("UNRECOGNIZED_PRIVATE_PROVIDER_ERROR", "en"), /temporarily unavailable/);
  assert.doesNotMatch(conversation.ethmDemoError("UNRECOGNIZED_PRIVATE_PROVIDER_ERROR", "en"), /UNRECOGNIZED_PRIVATE/);
});

test("Arabic questions use Arabic naturally while an explicit Arabic preference also covers English prompts", () => {
  assert.equal(conversation.ethmQuestionLanguage("اشرح القراءات الحالية", "en"), "ar");
  assert.equal(conversation.ethmQuestionLanguage("Explain readings", "ar"), "ar");
  assert.equal(conversation.ethmQuestionLanguage("Explain readings", "en"), "en");
  assert.ok(conversation.ethmSuggestedQuestions("ar", true).some(value => value.includes("الطوارئ")));
});
