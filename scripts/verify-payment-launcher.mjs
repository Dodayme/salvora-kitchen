// Inert GUI-launcher smoke test. Never invoke the payment runner or a task.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") throw new Error("This launcher test requires Windows.");
const root = fileURLToPath(new URL("..", import.meta.url));
const shell = path.join(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe");
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => ["systemroot", "windir", "path", "temp", "tmp"].includes(key.toLowerCase())));
const build = spawnSync(shell, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(root, "scripts/build-payment-launcher.ps1")], { cwd: root, env, windowsHide: true, encoding: "utf8", timeout: 30000 });
assert.equal(build.status, 0, "GUI launcher compilation failed (raw compiler output suppressed)");
const executable = path.join(root, ".local/automation/SalvoraPaymentLauncher.exe");
const binary = readFileSync(executable), pe = binary.readUInt32LE(0x3c);
assert.equal(binary.readUInt16LE(pe + 24 + 68), 2, "Launcher must use the GUI subsystem, not console subsystem");
for (const code of [0, 1, 2]) {
  const result = spawnSync(executable, [process.execPath, "--self-test"], { cwd: root, env: { ...env, SALVORA_LAUNCHER_SMOKE: "1", SALVORA_LAUNCHER_FIXTURE_EXIT: String(code) }, windowsHide: true, encoding: "utf8", timeout: 15000 });
  assert.equal(result.status, code, "Child exit code was not propagated");
  assert.equal(result.stdout + result.stderr, "", "Launcher leaked raw child output");
  const proof = JSON.parse(readFileSync(path.join(root, ".local/payment-launcher-self-test.json"), "utf8"));
  assert.equal(proof.mode, "SELF_TEST"); assert.equal(proof.consoleAttached, false); assert.equal(proof.exitCode, code);
  assert.deepEqual(Object.keys(proof).sort(), ["startedAt", "completedAt", "mode", "exitCode", "code", "consoleAttached"].sort());
  assert.ok(!JSON.stringify(proof).includes("sentinel"), "Raw child stdout/stderr must not be logged");
}
const invalid = spawnSync(executable, [path.join(root, ".local/nonexistent/node.exe"), "--self-test"], { cwd: root, env, windowsHide: true, encoding: "utf8", timeout: 15000 });
assert.equal(invalid.status, 1);
const failed = JSON.parse(readFileSync(path.join(root, ".local/payment-launcher-self-test.json"), "utf8"));
assert.equal(failed.code, "LAUNCH_CONFIGURATION_INVALID"); assert.equal(failed.consoleAttached, false);
console.log("GUI launcher smoke passed: PE subsystem 2, no console attached, inert child exit 0/1/2, safe logs, invalid-path failure. No task changes, payment runner, env loader, database or provider calls.");
