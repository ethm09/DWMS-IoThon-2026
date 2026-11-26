const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const build = process.env.DWMS_TEST_BUILD_DIR;
assert.ok(build, "Run using pnpm test so TypeScript is compiled first");
const devices = require(path.join(build, "convex/devices.js"));
const policy = require(path.join(build, "convex/safetyPolicy.js"));
const safety = require(path.join(build, "src/lib/dwms-safety.js"));
const analysis = require(path.join(build, "convex/agentAnalysis.js"));
const http = require(path.join(build, "convex/http.js")).default;
const { getFunctionName } = require("convex/server");

const healthy = { ph: 7.2, tds: 200, turbidity: 2 };
const stamp = (offset = 0) => new Date(Date.now() + offset).toISOString();

// An in-memory transaction adapter exercises the actual registered handlers.
// It does not replace a deployed Convex integration or physical controller test.
function fixture({
  role = "operator",
  authenticated = true,
  ...deviceOverrides
} = {}) {
  const tables = {
    devices: [
      {
        _id: "device:1",
        _creationTime: 1,
        deviceId: "site-a",
        name: "Reservoir inlet",
        apiKey: "test-only-device-key",
        status: "online",
        lastSeen: stamp(),
        controlMode: "auto",
        desiredPumpState: false,
        ...deviceOverrides,
      },
    ],
    deviceCommands: [],
    sensorReadings: [],
    notifications: [],
    users: [
      { _id: "user:1", _creationTime: 1, tokenIdentifier: "test-user", role },
    ],
  };
  const scheduled = [];
  let creationTime = Date.now();
  const ctx = {
    auth: {
      getUserIdentity: async () =>
        authenticated ? { tokenIdentifier: "test-user" } : null,
    },
    scheduler: {
      runAfter: async (delay, fn, args) => {
        scheduled.push({ delay, fn: getFunctionName(fn), args });
      },
    },
    db: {
      query(table) {
        const conditions = [];
        let direction = "asc";
        const results = () =>
          [...tables[table]]
            .filter((row) =>
              conditions.every(([key, value]) => row[key] === value),
            )
            .sort((a, b) => {
              const left = a.timestamp ?? a.createdAt ?? a._creationTime;
              const right = b.timestamp ?? b.createdAt ?? b._creationTime;
              // Convex indexes append _creationTime as their final field.
              // Multiple writes can have identical ISO millisecond timestamps.
              const order = left < right ? -1 : left > right ? 1
                : (a._creationTime ?? 0) - (b._creationTime ?? 0);
              return (
                order *
                (direction === "desc" ? -1 : 1)
              );
            })
            .map((row) => ({ ...row }));
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
          order(order) {
            direction = order;
            return query;
          },
          unique: async () => {
            const rows = results();
            assert.ok(rows.length <= 1);
            return rows[0] ?? null;
          },
          first: async () => results()[0] ?? null,
          take: async (limit) => results().slice(0, limit),
          collect: async () => results(),
        };
        return query;
      },
      async insert(table, value) {
        const id = `${table}:${tables[table].length + 1}`;
        creationTime = Math.max(Date.now(), creationTime + 0.001);
        tables[table].push({ _id: id, _creationTime: creationTime, ...value });
        return id;
      },
      async patch(id, patch) {
        const row = Object.values(tables)
          .flat()
          .find((item) => item._id === id);
        assert.ok(row, `Missing document ${id}`);
        Object.assign(row, patch);
      },
    },
  };
  const invoke = (name, args) => devices[name]._handler(ctx, args);
  const ingest = (values) =>
    invoke("internalSaveReading", { deviceId: "site-a", ...values });
  const request = async (
    endpoint,
    body,
    { key = "test-only-device-key", deviceId = "site-a", raw = false } = {},
  ) => {
    const actionCtx = {
      runQuery: (fn, args) => invoke(getFunctionName(fn).split(":")[1], args),
      runMutation: (fn, args) =>
        invoke(getFunctionName(fn).split(":")[1], args),
    };
    const [handler] = http.lookup(endpoint, "POST");
    return handler._handler(
      actionCtx,
      new Request(`https://test.invalid${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": key,
          "X-Device-ID": deviceId,
        },
        body: raw ? body : JSON.stringify(body),
      }),
    );
  };
  return { tables, scheduled, invoke, ingest, request };
}

test("threshold boundaries and one automatic response agree across UI and backend", () => {
  assert.equal(policy.classifyPh(5.5), "warning");
  assert.equal(policy.classifyPh(6.5), "safe");
  assert.equal(policy.classifyPh(8.5), "safe");
  assert.equal(policy.classifyPh(10), "warning");
  assert.equal(policy.classifyTds(499.9), "safe");
  assert.equal(policy.classifyTds(500), "warning");
  assert.equal(policy.classifyTds(1500), "warning");
  assert.equal(policy.classifyTurbidity(5), "warning");
  assert.equal(policy.classifyTurbidity(50), "warning");
  for (const sample of [
    { ...healthy, ph: 5.4 },
    { ...healthy, turbidity: 51 },
  ]) {
    assert.deepEqual(policy.automaticPumpTarget(sample), {
      mode: "emergency",
      pumpOn: false,
    });
    assert.equal(safety.evaluateState(sample).kind, "emergency");
  }
  const elevated = { ...healthy, tds: 1501 };
  assert.deepEqual(policy.automaticPumpTarget(elevated), {
    mode: "auto",
    pumpOn: true,
  });
  assert.equal(safety.evaluateState(elevated).startFiltration, true);
  assert.equal(safety.evaluateChange("tds", elevated.tds).kind, "correction");
  assert.equal(safety.evaluateChange("turbidity", 51).kind, "emergency");
});

test("partial, disconnected and invalid samples never become a healthy overall status", () => {
  for (const sample of [
    {},
    { ph: 7 },
    { ...healthy, turbidity: null },
    { ...healthy, ph: NaN },
    { ...healthy, tds: -1 },
    { ...healthy, turbidity: Infinity },
  ]) {
    assert.equal(policy.isValidSensorValues(sample), false);
    assert.equal(safety.overallQuality(sample), "unknown");
    assert.equal(safety.evaluateState(sample).riskLevel, "unknown");
  }
  assert.equal(safety.overallQuality(healthy), "safe");
});

test("strict freshness rejects stale, invalid and future timestamps", () => {
  const now = Date.now();
  assert.equal(
    policy.isFreshTimestamp(new Date(now - 10000).toISOString(), now),
    true,
  );
  for (const timestamp of [
    undefined,
    "bad-date",
    new Date(now - 10001).toISOString(),
    new Date(now + 1).toISOString(),
  ]) {
    assert.equal(policy.isFreshTimestamp(timestamp, now), false);
    assert.equal(
      analysis.evaluateSafetyState({ ...healthy, timestamp }, now)
        .pumpStartAllowed,
      false,
    );
  }
});

test("HTTP ingestion authenticates device and rejects malformed or disconnected sensors before writing", async () => {
  const f = fixture();
  assert.equal(
    (await f.request("/arduino/data", healthy, { key: "" })).status,
    401,
  );
  assert.equal(
    (await f.request("/arduino/data", healthy, { key: "wrong" })).status,
    403,
  );
  assert.equal(
    (await f.request("/arduino/data", healthy, { deviceId: "other-site" }))
      .status,
    403,
  );
  for (const value of [
    {},
    { ph: 7, tds: 200 },
    { ...healthy, ph: "7" },
    { ...healthy, ph: 15 },
    { ...healthy, tds: -1 },
    { ...healthy, turbidity: null },
    null,
    [],
  ]) {
    assert.equal((await f.request("/arduino/data", value)).status, 400);
  }
  assert.equal(
    (await f.request("/arduino/data", "{broken", { raw: true })).status,
    400,
  );
  assert.equal(f.tables.sensorReadings.length, 0);
  assert.equal((await f.request("/arduino/data", healthy)).status, 200);
  assert.equal(f.tables.sensorReadings.length, 1);
  assert.equal(f.tables.devices[0].status, "online");
  assert.ok(
    f.scheduled.some(
      (item) => item.fn === "devices:checkDeviceStale" && item.delay === 10000,
    ),
  );
});

test("internal ingestion validates too and never saves to an unregistered site", async () => {
  const f = fixture();
  await assert.rejects(f.ingest({ ...healthy, ph: NaN }));
  await assert.rejects(
    f.invoke("internalSaveReading", { deviceId: "missing", ...healthy }),
  );
  assert.equal(f.tables.sensorReadings.length, 0);
});

test("critical sample stops manual pump, latches emergency and needs safe explicit acknowledgement", async () => {
  const f = fixture({
    controlMode: "manual",
    desiredPumpState: true,
    reportedPumpState: true,
    pumpReportedAt: stamp(),
  });
  await f.ingest({ ...healthy, turbidity: 51 });
  assert.equal(f.tables.devices[0].controlMode, "emergency");
  assert.equal(f.tables.deviceCommands[0].pumpOn, false);
  await assert.rejects(
    f.invoke("acknowledgeDeviceEmergency", { deviceId: "site-a" }),
  );
  await assert.rejects(
    f.invoke("setDeviceControlMode", { deviceId: "site-a", mode: "manual" }),
  );
  await f.ingest(healthy);
  assert.equal(f.tables.devices[0].controlMode, "emergency");
  await f.invoke("acknowledgeDeviceEmergency", { deviceId: "site-a" });
  assert.equal(f.tables.devices[0].controlMode, "auto");
});

test("automatic command retries after expiration and reconciles controller reset without duplicate pending commands", async () => {
  const f = fixture();
  const values = { ...healthy, turbidity: 25 };
  await f.ingest(values);
  const first = f.tables.deviceCommands[0];
  assert.equal(first.pumpOn, true);
  await f.ingest(values);
  assert.equal(f.tables.deviceCommands.length, 1);
  await f.invoke("expireControlCommand", { commandId: first.commandId });
  await f.ingest(values);
  assert.equal(f.tables.deviceCommands.length, 2);
  const second = f.tables.deviceCommands[1];
  await f.invoke("acknowledgeControlCommand", {
    deviceId: "site-a",
    commandId: second.commandId,
    ok: true,
    pumpOn: true,
  });
  await f.ingest(values);
  assert.equal(f.tables.deviceCommands.length, 2);
  await f.invoke("reportPumpStatus", { deviceId: "site-a", pumpOn: false });
  await f.ingest(values);
  assert.equal(f.tables.deviceCommands.length, 3);
});

test("stale callback ignores older sample schedules and requests a latched stop for the current sample", async () => {
  const f = fixture({ desiredPumpState: true, reportedPumpState: true });
  await f.invoke("checkDeviceStale", {
    deviceId: "site-a",
    expectedLastSeen: "old-sample",
  });
  assert.equal(f.tables.devices[0].status, "online");
  await f.invoke("checkDeviceStale", {
    deviceId: "site-a",
    expectedLastSeen: f.tables.devices[0].lastSeen,
  });
  assert.equal(f.tables.devices[0].status, "offline");
  assert.equal(f.tables.devices[0].controlMode, "emergency");
  assert.equal(f.tables.devices[0].desiredPumpState, false);
  assert.equal(f.tables.deviceCommands.at(-1).pumpOn, false);
  assert.equal(f.tables.devices[0].reportedPumpState, undefined);
});

test("controller watchdog lock propagates into backend and supersedes pending start", async () => {
  const f = fixture();
  await f.ingest({ ...healthy, tds: 1600 });
  assert.equal(
    (
      await f.request("/arduino/control/status", {
        pumpOn: false,
        emergencyLock: true,
      })
    ).status,
    200,
  );
  assert.equal(f.tables.devices[0].controlMode, "emergency");
  assert.equal(f.tables.deviceCommands[0].status, "superseded");
  assert.deepEqual(
    await f.invoke("acknowledgeControlCommand", {
      deviceId: "site-a",
      commandId: f.tables.deviceCommands[0].commandId,
      ok: true,
      pumpOn: true,
    }),
    { accepted: false },
  );
  assert.equal(f.tables.deviceCommands.at(-1).pumpOn, false);
});

test("acknowledgements reject wrong devices, mismatched output and late commands", async () => {
  const f = fixture();
  await f.ingest({ ...healthy, turbidity: 25 });
  const command = f.tables.deviceCommands[0];
  assert.deepEqual(
    await f.invoke("acknowledgeControlCommand", {
      deviceId: "wrong",
      commandId: command.commandId,
      ok: true,
      pumpOn: true,
    }),
    { accepted: false },
  );
  assert.deepEqual(
    await f.invoke("acknowledgeControlCommand", {
      deviceId: "site-a",
      commandId: command.commandId,
      ok: true,
      pumpOn: false,
    }),
    { accepted: false },
  );
  assert.equal(command.status, "failed");
  await f.ingest({ ...healthy, turbidity: 25 });
  const late = f.tables.deviceCommands.at(-1);
  late.createdAt = stamp(-21000);
  assert.deepEqual(
    await f.invoke("acknowledgeControlCommand", {
      deviceId: "site-a",
      commandId: late.commandId,
      ok: true,
      pumpOn: true,
    }),
    { accepted: false },
  );
  assert.equal(late.status, "expired");
});

test("stale start commands are not delivered and pump controls enforce roles and freshness", async () => {
  const f = fixture({ controlMode: "manual" });
  await f.ingest(healthy);
  f.tables.sensorReadings[0].timestamp = stamp(-11000);
  await assert.rejects(
    f.invoke("setDevicePump", { deviceId: "site-a", pumpOn: true }),
  );
  f.tables.sensorReadings[0].timestamp = stamp(1000);
  await assert.rejects(
    f.invoke("setDevicePump", { deviceId: "site-a", pumpOn: true }),
  );
  f.tables.sensorReadings[0].timestamp = stamp();
  f.tables.devices[0].status = "offline";
  await assert.rejects(
    f.invoke("setDevicePump", { deviceId: "site-a", pumpOn: true }),
  );
  // OFF remains available even without fresh sensors.
  await f.invoke("setDevicePump", { deviceId: "site-a", pumpOn: false });
  for (const options of [{ role: "viewer" }, { authenticated: false }]) {
    await assert.rejects(
      fixture(options).invoke("setDeviceControlMode", {
        deviceId: "site-a",
        mode: "emergency",
      }),
    );
  }
  const auto = fixture();
  await auto.ingest({ ...healthy, tds: 1600 });
  auto.tables.devices[0].lastSeen = stamp(-11000);
  assert.equal(
    await auto.invoke("getPendingControlCommand", { deviceId: "site-a" }),
    null,
  );
});

test("device query redacts credentials and history is capped and isolated by site", async () => {
  const f = fixture();
  assert.equal((await f.invoke("listDevices", {}))[0].apiKey, undefined);
  for (let i = 0; i < 250; i++)
    f.tables.sensorReadings.push({
      _id: `r:${i}`,
      deviceId: "site-a",
      timestamp: new Date(i).toISOString(),
      ...healthy,
    });
  f.tables.sensorReadings.push({
    _id: "other",
    deviceId: "other-site",
    timestamp: stamp(),
    ...healthy,
  });
  const readings = await f.invoke("getRecentReadings", {
    deviceId: "site-a",
    limit: 100000,
  });
  assert.equal(readings.length, 200);
  assert.ok(readings.every((row) => row.deviceId === "site-a"));
  assert.equal(
    (await f.invoke("getRecentReadings", { deviceId: "site-a", limit: -1 }))
      .length,
    1,
  );
});

test("only explicit emergency acknowledgement authorizes local latch reset and survives pre-delivery status", async () => {
  const f = fixture();
  await f.ingest({ ...healthy, tds: 1600 });
  assert.equal(f.tables.deviceCommands[0].clearEmergency, false);
  assert.equal(
    (await f.invoke("getPendingControlCommand", { deviceId: "site-a" }))
      .clearEmergency,
    false,
  );
  await f.invoke("reportPumpStatus", {
    deviceId: "site-a",
    pumpOn: false,
    emergencyLock: true,
  });
  await f.invoke("acknowledgeDeviceEmergency", { deviceId: "site-a" });
  const reset = f.tables.deviceCommands.at(-1);
  assert.equal(reset.clearEmergency, true);
  assert.equal(
    (await f.invoke("getPendingControlCommand", { deviceId: "site-a" }))
      .clearEmergency,
    true,
  );
  await f.invoke("reportPumpStatus", {
    deviceId: "site-a",
    pumpOn: false,
    emergencyLock: true,
  });
  assert.equal(reset.status, "pending");
  assert.equal(f.tables.devices[0].controlMode, "auto");
  reset.createdAt = stamp(-21000);
  await f.invoke("reportPumpStatus", {
    deviceId: "site-a",
    pumpOn: false,
    emergencyLock: true,
  });
  assert.equal(f.tables.devices[0].controlMode, "emergency");
  assert.equal(f.tables.deviceCommands.at(-1).clearEmergency, false);
});

test("readings with the same receipt millisecond use creation order, matching Convex indexes", async () => {
  const f = fixture();
  const timestamp = stamp();
  f.tables.sensorReadings.push(
    { _id: "older", _creationTime: 100, deviceId: "site-a", timestamp, ...healthy, ph: 4 },
    { _id: "newer", _creationTime: 100.001, deviceId: "site-a", timestamp, ...healthy },
  );
  const latest = await f.invoke("getLatestReading", { deviceId: "site-a" });
  assert.equal(latest._id, "newer");
  const recent = await f.invoke("getRecentReadings", { deviceId: "site-a", limit: 2 });
  assert.deepEqual(recent.map(row => row._id), ["newer", "older"]);
});
