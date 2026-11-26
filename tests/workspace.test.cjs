const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { workspacePath } = require(
  path.join(process.env.DWMS_TEST_BUILD_DIR, "src/lib/workspace.js"),
);

test("guest navigation keeps operational links in the demo namespace", () => {
  for (const current of ["/", "/demo", "/demo/alerts", "/dashboard"]) {
    assert.equal(workspacePath("/dashboard", current), "/demo");
    assert.equal(workspacePath("/historical", current), "/demo/trends");
    assert.equal(workspacePath("/remote-monitoring", current), "/demo/sites");
    assert.equal(workspacePath("/devices", current), "/demo/devices");
    assert.equal(workspacePath("/dashboard#process", current), "/demo#process");
  }
});

test("live navigation stays scoped and preserves complete query and hash suffixes", () => {
  for (const current of ["/live", "/live/sites", "/live/connection"]) {
    assert.equal(workspacePath("/dashboard", current), "/live");
    assert.equal(workspacePath("/thresholds", current), "/live/rules");
    assert.equal(workspacePath("/admin", current), "/live/access");
    assert.equal(workspacePath("/ai-decision", current), "/live/assistant");
    assert.equal(
      workspacePath("/historical?range=recent#chart", current),
      "/live/trends?range=recent#chart",
    );
    assert.equal(workspacePath("/dashboard#process", current), "/live#process");
  }
  assert.equal(
    workspacePath("/alerts", "/lively"),
    "/demo/alerts",
    "Only the canonical /live workspace selects operational links",
  );
});

test("auth callbacks, external URLs and explicit workspace destinations stay unchanged", () => {
  for (const current of ["/demo", "/live/sites"]) {
    for (const target of [
      "/auth/callback?code=example#state",
      "https://example.org/alerts?x=1#top",
      "mailto:team@example.org",
      "/demo/alerts",
      "/live",
      "/live/alerts",
      "#process",
    ]) {
      assert.equal(workspacePath(target, current), target);
    }
  }
});
