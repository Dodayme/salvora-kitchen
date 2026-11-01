// One bounded pass, intended for an OS scheduler. No browser/HTTP cron secret.
import { mkdir, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { executePaymentWorker } from "./payment-worker-runtime.mjs";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
let services;
const outcome = await executePaymentWorker({
  nodeVersion: process.versions.node, argvCount: process.argv.length, now: () => new Date().toISOString(),
  importEnvironment: () => import("@next/env"),
  loadEnvironment: load => load(process.cwd(), true, { info: () => {}, error: () => {} }),
  async configure() {
    const { appConfig, snapConfig } = await import("../src/lib/config/schema.ts");
    return { ...snapConfig(process.env), ...appConfig(process.env) };
  },
  async loadServices() {
    const [database, status, lock, reconciliation, batch] = await Promise.all([
      import("../src/lib/db/client.ts"), import("../src/lib/payments/status.ts"), import("../src/lib/payments/job-lock.ts"),
      import("../src/services/reconciliation.ts"), import("../src/services/payment-job.ts"),
    ]);
    services = { ...database, ...status, ...lock, ...reconciliation, ...batch };
  },
  createDatabase: () => services.createDatabaseClient(),
  withLock: (settings, observeStage, action) => services.withPaymentJobLock(settings.databaseUrl, action, observeStage),
  runBatch: (db, settings, assertHeld) => services.runPaymentBatch(db, services.createReconciliationService(db, { ...settings, gateway: services.createStatusGateway(settings.serverKey) }), assertHeld),
  disconnect: db => db.$disconnect(),
  async persist(report) {
    await mkdir(".local", { recursive: true });
    const temporary = `.local/payment-job-${randomUUID()}.json`;
    await writeFile(temporary, JSON.stringify(report, null, 2) + "\n");
    await rename(temporary, ".local/payment-job-last.json");
  },
});
console.log(JSON.stringify(outcome.report));
process.exitCode = outcome.exitCode;
