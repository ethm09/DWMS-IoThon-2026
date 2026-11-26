const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const build = process.env.DWMS_TEST_BUILD_DIR;
const users = require(path.join(build, "convex/users.js"));
const agent = require(path.join(build, "convex/agent.js"));
const { auth0Issuer } = require(path.join(build, "convex/auth.config.js"));

function fixture(identity, initial = []) {
  const rows = initial.map((row) => ({ ...row }));
  const ctx = {
    auth: { getUserIdentity: async () => identity },
    db: {
      query() {
        const conditions = [];
        const selected = () =>
          rows
            .filter((row) =>
              conditions.every(([key, value]) => row[key] === value),
            )
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
          unique: async () => {
            const matches = selected();
            assert.ok(matches.length <= 1);
            return matches[0] ?? null;
          },
          take: async (limit) => selected().slice(0, limit),
        };
        return query;
      },
      get: async (id) => {
        const found = rows.find((row) => row._id === id);
        return found ? { ...found } : null;
      },
      insert: async (_table, value) => {
        const id = `user:${rows.length + 1}`;
        rows.push({ _id: id, ...value });
        return id;
      },
      patch: async (id, patch) => {
        const row = rows.find((row) => row._id === id);
        assert.ok(row);
        Object.assign(row, patch);
      },
    },
  };
  return { rows, invoke: (name, args = {}) => users[name]._handler(ctx, args) };
}
const identity = (tokenIdentifier, email, emailVerified = true) => ({
  tokenIdentifier,
  email,
  emailVerified,
});
const hasCode = (code) => (error) => error.data?.code === code;
async function withOwner(email, run) {
  const previous = process.env.DWMS_INITIAL_ADMIN_EMAIL;
  if (email === undefined) delete process.env.DWMS_INITIAL_ADMIN_EMAIL;
  else process.env.DWMS_INITIAL_ADMIN_EMAIL = email;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.DWMS_INITIAL_ADMIN_EMAIL;
    else process.env.DWMS_INITIAL_ADMIN_EMAIL = previous;
  }
}

test("Auth0 issuer accepts tenant host or HTTPS issuer and rejects malformed origins", () => {
  assert.equal(
    auth0Issuer(" tenant.us.auth0.com "),
    "https://tenant.us.auth0.com/",
  );
  assert.equal(
    auth0Issuer("https://tenant.us.auth0.com/"),
    "https://tenant.us.auth0.com/",
  );
  for (const value of [
    undefined,
    "",
    "http://tenant.auth0.com",
    "https://tenant.auth0.com:443/path",
    "https://tenant.auth0.com/?x=1",
    "https://user:pass@tenant.auth0.com",
    "https://tenant.auth0.com/#token",
  ]) {
    assert.equal(auth0Issuer(value), null);
  }
});

test("registration rejects guests and never makes the first unconfigured account an administrator", async () => {
  await withOwner(undefined, async () => {
    await assert.rejects(
      fixture(null).invoke("updateCurrentUser"),
      hasCode("UNAUTHENTICATED"),
    );
    const f = fixture(identity("first", "First@Example.com"));
    await f.invoke("updateCurrentUser");
    assert.equal(f.rows[0].role, "viewer");
    assert.equal(f.rows[0].fleetAccess, false);
    assert.equal(f.rows[0].email, "first@example.com");
  });
});

test("only verified configured owner can bootstrap admin, including an existing viewer", async () => {
  await withOwner(" Owner@Example.com ", async () => {
    const unverified = fixture(
      identity("unverified", "owner@example.com", false),
    );
    await unverified.invoke("updateCurrentUser");
    assert.equal(unverified.rows[0].role, "viewer");
    const existing = fixture(identity("existing", "OWNER@example.com"), [
      {
        _id: "owner",
        tokenIdentifier: "existing",
        email: "owner@example.com",
        role: "viewer",
      },
    ]);
    await existing.invoke("updateCurrentUser");
    assert.equal(existing.rows[0].role, "admin");
    const fresh = fixture(identity("owner-token", "owner@example.com"));
    await fresh.invoke("updateCurrentUser");
    assert.equal(fresh.rows[0].role, "admin");
  });
});

test("verified email linking preserves roles and bootstraps the configured owner immediately", async () => {
  await withOwner("owner@example.com", async () => {
    const f = fixture(identity("new-token", "Owner@Example.com"), [
      {
        _id: "owner",
        tokenIdentifier: "old-token",
        email: "owner@example.com",
        role: "viewer",
      },
    ]);
    assert.equal(await f.invoke("updateCurrentUser"), "owner");
    assert.equal(f.rows.length, 1);
    assert.equal(f.rows[0].tokenIdentifier, "new-token");
    assert.equal(f.rows[0].role, "admin");
    const operator = fixture(identity("new-operator", "operator@example.com"), [
      {
        _id: "operator",
        tokenIdentifier: "old-operator",
        email: "operator@example.com",
        role: "operator",
      },
    ]);
    await operator.invoke("updateCurrentUser");
    assert.equal(operator.rows[0].role, "operator");
  });
});

