import { test } from "node:test";
import assert from "node:assert/strict";
import { executePaymentWorker, loadEnvironmentFunction, safeJobFailure } from "../scripts/payment-worker-runtime.mjs";

const secret = "private-config-query-provider-stack-sentinel";
function fixture() {
  const calls = [], persisted = [], db = { fixture: true };
  const ops = {
    nodeVersion: "24.21.0", argvCount: 2, now: () => "2026-10-23T00:00:00.000Z",
    importEnvironment: async () => ({ loadEnvConfig() {} }),
    loadEnvironment: async load => { calls.push("env"); load(); },
    configure: async () => ({ databaseUrl: secret, serverKey: secret }),
    loadServices: async () => { calls.push("imports"); },
    createDatabase: async () => { calls.push("client"); return db; },
    withLock: async (_settings, stage, action) => { calls.push("connect"); stage("database_connection"); stage("lock"); return { skipped: false, value: await action(() => {}) }; },
    runBatch: async () => { calls.push("batch"); return { checked: 0, released: 0, unconfirmed: 0 }; },
    disconnect: async value => { assert.equal(value, db); calls.push("disconnect"); },
    persist: async report => { persisted.push(report); },
  };
  return { ops, calls, persisted };
}
test("loader accepts real named export and legacy CommonJS default shape", async () => {
  const actual = await import("@next/env");
  assert.equal(typeof loadEnvironmentFunction(actual), "function"); // Does not call it or load env.
  const load = () => {};
  assert.equal(loadEnvironmentFunction({ loadEnvConfig: load }), load);
  assert.equal(loadEnvironmentFunction({ default: { loadEnvConfig: load } }), load);
  assert.throws(() => loadEnvironmentFunction({ default: undefined }), error => error.code === "ENV_LOADER_UNAVAILABLE");
});
test("successful MOCK pass is persisted after cleanup, no configuration escapes", async () => {
  const f = fixture(), result = await executePaymentWorker(f.ops);
  assert.equal(result.exitCode, 0); assert.equal(result.report.status, "COMPLETED");
  assert.deepEqual(f.calls, ["env", "imports", "client", "connect", "batch", "disconnect"]);
  assert.equal(f.persisted.length, 1); assert.ok(!JSON.stringify(result).includes(secret));
});
test("unsupported Node and arguments stop before configuration/client", async () => {
  for (const override of [{ nodeVersion: "22.0.0" }, { argvCount: 3 }]) {
    const f = fixture(), result = await executePaymentWorker({ ...f.ops, ...override });
    assert.equal(result.exitCode, 1); assert.equal(result.report.phase, "runtime"); assert.deepEqual(f.calls, []);
  }
});
test("env import and loader shape failures are persisted before client creation", async () => {
  for (const [value, code] of [[undefined, "ENV_LOADER_UNAVAILABLE"], ["missing", "DEPENDENCY_MISSING"]]) {
    const f = fixture(); f.ops.importEnvironment = async () => { if (value === "missing") throw { code: "ERR_MODULE_NOT_FOUND", message: secret }; return { default: undefined }; };
    const result = await executePaymentWorker(f.ops);
    assert.equal(result.exitCode, 1); assert.equal(result.report.code, code); assert.deepEqual(f.calls, []);
    assert.equal(f.persisted.length, 1); assert.ok(!JSON.stringify(result).includes(secret));
  }
});
test("configuration failure is not mislabeled as database/payment failure", async () => {
  const f = fixture(); f.ops.configure = async () => { throw { code: "ENV_NOT_CONFIGURED", message: secret }; };
  const result = await executePaymentWorker(f.ops);
  assert.equal(result.report.phase, "configuration"); assert.equal(result.report.code, "CONFIGURATION_INVALID");
  assert.deepEqual(f.calls, ["env"]); assert.equal(f.persisted.length, 1);
});
test("dependency import/TypeScript loader failure is distinct from DB startup", async () => {
  const f = fixture(); f.ops.loadServices = async () => { throw { code: "ERR_UNKNOWN_FILE_EXTENSION", stack: secret }; };
  const result = await executePaymentWorker(f.ops);
  assert.equal(result.report.phase, "dependencies"); assert.equal(result.report.code, "TYPESCRIPT_LOADER_UNAVAILABLE");
  assert.ok(!f.calls.includes("client"));
});
test("connection error and lock SQL permission error have different phases", async () => {
  for (const [phase, code, expected] of [["database_connection", "ECONNREFUSED", "CONNECTION_REFUSED"], ["lock", "42501", "DATABASE_AUTHORIZATION_FAILED"]]) {
    const f = fixture(); f.ops.withLock = async (_settings, stage) => { stage(phase); throw { cause: { code }, message: secret }; };
    const result = await executePaymentWorker(f.ops);
    assert.equal(result.report.phase, phase); assert.equal(result.report.code, expected); assert.equal(result.exitCode, 1);
    assert.ok(f.calls.includes("disconnect")); assert.ok(!f.calls.includes("batch"));
  }
});
test("occupied lock is normal skipped pass, never invokes reconciliation", async () => {
  const f = fixture(); f.ops.withLock = async () => ({ skipped: true });
  const result = await executePaymentWorker(f.ops);
  assert.equal(result.exitCode, 0); assert.equal(result.report.status, "SKIPPED_LOCKED"); assert.ok(!f.calls.includes("batch"));
});
test("batch infrastructure error and unresolved attempts remain different", async () => {
  const f = fixture(); f.ops.runBatch = async () => { throw { code: "P2021", query: secret }; };
  const failed = await executePaymentWorker(f.ops);
  assert.equal(failed.report.phase, "reconciliation"); assert.equal(failed.report.code, "DATABASE_SCHEMA_MISSING"); assert.equal(failed.exitCode, 1);
  f.ops.runBatch = async () => ({ checked: 2, released: 0, unconfirmed: 1 });
  const unconfirmed = await executePaymentWorker(f.ops); assert.equal(unconfirmed.exitCode, 2); assert.equal(unconfirmed.report.status, "COMPLETED");
});
test("cleanup and log-write errors have safe separate diagnostic categories", async () => {
  const f = fixture(); f.ops.disconnect = async () => { throw new Error(secret); };
  const cleanup = await executePaymentWorker(f.ops); assert.equal(cleanup.report.phase, "cleanup"); assert.equal(cleanup.exitCode, 1);
  f.ops.disconnect = async () => {}; f.ops.persist = async () => { throw { path: secret, code: "EACCES" }; };
  const log = await executePaymentWorker(f.ops); assert.equal(log.report.phase, "persistence"); assert.equal(log.report.code, "DIAGNOSTIC_WRITE_FAILED");
  assert.ok(!JSON.stringify([cleanup, log]).includes(secret));
});
test("error classifier is bounded, allowlisted and never copies raw error fields", () => {
  const error = { code: secret, message: secret, stack: secret, meta: { driverAdapterError: { cause: { originalCode: "28P01", data: secret } } } };
  error.cause = error;
  assert.deepEqual(safeJobFailure(error, "database_connection"), { phase: "database_connection", code: "DATABASE_AUTHENTICATION_FAILED" });
  assert.deepEqual(safeJobFailure({ code: secret }, secret), { phase: "runtime", code: "RUNTIME_FAILED" });
});
