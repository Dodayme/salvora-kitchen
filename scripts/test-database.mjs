import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
import { databaseUrl } from "../src/lib/config/schema.ts";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
try {
  const connection = databaseUrl(process.env, "test");
  const env = { ...process.env, TEST_DATABASE_URL: connection, DATABASE_URL: connection, NODE_ENV: "test", SALVORA_DATABASE_TARGET: "test" };
  const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env, encoding: "utf8", windowsHide: true });
  if (migration.error || migration.status !== 0) throw new Error("Test database migration failed");
  const tests = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.db.config.ts"], { env, encoding: "utf8", windowsHide: true });
  let output = (tests.stdout ?? "") + (tests.stderr ?? "");
  for (const [key, value] of Object.entries(env)) if (value && /SECRET|PASSWORD|KEY|DATABASE_URL/.test(key)) output = output.split(value).join("[redacted]");
  console.log(output);
  if (tests.error || tests.status !== 0) process.exitCode = 1;
} catch {
  console.error("Tes DB ditolak/gagal: wajib TEST_DATABASE_URL khusus salvora_kitchen_test dengan layanan dan migrasi siap. Tidak memakai database aplikasi sebagai fallback.");
  process.exitCode = 1;
}
