// Pure orchestration and allowlisted diagnostics. No env, DB or gateway imports.
const phases = new Set(["runtime", "environment_module", "environment", "configuration", "dependencies", "database_client", "database_connection", "lock", "reconciliation", "cleanup", "persistence"]);
const known = {
  NODE_VERSION_UNSUPPORTED: "RUNTIME_UNSUPPORTED", WORKER_ARGUMENTS_INVALID: "ARGUMENTS_INVALID",
  ENV_LOADER_UNAVAILABLE: "ENV_LOADER_UNAVAILABLE", ENV_NOT_CONFIGURED: "CONFIGURATION_INVALID",
  ERR_MODULE_NOT_FOUND: "DEPENDENCY_MISSING", MODULE_NOT_FOUND: "DEPENDENCY_MISSING",
  ERR_UNKNOWN_FILE_EXTENSION: "TYPESCRIPT_LOADER_UNAVAILABLE", ERR_UNSUPPORTED_ESM_URL_SCHEME: "IMPORT_URL_INVALID",
  ERR_REQUIRE_ESM: "IMPORT_INTEROP_FAILED", ERR_PACKAGE_PATH_NOT_EXPORTED: "DEPENDENCY_EXPORT_UNAVAILABLE",
  ECONNREFUSED: "CONNECTION_REFUSED", ETIMEDOUT: "CONNECTION_TIMEOUT",
  ENOTFOUND: "HOST_UNRESOLVED", EAI_AGAIN: "HOST_UNRESOLVED",
  "28P01": "DATABASE_AUTHENTICATION_FAILED", "28000": "DATABASE_AUTHENTICATION_FAILED", P1000: "DATABASE_AUTHENTICATION_FAILED",
  "42501": "DATABASE_AUTHORIZATION_FAILED", "3D000": "DATABASE_MISSING", "42P01": "DATABASE_SCHEMA_MISSING", P2021: "DATABASE_SCHEMA_MISSING",
  P1001: "DATABASE_UNREACHABLE", P1002: "DATABASE_CONNECTION_TIMEOUT", P1017: "DATABASE_CONNECTION_CLOSED",
  EACCES: "ACCESS_DENIED", EPERM: "ACCESS_DENIED", PAYMENT_JOB_LOCK_LOST: "LOCK_CONNECTION_LOST",
};
export function safeJobFailure(error, phase) {
  const seen = new Set(), pending = [error];
  let code;
  // Only inspect bounded, known structural fields. Never serialize errors/messages,
  // stack traces, query text, metadata, config values or nested provider payloads.
  while (pending.length && seen.size < 12 && !code) {
    const item = pending.shift(); if (!item || typeof item !== "object" || seen.has(item)) continue;
    seen.add(item);
    try {
      code = [item.code, item.originalCode].find(value => typeof value === "string" && Object.hasOwn(known, value));
      pending.push(item.cause, item.meta, item.driverAdapterError);
      if (Array.isArray(item.errors)) pending.push(...item.errors.slice(0, 3));
    } catch { /* Untrusted/getter-backed errors are not logged. */ }
  }
  const stage = phases.has(phase) ? phase : "runtime";
  return { phase: stage, code: code ? known[code] : `${stage.toUpperCase()}_FAILED` };
}
export function loadEnvironmentFunction(namespace) {
  const load = namespace?.loadEnvConfig ?? namespace?.default?.loadEnvConfig;
  if (typeof load !== "function") throw Object.assign(new Error(), { code: "ENV_LOADER_UNAVAILABLE" });
  return load;
}
export async function executePaymentWorker(ops) {
  const startedAt = ops.now(), nodeVersion = /^\d+\.\d+\.\d+$/.test(ops.nodeVersion) ? ops.nodeVersion : "UNKNOWN";
  let phase = "runtime", db, report, exitCode = 0;
  try {
    const [major, minor] = nodeVersion.split(".").map(Number);
    if (major !== 24 || minor < 21) throw Object.assign(new Error(), { code: "NODE_VERSION_UNSUPPORTED" });
    if (ops.argvCount !== 2) throw Object.assign(new Error(), { code: "WORKER_ARGUMENTS_INVALID" });
    phase = "environment_module"; const namespace = await ops.importEnvironment();
    phase = "environment"; await ops.loadEnvironment(loadEnvironmentFunction(namespace));
    phase = "configuration"; const settings = await ops.configure();
    phase = "dependencies"; await ops.loadServices();
    phase = "database_client"; db = await ops.createDatabase(settings);
    phase = "database_connection";
    const result = await ops.withLock(settings, stage => { if (["database_connection", "lock"].includes(stage)) phase = stage; }, async assertHeld => {
      phase = "reconciliation"; return ops.runBatch(db, settings, assertHeld);
    });
    report = { startedAt, completedAt: ops.now(), nodeVersion, status: result.skipped ? "SKIPPED_LOCKED" : "COMPLETED", ...(!result.skipped ? { checked: result.value.checked, released: result.value.released, unconfirmed: result.value.unconfirmed } : {}) };
    if (!result.skipped && result.value.unconfirmed) exitCode = 2;
  } catch (error) {
    report = { startedAt, completedAt: ops.now(), nodeVersion, status: "FAILED", ...safeJobFailure(error, phase) }; exitCode = 1;
  } finally {
    if (db) try { await ops.disconnect(db); } catch (error) {
      if (report?.status !== "FAILED") report = { startedAt, completedAt: ops.now(), nodeVersion, status: "FAILED", ...safeJobFailure(error, "cleanup") };
      exitCode = 1;
    }
  }
  try { await ops.persist(report); } catch {
    report = { startedAt, completedAt: ops.now(), nodeVersion, status: "FAILED", phase: "persistence", code: "DIAGNOSTIC_WRITE_FAILED" }; exitCode = 1;
  }
  return { report, exitCode };
}
