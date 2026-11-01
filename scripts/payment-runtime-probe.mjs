// Read-only startup probe: imports declarations and validates configuration only.
// Never instantiate Prisma/pg clients, run the worker, call a gateway or mutate tasks.
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
const targets = [
  ["next-env", "@next/env"],
  ["config", "../src/lib/config/schema.ts"],
  ["database-client", "../src/lib/db/client.ts"],
  ["status-gateway", "../src/lib/payments/status.ts"],
  ["job-lock", "../src/lib/payments/job-lock.ts"],
  ["reconciliation-service", "../src/services/reconciliation.ts"],
  ["payment-batch", "../src/services/payment-job.ts"],
];
const codes = new Set(["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND", "ERR_UNKNOWN_FILE_EXTENSION", "ERR_UNSUPPORTED_ESM_URL_SCHEME", "ERR_REQUIRE_ESM", "ERR_PACKAGE_PATH_NOT_EXPORTED"]);
const result = { nodeVersion: process.versions.node, argvCount: process.argv.length, nodeOptionsPresent: !!process.env.NODE_OPTIONS, nodeEnvKind: ["production", "development", "test"].includes(process.env.NODE_ENV) ? process.env.NODE_ENV : "OTHER_OR_UNSET", imports: [] };
for (const [module, specifier] of targets) {
  try { await import(specifier); result.imports.push({ module, status: "OK" }); }
  catch (error) {
    result.imports.push({ module, status: "FAILED", code: codes.has(error?.code) ? error.code : error instanceof SyntaxError ? "IMPORT_SYNTAX_ERROR" : "IMPORT_FAILED" });
  }
}
if (result.imports.every(item => item.status === "OK")) {
  try {
    const namespace = await import("@next/env");
    result.envExportShape = { defaultType: typeof namespace.default, namedLoaderType: typeof namespace.loadEnvConfig, nestedLoaderType: typeof namespace.default?.loadEnvConfig };
    const load = namespace.loadEnvConfig ?? namespace.default?.loadEnvConfig;
    if (typeof load !== "function") throw new TypeError("ENV_MODULE_SHAPE");
    load(process.cwd(), true, { info: () => {}, error: () => {} });
    const { snapConfig, appConfig } = await import("../src/lib/config/schema.ts"); snapConfig(process.env); result.configuration = "VALID";
    const database = new URL(appConfig(process.env).databaseUrl);
    const name = decodeURIComponent(database.pathname.slice(1));
    result.databaseMetadata = { target: name === "salvora_kitchen_dev" ? "DEV" : name === "salvora_kitchen_demo" ? "DEMO" : "TEST", loopback: ["localhost", "127.0.0.1", "::1", "[::1]"].includes(database.hostname), port: Number(database.port || 5432) };
  } catch { result.configuration = "INVALID"; }
}
console.log(JSON.stringify(result));
if (result.imports.some(item => item.status === "FAILED") || result.configuration === "INVALID") process.exitCode = 1;
