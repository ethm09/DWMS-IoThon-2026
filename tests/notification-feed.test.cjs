const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { filterNotificationFeed } = require(path.join(process.env.DWMS_TEST_BUILD_DIR, 'src/lib/notification-feed.js'));
const preferences = { enableCritical: true, enableWarning: true, enableInfo: true, enableThreshold: true, enableDevice: true, enableSystem: true, enableMaintenance: true };
const records = Object.freeze([
  Object.freeze({ id: 'critical', level: 'critical', category: 'threshold' }),
  Object.freeze({ id: 'warning', level: 'warning', category: 'device' }),
  Object.freeze({ id: 'info', level: 'info', category: 'system' }),
  Object.freeze({ id: 'maintenance', level: 'info', category: 'maintenance' }),
]);

test('personal feed preferences change visibility without changing saved events', () => {
  assert.deepEqual(filterNotificationFeed(records, preferences, 'all', 'all'), records);
  for (const [flag, id] of [['enableCritical', 'critical'], ['enableWarning', 'warning'], ['enableThreshold', 'critical'], ['enableDevice', 'warning'], ['enableSystem', 'info'], ['enableMaintenance', 'maintenance']]) {
    const result = filterNotificationFeed(records, { ...preferences, [flag]: false }, 'all', 'all');
    assert.equal(result.some(record => record.id === id), false);
    assert.equal(records.length, 4);
    assert.ok(records.every(record => Object.isFrozen(record)));
  }
  assert.deepEqual(filterNotificationFeed(records, { ...preferences, enableInfo: false }, 'all', 'all').map(record => record.id), ['critical', 'warning']);
});

test('explicit notification filters combine with account preferences', () => {
  assert.deepEqual(filterNotificationFeed(records, preferences, 'critical', 'threshold'), [records[0]]);
  assert.deepEqual(filterNotificationFeed(records, preferences, 'critical', 'device'), []);
  assert.deepEqual(filterNotificationFeed(records, { ...preferences, enableCritical: false }, 'critical', 'all'), []);
  assert.deepEqual(filterNotificationFeed(records, preferences, 'all', 'maintenance'), [records[3]]);
});
