const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const tools = require(
  path.join(process.env.DWMS_TEST_BUILD_DIR, "convex/agentTools.js"),
);
const stamp = (offset = 0) => new Date(Date.now() + offset).toISOString();
const sample = (overrides = {}) => ({
  _id: "reading:1",
  deviceId: "node-a",
  ph: 7.2,
  tds: 300,
  turbidity: 2,
  timestamp: stamp(-500),
  ...overrides,
});

// Actual registered read-tool handlers, with an explicit in-memory DB adapter.
// These are software fixtures, not a model response, Auth0 login or physical test.
function fixture({ device = {}, readings = [sample()] } = {}) {
  const tables = {
    users: [
      { _id: "user:operator", tokenIdentifier: "operator", role: "operator" },
    ],
    devices: [
      {
        _id: "device:1",
        deviceId: "node-a",
        name: "Synthetic node",
        status: "online",
        lastSeen: stamp(-300),
        controlMode: "auto",
        desiredPumpState: false,
        reportedPumpState: true,
        pumpReportedAt: stamp(-200),
        ...device,
      },
    ],
    sensorReadings: readings,
    deviceCommands: [],
  };
  const ctx = {
    auth: { getUserIdentity: async () => ({ tokenIdentifier: "operator" }) },
    db: {
      query(table) {
        const conditions = [];
        let direction = "asc";
        const rows = () =>
          [...tables[table]]
            .filter((row) =>
              conditions.every(([key, value]) => row[key] === value),
            )
            .sort(
              (a, b) =>
                String(a.timestamp ?? "").localeCompare(
                  String(b.timestamp ?? ""),
                ) * (direction === "desc" ? -1 : 1),
            );
        const query = {
          withIndex(_name, callback) {
            const range = {
              eq(key, value) {
                conditions.push([key, value]);
                return range;
              },
            };
            callback(range);
            return query;
          },
          order(value) {
            direction = value;
            return query;
          },
          unique: async () => {
            const result = rows();
            assert.ok(result.length <= 1);
            return result[0] ?? null;
          },
          first: async () => rows()[0] ?? null,
          take: async (limit) => rows().slice(0, limit),
        };
        return query;
      },
    },
  };
  return {
    tables,
    invoke: (name, args = { deviceId: "node-a" }) =>
      tools[name]._handler(ctx, args),
  };
}

test("Ethm read tools retain gateway observation and receipt provenance without inventing probe time", async () => {
  const timestamp = stamp(-1000),
    receivedAt = stamp(-400);
  const f = fixture({
    readings: [
      sample({ timestamp, receivedAt, timeBasis: "gateway_observation" }),
    ],
  });
  const latest = await f.invoke("getLatestSensorReadings");
  assert.equal(latest.available, true);
  assert.equal(latest.freshness, "LIVE");
  assert.equal(latest.reading.timestamp, timestamp);
  assert.equal(latest.reading.receivedAt, receivedAt);
  assert.equal(latest.reading.timeBasis, "gateway_observation");
  assert.equal("flowRate" in latest.reading, false);
  assert.equal("sourceAcquiredAt" in latest.reading, false);
  assert.equal(
    (await f.invoke("getDataMode")).timeBasis,
    "gateway_observation",
  );
  assert.equal(
    (
      await f.invoke("getRecentSensorReadings", {
        deviceId: "node-a",
        limit: 20,
      })
    ).readings[0].receivedAt,
    receivedAt,
  );
});

test("Ethm never promotes invalid or future telemetry to live measurement evidence", async () => {
  for (const reading of [
    sample({ timestamp: stamp(1000) }),
    sample({ timestamp: "invalid" }),
    sample({ ph: NaN }),
  ]) {
    const f = fixture({ readings: [reading] });
    const mode = await f.invoke("getDataMode");
    assert.equal(mode.mode, "UNKNOWN");
    assert.equal(mode.freshness, "INVALID");
    assert.equal(mode.available, false);
    const latest = await f.invoke("getLatestSensorReadings");
    assert.equal(latest.reading, null);
    assert.equal((await f.invoke("analyzeWaterQuality")).overall, "unknown");
    const safety = await f.invoke("evaluateSafetyState");
    assert.equal(safety.pumpStartAllowed, false);
    assert.equal(safety.available, false);
  }
});