test("unverified or ambiguous email cannot take over an existing account", async () => {
  const records = [
    {
      _id: "owner",
      tokenIdentifier: "old",
      email: "owner@example.com",
      role: "admin",
    },
  ];
  const unverified = fixture(
    identity("attacker", "owner@example.com", false),
    records,
  );
  await assert.rejects(
    unverified.invoke("updateCurrentUser"),
    hasCode("EMAIL_NOT_VERIFIED"),
  );
  assert.equal(unverified.rows[0].tokenIdentifier, "old");
  const ambiguous = fixture(identity("new", "owner@example.com"), [
    ...records,
    { ...records[0], _id: "duplicate", tokenIdentifier: "other" },
  ]);
  await assert.rejects(
    ambiguous.invoke("updateCurrentUser"),
    hasCode("AMBIGUOUS_IDENTITY"),
  );
});

test("role changes protect the configured owner rather than the first registered viewer", async () => {
  await withOwner("owner@example.com", async () => {
    const rows = [
      {
        _id: "first",
        tokenIdentifier: "first-token",
        email: "first@example.com",
        role: "viewer",
      },
      {
        _id: "owner",
        tokenIdentifier: "owner-token",
        email: "owner@example.com",
        role: "admin",
      },
      {
        _id: "admin",
        tokenIdentifier: "admin-token",
        email: "admin@example.com",
        role: "admin",
      },
    ];
    const f = fixture(identity("admin-token", "admin@example.com"), rows);
    await f.invoke("updateUserRole", { userId: "first", role: "operator" });
    assert.equal(f.rows[0].role, "operator");
    await assert.rejects(
      f.invoke("updateUserRole", { userId: "owner", role: "viewer" }),
      hasCode("FORBIDDEN"),
    );
    await assert.rejects(
      f.invoke("updateUserRole", { userId: "admin", role: "viewer" }),
      hasCode("BAD_REQUEST"),
    );
    await assert.rejects(
      f.invoke("updateUserRole", { userId: "missing", role: "viewer" }),
      hasCode("NOT_FOUND"),
    );
    const viewer = fixture(identity("first-token", "first@example.com"), rows);
    await assert.rejects(
      viewer.invoke("updateUserRole", { userId: "owner", role: "viewer" }),
      hasCode("FORBIDDEN"),
    );
  });
});

test("legacy assistant proposal and claim handlers cannot write hardware or revive stored proposals", async () => {
  const noBackend = new Proxy(
    {},
    {
      get() {
        throw new Error("Disabled proposal must not access backend state");
      },
    },
  );
  await assert.rejects(
    agent.setPendingAction._handler(noBackend, {
      runId: "run",
      userId: "user",
      action: {
        kind: "setPump",
        deviceId: "site-a",
        pumpOn: true,
        reason: "legacy",
        proposedAt: new Date().toISOString(),
      },
    }),
    hasCode("READ_ONLY_ASSISTANT"),
  );
  await assert.rejects(
    agent.claimPendingAction._handler(noBackend, {
      runId: "run",
      userId: "user",
    }),
    hasCode("READ_ONLY_ASSISTANT"),
  );
});

test("fleet read approval requires administrator action and can be revoked without changing viewer role", async () => {
  const rows = [
    { _id: "admin", tokenIdentifier: "admin", role: "admin" },
    { _id: "operator", tokenIdentifier: "operator", role: "operator" },
    { _id: "viewer", tokenIdentifier: "viewer", role: "viewer" },
  ];
  for (const role of ["viewer", "operator"]) {
    await assert.rejects(
      fixture(identity(role), rows).invoke("updateUserFleetAccess", {
        userId: "viewer",
        fleetAccess: true,
      }),
      hasCode("FORBIDDEN"),
    );
  }
  const f = fixture(identity("admin"), rows);
  await f.invoke("updateUserFleetAccess", {
    userId: "viewer",
    fleetAccess: true,
  });
  assert.equal(users.hasFleetAccess(f.rows[2]), true);
  assert.equal(f.rows[2].role, "viewer");
  await f.invoke("updateUserFleetAccess", {
    userId: "viewer",
    fleetAccess: false,
  });
  assert.equal(users.hasFleetAccess(f.rows[2]), false);
  assert.equal(users.hasFleetAccess({ role: "viewer" }), false);
  assert.equal(
    users.hasFleetAccess({ role: "operator", fleetAccess: false }),
    true,
  );
  await assert.rejects(
    f.invoke("updateUserFleetAccess", {
      userId: "operator",
      fleetAccess: false,
    }),
    hasCode("BAD_REQUEST"),
  );
});
