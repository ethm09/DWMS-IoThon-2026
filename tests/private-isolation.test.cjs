const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const build = process.env.DWMS_TEST_BUILD_DIR;
const chat = require(path.join(build, "convex/chat.js"));
const notifications = require(path.join(build, "convex/notifications.js"));
const agent = require(path.join(build, "convex/agent.js"));
const agentTools = require(path.join(build, "convex/agentTools.js"));
const denied = (error) => ["NOT_FOUND", "FORBIDDEN"].includes(error.data?.code);

function fixture() {
  const tables = {
    users: [
      {
        _id: "user:a",
        tokenIdentifier: "a",
        role: "viewer",
        fleetAccess: true,
      },
      {
        _id: "user:b",
        tokenIdentifier: "b",
        role: "viewer",
        fleetAccess: true,
      },
    ],
    chatMessages: [
      { _id: "chat:a", userId: "user:a", content: "Private A", role: "user" },
      { _id: "chat:b", userId: "user:b", content: "Private B", role: "user" },
    ],
    notifications: [
      { _id: "notice:a", userId: "user:a", read: false, dismissed: false },
      { _id: "notice:b", userId: "user:b", read: false, dismissed: false },
    ],
    agentRuns: [
      {
        _id: "run:a",
        userId: "user:a",
        status: "completed",
        objective: "Private A",
      },
      {
        _id: "run:b",
        userId: "user:b",
        status: "running",
        objective: "Private B",
      },
    ],
    agentRunEvents: [
      { _id: "event:a", runId: "run:a", userId: "user:a" },
      { _id: "event:b", runId: "run:b", userId: "user:b" },
    ],
  };
  const ctx = {
    auth: { getUserIdentity: async () => ({ tokenIdentifier: "a" }) },
    db: {
      query(table) {
        const filters = [];
        const result = () =>
          tables[table]
            .filter((row) =>
              filters.every(([key, value]) => row[key] === value),
            )
            .map((row) => ({ ...row }));
        const query = {
          withIndex(_name, callback) {
            const range = {
              eq(key, value) {
                filters.push([key, value]);
                return range;
              },
            };
            callback(range);
            return query;
          },
          order() {
            return query;
          },
          unique: async () => {
            const rows = result();
            assert.ok(rows.length <= 1);
            return rows[0] ?? null;
          },
          take: async (limit) => result().slice(0, limit),
          collect: async () => result(),
        };
        return query;
      },
      get: async (id) => {
        const row = Object.values(tables)
          .flat()
          .find((item) => item._id === id);
        return row ? { ...row } : null;
      },
      patch: async (id, patch) => {
        const row = Object.values(tables)
          .flat()
          .find((item) => item._id === id);
        assert.ok(row);
        Object.assign(row, patch);
      },
      delete: async (id) => {
        for (const rows of Object.values(tables)) {
          const index = rows.findIndex((row) => row._id === id);
          if (index >= 0) rows.splice(index, 1);
        }
      },
    },
  };
  return { tables, ctx };
}

test("private chat and notifications are scoped to the authenticated user, including bulk changes", async () => {
  const { tables, ctx } = fixture();
  assert.deepEqual(
    (await chat.getMessages._handler(ctx, {})).map((item) => item._id),
    ["chat:a"],
  );
  assert.deepEqual(
    (await notifications.list._handler(ctx, {})).map((item) => item._id),
    ["notice:a"],
  );
  for (const fn of [notifications.markAsRead, notifications.dismiss]) {
    await assert.rejects(
      fn._handler(ctx, { notificationId: "notice:b" }),
      denied,
    );
  }
  await notifications.markAllAsRead._handler(ctx, {});
  assert.equal(tables.notifications[0].read, true);
  assert.equal(tables.notifications[1].read, false);
  await chat.clearHistory._handler(ctx, {});
  assert.deepEqual(
    tables.chatMessages.map((item) => item._id),
    ["chat:b"],
  );
});

test("assistant runs and tool notifications cannot be read across accounts", async () => {
  const { ctx } = fixture();
  assert.equal(
    (await agent.getRun._handler(ctx, { runId: "run:a" })).objective,
    "Private A",
  );
  for (const fn of [
    agent.getRun,
    agent.getRunEvents,
    agent.cancelPendingAction,
  ]) {
    await assert.rejects(fn._handler(ctx, { runId: "run:b" }), denied);
  }
  await assert.rejects(
    agent.getRunForExecution._handler(ctx, {
      runId: "run:b",
      tokenIdentifier: "b",
    }),
    denied,
  );
  await assert.rejects(
    agentTools.getActiveAlerts._handler(ctx, { userId: "user:b" }),
    denied,
  );
  await assert.rejects(
    agentTools.getRecentAlerts._handler(ctx, { userId: "user:b", limit: 10 }),
    denied,
  );
});

test("registered viewers without fleet approval cannot read assistant live-data tools or execute a run", async () => {
  const { tables, ctx } = fixture();
  tables.users[0].fleetAccess = false;
  await assert.rejects(agentTools.listDevices._handler(ctx, {}), denied);
  await assert.rejects(
    agentTools.getLatestSensorReadings._handler(ctx, { deviceId: "site-a" }),
    denied,
  );
  await assert.rejects(
    agent.getRunForExecution._handler(ctx, {
      runId: "run:a",
      tokenIdentifier: "a",
    }),
    denied,
  );
  // Private records remain personal history rather than becoming shared fleet data.
  assert.deepEqual(
    (await chat.getMessages._handler(ctx, {})).map((item) => item._id),
    ["chat:a"],
  );
});
