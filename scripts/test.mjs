import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Compile the real production modules with the existing TypeScript compiler.
// Keep output below node_modules so emitted CommonJS resolves existing packages.
const out = mkdtempSync(join(process.cwd(), "node_modules", ".dwms-tests-"));
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
}
try {
  writeFileSync(join(out, "package.json"), '{"type":"commonjs"}');
  run(process.execPath, ["node_modules/typescript/bin/tsc", "--outDir", out,
    "--rootDir", ".", "--module", "commonjs", "--moduleResolution", "node",
    "--target", "ES2022", "--skipLibCheck", "--strict", "--esModuleInterop",
    "--allowJs", "convex/_generated/api.js", "convex/_generated/server.js",
    "convex/devices.ts", "convex/http.ts", "convex/agentAnalysis.ts", "convex/chatAction.ts", "convex/auth.config.ts",
    "src/lib/dwms-safety.ts", "src/lib/monitoring.ts", "src/lib/demo-state.ts", "src/lib/workspace.ts"]);
  const tests = readdirSync("tests").filter(name => name.endsWith(".test.cjs")).map(name => join("tests", name));
  if (!tests.length) throw new Error("No JavaScript tests found");
  run(process.execPath, ["--test", ...tests], { ...process.env, DWMS_TEST_BUILD_DIR: out });
  run("python3", ["-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py", "-v"]);
} finally {
  rmSync(out, { recursive: true, force: true });
}