test("Ethm retains historical readings but current state becomes stale when telemetry or connectivity ages", async () => {
  for (const config of [
    { readings: [sample({ timestamp: stamp(-11000) })] },
    { device: { lastSeen: stamp(-11000) } },
    { device: { lastSeen: stamp(1000) } },
    { device: { status: "offline" } },
  ]) {
    const f = fixture(config);
    assert.equal((await f.invoke("getDataMode")).freshness, "STALE");
    assert.equal((await f.invoke("getLatestSensorReadings")).available, true);
    assert.equal((await f.invoke("analyzeWaterQuality")).freshness, "STALE");
    assert.equal(
      (await f.invoke("evaluateSafetyState")).pumpStartAllowed,
      false,
    );
  }
});

test("Ethm masks stale, missing and future pump reports instead of presenting old output as confirmed", async () => {
  assert.equal(
    (await fixture().invoke("getDeviceStatus")).reportedPumpState,
    true,
  );
  for (const pumpReportedAt of [
    undefined,
    stamp(-11000),
    stamp(1000),
    "invalid",
  ]) {
    const f = fixture({ device: { pumpReportedAt } });
    assert.equal((await f.invoke("getDeviceStatus")).reportedPumpState, null);
    assert.equal(
      (await f.invoke("listDevices", {}))[0].reportedPumpState,
      null,
    );
  }
  const f = fixture({ device: { lastSeen: stamp(-11000) } });
  assert.equal((await f.invoke("getDeviceStatus")).status, "offline");
  assert.equal((await f.invoke("listDevices", {}))[0].status, "offline");
});

test("Ethm safety explanation preserves emergency latch even after readings recover", async () => {
  const latched = await fixture({
    device: { controlMode: "emergency" },
  }).invoke("evaluateSafetyState");
  assert.equal(latched.available, true);
  assert.equal(latched.emergencyLatched, true);
  assert.equal(latched.pumpStartAllowed, false);
  assert.equal(latched.automaticFiltrationRequested, false);
  assert.match(latched.reason, /acknowledge recovery/);
  const normal = await fixture().invoke("evaluateSafetyState");
  assert.equal(normal.emergencyLatched, false);
  assert.equal(normal.pumpStartAllowed, true);
});

test("Ethm no-data state is unavailable and never falls back to demo values", async () => {
  const f = fixture({ readings: [] });
  const mode = await f.invoke("getDataMode");
  assert.equal(mode.mode, "UNKNOWN");
  assert.equal(mode.freshness, "UNAVAILABLE");
  assert.equal(mode.ageMs, null);
  assert.equal((await f.invoke("getLatestSensorReadings")).reading, null);
  assert.equal((await f.invoke("evaluateSafetyState")).pumpStartAllowed, false);
  f.tables.devices.length = 0;
  assert.equal((await f.invoke("getDataMode")).available, false);
  assert.equal((await f.invoke("getLatestSensorReadings")).reading, null);
  assert.equal((await f.invoke("evaluateSafetyState")).pumpStartAllowed, false);
});

test("Ethm historical tools exclude invalid/future samples while retaining valid stale history", async () => {
  const f = fixture({
    readings: [
      sample({ _id: "old", timestamp: stamp(-20000) }),
      sample({ _id: "middle", timestamp: stamp(-15000), tds: 400 }),
      sample({ _id: "new", timestamp: stamp(-12000), tds: 500 }),
      sample({ _id: "future", timestamp: stamp(5000) }),
      sample({ _id: "bad", ph: -1 }),
    ],
  });
  const history = await f.invoke("getRecentSensorReadings", {
    deviceId: "node-a",
    limit: 20,
  });
  assert.equal(history.count, 3);
  assert.equal(history.excludedInvalidCount, 2);
  assert.ok(
    history.readings.every((row) => row.timeBasis === "server_receipt"),
  );
  const trends = await f.invoke("analyzeSensorTrends", {
    deviceId: "node-a",
    limit: 20,
  });
  assert.equal(trends.available, true);
  assert.equal(trends.count, 3);
  assert.equal(trends.excludedInvalidCount, 2);
  assert.equal(trends.intelligence.source, "LIVE");
  assert.equal(trends.intelligence.freshness, "invalid");
  assert.equal(trends.intelligence.forecasts.ph.status, "unavailable");
});
