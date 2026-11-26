import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

// Real HTTP/database/reactive-query integration with deliberate synthetic data.
// No production fixture functions or Auth0 bypass are added to the application.
// A temporary anonymous deployment is destroyed on completion, including errors.
const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = await realpath(tmpdir());
const project = await mkdtemp(join(temporaryRoot, "dwms-e2e-"));
const cli = join(repository, "node_modules", "convex", "bin", "main.js");
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !/^(CONVEX_|VITE_|AUTH0_|DWMS_|OPENAI_API_KEY$)/.test(key),
  ),
);
env.CONVEX_AGENT_MODE = "anonymous";
env.VERCEL = "";
env.NO_COLOR = "1";
let backend;
let publicClient;
let operatorClient;
let logs = "";
let config;
let cloudUrl;
let siteUrl;
const checks = [];

function passed(message) {
  checks.push(message);
  console.log(`PASS ${message}`);
}
const delay = (milliseconds) =>
  new Promise((done) => setTimeout(done, milliseconds));
async function until(predicate, message, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    if (backend && backend.exitCode !== null)
      throw new Error("Isolated backend stopped before validation completed");
    try {
      if (await predicate()) return;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(
    `Timed out: ${message}${lastError ? ` (${lastError.message})` : ""}`,
  );
}
async function freePort() {
  const server = createServer();
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}
function child(args, options = {}) {
  return spawn(process.execPath, [cli, ...args], {
    cwd: project,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}
async function command(args) {
  const processHandle = child(args);
  let output = "";
  processHandle.stdout.on("data", (chunk) => {
    output += chunk;
  });
  processHandle.stderr.on("data", (chunk) => {
    output += chunk;
  });
  const status = await new Promise((done, reject) => {
    processHandle.once("error", reject);
    processHandle.once("exit", done);
  });
  if (status !== 0)
    throw new Error(
      `Local Convex ${args[0]} failed (${status}): ${output.slice(-2000)}`,
    );
  return output;
}
async function guardLocalWrites() {
  assert.equal(await realpath(project), project);
  assert.ok(project.startsWith(join(temporaryRoot, "dwms-e2e-")));
  const statePath = join(project, ".convex", "local", "default", "config.json");
  assert.equal(await realpath(statePath), statePath);
  const localConfig = JSON.parse(await readFile(statePath, "utf8"));
  assert.ok(localConfig.deploymentName.startsWith("anonymous-"));
  const localEnv = await readFile(join(project, ".env.local"), "utf8");
  assert.match(localEnv, /^CONVEX_DEPLOYMENT=anonymous:/m);
  for (const [url, port] of [
    [cloudUrl, localConfig.ports.cloud],
    [siteUrl, localConfig.ports.site],
  ]) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, "http:");
    assert.equal(parsed.hostname, "127.0.0.1");
    assert.equal(parsed.port, String(port));
  }
  config = localConfig;
}
async function importFixture(table, documents) {
  await guardLocalWrites();
  const filename = join(project, `${table}.json`);
  await writeFile(filename, JSON.stringify(documents));
  await command(["import", "--table", table, "--append", "--yes", filename]);
}
const deviceId = "SIMULATED-HTTP-DEMO";
const staleId = "SIMULATED-STALE-DEMO";
const syntheticKey = "local-synthetic-device-key-no-hardware";
async function post(
  path,
  body,
  id = deviceId,
  key = syntheticKey,
  expected = 200,
) {
  await guardLocalWrites();
  const response = await fetch(`${siteUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Device-ID": id,
      "X-API-Key": key,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  assert.equal(response.status, expected, `${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}
async function acknowledge(commandResult, id = deviceId) {
  assert.ok(commandResult?.commandId);
  // Deliberate software-only ACK: this never opens a serial port or drives a relay.
  await post(
    "/arduino/control/ack",
    {
      commandId: commandResult.commandId,
      ok: true,
      pumpOn: commandResult.pumpOn,
      message: "SIMULATED ACK for isolated HTTP integration test; no hardware",
    },
    id,
  );
}
async function next(id = deviceId) {
  const state = await publicClient.query(api.devices.getControlState, {
    deviceId: id,
  });
  assert.equal(state.command?.status, "pending");
  return await post("/arduino/control/next", {}, id);
}

console.log(
  "DWMS synthetic HTTP integration: isolated local Convex; no probes, Auth0 login or relay actuation.",
);
try {
  await cp(join(repository, "convex"), join(project, "convex"), {
    recursive: true,
  });
  for (const file of ["package.json", "convex.json", "tsconfig.json"])
    await cp(join(repository, file), join(project, file));
  await symlink(
    join(repository, "node_modules"),
    join(project, "node_modules"),
    "dir",
  );
  // The source checkout is never edited; empty providers apply only to the disposable copy.
  await writeFile(
    join(project, "convex", "auth.config.ts"),
    "export default { providers: [] };\n",
  );
  await writeFile(
    join(project, ".gitignore"),
    ".env*\n.convex/\nnode_modules/\n",
  );
  const cloudPort = await freePort();
  let sitePort = await freePort();
  while (sitePort === cloudPort) sitePort = await freePort();
  cloudUrl = `http://127.0.0.1:${cloudPort}`;
  siteUrl = `http://127.0.0.1:${sitePort}`;
  // `dev` initializes this anonymous project, deploys the copied functions and keeps it running.
  backend = child(
    [
      "dev",
      "--local",
      "--local-cloud-port",
      String(cloudPort),
      "--local-site-port",
      String(sitePort),
      "--tail-logs",
      "disable",
      "--typecheck",
      "enable",
    ],
    { detached: true },
  );
  backend.stdout.on("data", (chunk) => {
    logs = (logs + chunk).slice(-20_000);
  });
  backend.stderr.on("data", (chunk) => {
    logs = (logs + chunk).slice(-20_000);
  });
  backend.on("error", (error) => {
    logs += error.message;
  });
  publicClient = new ConvexClient(cloudUrl, { logger: false });
  await until(
    async () => {
      if (!logs.includes("Convex functions ready")) return false;
      await guardLocalWrites();
      const response = await fetch(`${cloudUrl}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "devices:listDevices",
          args: {},
          format: "json",
        }),
        signal: AbortSignal.timeout(1000),
      });
      const data = await response.json();
      return response.ok && data.status === "success";
    },
    "deploying copied production functions",
    90_000,
  );
  passed(
    "copied production HTTP/functions/schema running in a disposable loopback deployment",
  );

  const identity = {
    issuer: "https://dwms-e2e.invalid",
    subject: "synthetic-operator",
    tokenIdentifier: "https://dwms-e2e.invalid|synthetic-operator",
    name: "SIMULATED TEST OPERATOR",
  };
  await importFixture("users", [
    {
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name,
      role: "operator",
    },
  ]);
  await importFixture(
    "devices",
    [deviceId, staleId].map((id) => ({
      deviceId: id,
      name: id,
      location: "SYNTHETIC LOCAL TEST ONLY",
      apiKey: id === deviceId ? syntheticKey : `${syntheticKey}-stale`,
      status: "offline",
    })),
  );
  operatorClient = new ConvexClient(cloudUrl, { logger: false });
  operatorClient.setAdminAuth(config.adminKey, identity);
  const observations = [];
  const unsubscribe = publicClient.onUpdate(
    api.devices.getLatestReading,
    { deviceId },
    (value) => observations.push(value),
  );
  await until(() => observations.length > 0, "initial reactive query");
  assert.equal(observations[0], null);
  await assert.rejects(
    publicClient.mutation(api.devices.setDevicePump, {
      deviceId,
      pumpOn: true,
    }),
  );
  await post(
    "/arduino/data",
    { ph: 7.2, tds: 300, turbidity: 2 },
    deviceId,
    "wrong-synthetic-key",
    403,
  );
  await post("/arduino/data", "{malformed", deviceId, syntheticKey, 400);
  await post(
    "/arduino/data",
    { ph: true, tds: 300, turbidity: 2 },
    deviceId,
    syntheticKey,
    400,
  );
  await post(
    "/arduino/data",
    { ph: 7.2, tds: 300 },
    deviceId,
    syntheticKey,
    400,
  );
  assert.equal(
    await publicClient.query(api.devices.getLatestReading, { deviceId }),
    null,
  );
  passed(
    "real HTTP rejects malformed/missing/boolean readings and wrong credentials; unauthenticated control rejected",
  );

  async function sample(reading) {
    await post("/arduino/data", reading);
    await until(
      () =>
        observations.some(
          (value) =>
            value?.ph === reading.ph &&
            value?.tds === reading.tds &&
            value?.turbidity === reading.turbidity,
        ),
      "reactive subscriber receiving HTTP sample",
    );
    const stored = await publicClient.query(api.devices.getLatestReading, {
      deviceId,
    });
    assert.deepEqual(
      { ph: stored.ph, tds: stored.tds, turbidity: stored.turbidity },
      reading,
    );
  }
  await sample({ ph: 7.2, tds: 300, turbidity: 2 });
  await acknowledge(await next());
  passed(
    "normal HTTP sample persisted and delivered over the actual reactive query transport",
  );
  await sample({ ph: 7.2, tds: 650, turbidity: 8 });
  const warnings = await operatorClient.query(api.notifications.list, {
    limit: 50,
  });
  assert.ok(
    warnings.some(
      (item) =>
        item.level === "warning" &&
        item.parameter === "TDS" &&
        item.message.includes(deviceId),
    ),
  );
  assert.ok(
    warnings.some(
      (item) => item.level === "warning" && item.parameter === "Turbidity",
    ),
  );
  passed(
    "warning samples created persisted threshold notifications for the synthetic operator",
  );
  await sample({ ph: 7.2, tds: 300, turbidity: 25 });
  const responseCommand = await next();
  assert.equal(responseCommand.pumpOn, true);
  assert.equal(responseCommand.mode, "auto");
  await acknowledge(responseCommand);
  assert.equal(
    (await publicClient.query(api.devices.getControlState, { deviceId }))
      .command.status,
    "applied",
  );
  passed(
    "response threshold issued Auto ON; deliberately simulated ACK became applied (no actuation)",
  );
  await sample({ ph: 4.5, tds: 300, turbidity: 2 });
  const emergency = await next();
  assert.equal(emergency.pumpOn, false);
  assert.equal(emergency.mode, "emergency");
  await acknowledge(emergency);
  const alerts = await operatorClient.query(api.notifications.list, {
    limit: 50,
  });
  assert.ok(
    alerts.some((item) => item.level === "critical" && item.parameter === "pH"),
  );
  passed(
    "critical pH persisted an alert and latched Emergency OFF through the real command endpoint",
  );
  await sample({ ph: 7.3, tds: 301, turbidity: 2.1 });
  assert.equal(
    (await publicClient.query(api.devices.getControlState, { deviceId })).mode,
    "emergency",
  );
  await assert.rejects(
    operatorClient.mutation(api.devices.setDeviceControlMode, {
      deviceId,
      mode: "auto",
    }),
  );
  await operatorClient.mutation(api.devices.acknowledgeDeviceEmergency, {
    deviceId,
  });
  const recovery = await next();
  assert.equal(recovery.pumpOn, false);
  assert.equal(recovery.clearEmergency, true);
  await acknowledge(recovery);
  assert.equal(
    (await publicClient.query(api.devices.getControlState, { deviceId })).mode,
    "auto",
  );
  passed(
    "recovered readings preserved latch; explicit synthetic-operator acknowledgement cleared it",
  );
  const history = await publicClient.query(api.devices.getRecentReadings, {
    deviceId,
    limit: 200,
  });
  assert.equal(history.length, 5);
  assert.ok(observations.filter(Boolean).length >= 5);
  passed(
    "five synthetic HTTP samples retained in indexed history and observed reactively",
  );

  // Separate node proves scheduled connectivity-loss behavior without changing clocks or production handlers.
  await post(
    "/arduino/data",
    { ph: 7.2, tds: 300, turbidity: 25 },
    staleId,
    `${syntheticKey}-stale`,
  );
  const stalePending = await post(
    "/arduino/control/next",
    {},
    staleId,
    `${syntheticKey}-stale`,
  );
  assert.equal(stalePending.pumpOn, true);
  await post(
    "/arduino/control/ack",
    {
      commandId: stalePending.commandId,
      ok: true,
      pumpOn: true,
      message: "SIMULATED ACK; no hardware",
    },
    staleId,
    `${syntheticKey}-stale`,
  );
  await until(
    async () => {
      const state = await publicClient.query(api.devices.getControlState, {
        deviceId: staleId,
      });
      const devices = await publicClient.query(api.devices.listDevices, {});
      return (
        devices.find((device) => device.deviceId === staleId)?.status ===
          "offline" &&
        state.mode === "emergency" &&
        state.desiredPumpState === false &&
        state.reportedPumpState === null
      );
    },
    "actual scheduled stale-data stop request",
    18_000,
  );
  const staleStop = await post(
    "/arduino/control/next",
    {},
    staleId,
    `${syntheticKey}-stale`,
  );
  assert.equal(staleStop.pumpOn, false);
  assert.equal(staleStop.mode, "emergency");
  passed(
    "real scheduler marked a silent node offline, state unknown, and issued latched OFF (physical stop unverified)",
  );
  unsubscribe();
  console.log(
    `DWMS synthetic HTTP integration passed: ${checks.length} checkpoints. Temporary backend/data removed; no physical result claimed.`,
  );
} catch (error) {
  console.error(`FAIL ${error.message}`);
  // Do not print backend admin credentials or environment values.
  const safeLogs = logs.replace(
    /(anonymous-[\w-]+\|)[A-Za-z0-9]+/g,
    "$1[redacted]",
  );
  console.error(safeLogs.slice(-4000));
  process.exitCode = 1;
} finally {
  await publicClient?.close();
  await operatorClient?.close();
  if (backend?.pid && backend.exitCode === null) {
    try {
      process.kill(-backend.pid, "SIGINT");
    } catch {
      /* already stopped */
    }
    await Promise.race([
      new Promise((done) => backend.once("exit", done)),
      delay(4000),
    ]);
    try {
      process.kill(-backend.pid, "SIGKILL");
    } catch {
      /* process group already exited */
    }
  }
  await rm(project, { recursive: true, force: true });
}
