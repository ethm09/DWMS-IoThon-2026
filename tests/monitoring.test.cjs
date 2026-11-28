const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readingFreshness, waterQuality, validWaterReading, DEMO_SCENARIOS, demoResponse } = require(path.join(process.env.DWMS_TEST_BUILD_DIR, 'src/lib/monitoring.js'));

const now = Date.parse('2026-11-26T12:00:00Z');
const receivedAgo = (ms) => new Date(now - ms).toISOString();

test('connectivity ages without a new reading; stale values never become a normal assessment', () => {
  const timestamp = receivedAgo(0);
  assert.equal(readingFreshness(timestamp, now), 'fresh');
  assert.equal(readingFreshness(timestamp, now + 10_000), 'fresh');
  assert.equal(readingFreshness(timestamp, now + 10_001), 'stale');
  assert.equal(readingFreshness(timestamp, now + 30_000), 'stale');
  assert.equal(readingFreshness(timestamp, now + 30_001), 'offline');
  assert.equal(waterQuality(DEMO_SCENARIOS.normal, readingFreshness(timestamp, now + 10_001)), 'unknown');
  assert.equal(waterQuality(DEMO_SCENARIOS.normal, 'offline'), 'unknown');
});

test('missing, invalid and future timestamps do not indicate a connection', () => {
  assert.equal(readingFreshness(null, now), 'missing');
  assert.equal(readingFreshness(undefined, now), 'missing');
  assert.equal(readingFreshness('not-a-date', now), 'invalid');
  assert.equal(readingFreshness(receivedAgo(-1), now), 'invalid');
});

test('missing and invalid channels are unknown rather than safe defaults', () => {
  for (const reading of [null, undefined, { ph: 7.2, tds: 300 }, { ph: NaN, tds: 300, turbidity: 2 }, { ph: 15, tds: 300, turbidity: 2 }, { ph: 7, tds: -1, turbidity: 2 }, { ph: 7, tds: 300, turbidity: Infinity }, { ph: true, tds: 300, turbidity: 2 }]) {
    assert.equal(validWaterReading(reading), false);
    assert.equal(waterQuality(reading, 'fresh'), 'unknown');
  }
  assert.equal(waterQuality(DEMO_SCENARIOS.normal, 'fresh'), 'safe');
  assert.equal(waterQuality(DEMO_SCENARIOS.warning, 'fresh'), 'warning');
  assert.equal(waterQuality(DEMO_SCENARIOS.critical, 'fresh'), 'critical');
});

test('competition scenario demonstrates warning, response, latched stop and explicit recovery', () => {
  let state = demoResponse(DEMO_SCENARIOS.normal, { emergency: false, pumpOn: false });
  assert.deepEqual(state, { emergency: false, pumpOn: false });
  state = demoResponse(DEMO_SCENARIOS.warning, state);
  assert.deepEqual(state, { emergency: false, pumpOn: false });
  state = demoResponse(DEMO_SCENARIOS.filtration, state);
  assert.deepEqual(state, { emergency: false, pumpOn: true });
  state = demoResponse(DEMO_SCENARIOS.critical, state);
  assert.deepEqual(state, { emergency: true, pumpOn: false });
  state = demoResponse(DEMO_SCENARIOS.critical, state, true);
  assert.deepEqual(state, { emergency: true, pumpOn: false }, 'acknowledging critical input cannot restart');
  state = demoResponse(DEMO_SCENARIOS.recovery, state);
  assert.deepEqual(state, { emergency: true, pumpOn: false }, 'recovery data alone cannot clear the latch');
  state = demoResponse(DEMO_SCENARIOS.recovery, state, true);
  assert.deepEqual(state, { emergency: false, pumpOn: false });
});

test('critical turbidity has stop priority over TDS response and invalid readings stop', () => {
  assert.deepEqual(demoResponse({ ph: 7, tds: 1800, turbidity: 51 }, { emergency: false, pumpOn: true }), { emergency: true, pumpOn: false });
  assert.deepEqual(demoResponse({ ph: 7, tds: 1800, turbidity: 2 }, { emergency: false, pumpOn: false }), { emergency: false, pumpOn: true });
  assert.deepEqual(demoResponse({ ph: NaN, tds: 300, turbidity: 2 }, { emergency: false, pumpOn: true }), { emergency: true, pumpOn: false });
});
