const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { demoReducer, initialDemoState } = require(path.join(process.env.DWMS_TEST_BUILD_DIR, 'src/lib/demo-state.js'));
const time = (seconds = 0) => new Date(Date.parse('2026-11-26T12:00:00Z') + seconds * 1000).toISOString();
const scenario = (state, next, seconds) => demoReducer(state, { type: 'scenario', scenario: next, timestamp: time(seconds) });

test('shared scenario transitions record real actions and deduplicate active alerts', () => {
  const initial = initialDemoState(time());
  const warning = scenario(initial, 'warning', 1);
  assert.equal(warning.alerts.filter(item => item.status === 'active').length, 2);
  const repeated = scenario(warning, 'warning', 2);
  assert.equal(repeated.alerts.filter(item => item.status === 'active').length, 2);
  assert.equal(repeated.history.length, 3);
  assert.equal(repeated.history.at(-1).timestamp, time(2));
  assert.equal(repeated.readings.flowRate, 1.5);
  assert.equal(initial.alerts.length, 0, 'reducer must not mutate earlier snapshots');
  assert.equal(warning.alerts.find(item => item.parameter === 'Turbidity').message.includes('8'), true);
  const response = scenario(repeated, 'filtration', 3);
  assert.equal(response.alerts.find(item => item.parameter === 'Turbidity' && item.status === 'active').message.includes('25'), true);
  assert.equal(response.response.pumpOn, true);
  assert.equal(response.alerts.find(item => item.parameter === 'TDS').status, 'resolved');
});

test('emergency remains visibly active through recovery until explicit acknowledgement', () => {
  const critical = scenario(initialDemoState(time()), 'critical', 1);
  assert.equal(critical.response.mode, 'emergency');
  assert.equal(critical.response.pumpOn, false);
  assert.equal(demoReducer(critical, { type: 'acknowledge', timestamp: time(2) }), critical);
  const recovery = scenario(critical, 'recovery', 3);
  assert.equal(recovery.alerts.find(item => item.parameter === 'pH').status, 'resolved');
  assert.equal(recovery.alerts.find(item => item.parameter === 'Controller').status, 'active');
  assert.equal(recovery.response.emergencyLatched, true);
  assert.equal(demoReducer(recovery, { type: 'mode', mode: 'manual', timestamp: time(4) }), recovery);
  const acknowledged = demoReducer(recovery, { type: 'acknowledge', timestamp: time(5) });
  assert.deepEqual(acknowledged.response, { mode: 'auto', pumpOn: false, emergencyLatched: false });
  assert.equal(acknowledged.alerts.filter(item => item.status === 'active').length, 0);
  assert.equal(acknowledged.events[0].type, 'Recovery acknowledged');
});

test('manual operation stays manual, with critical readings overriding manual output', () => {
  const manual = demoReducer(initialDemoState(time()), { type: 'mode', mode: 'manual', timestamp: time(1) });
  const response = scenario(manual, 'filtration', 2);
  assert.equal(response.response.pumpOn, false, 'Auto rule cannot start Manual output');
  const on = demoReducer(response, { type: 'pump', pumpOn: true, timestamp: time(3) });
  assert.equal(on.response.pumpOn, true);
  const stopped = scenario(on, 'critical', 4);
  assert.deepEqual(stopped.response, { mode: 'emergency', pumpOn: false, emergencyLatched: true });
  assert.equal(demoReducer(stopped, { type: 'pump', pumpOn: true, timestamp: time(5) }), stopped);
});

test('reset clears session records and incident histories stay bounded', () => {
  let state = initialDemoState(time());
  for (let index = 1; index < 200; index++) state = scenario(state, index % 2 ? 'warning' : 'normal', index);
  assert.equal(state.history.length, 120);
  assert.equal(state.events.length, 120);
  assert.ok(state.alerts.length <= 80);
  const reset = demoReducer(state, { type: 'reset', timestamp: time(300) });
  assert.equal(reset.history.length, 1);
  assert.equal(reset.alerts.length, 0);
  assert.equal(reset.scenario, 'normal');
  assert.deepEqual(reset.response, { mode: 'auto', pumpOn: false, emergencyLatched: false });
});
