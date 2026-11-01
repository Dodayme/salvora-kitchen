import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
import { databaseUrl } from "../src/lib/config/schema.ts";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
try {
  const [action, target] = process.argv.slice(2);
  if (!["migrate", "status", "seed", "generate", "validate"].includes(action) || (target && target !== "test")) throw new Error("Invalid command");
  const test = target === "test";
  const url = databaseUrl(process.env, test ? "test" : "app");
  const args = action === "migrate" ? ["migrate", "deploy"] : action === "status" ? ["migrate", "status"] : action === "seed" ? ["db", "seed"] : [action];
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], {
    env: { ...process.env, NODE_ENV: test ? "test" : (process.env.NODE_ENV ?? "development"), SALVORA_DATABASE_TARGET: test ? "test" : "app", DATABASE_URL: url },
    stdio: ["inherit", "pipe", "pipe"], encoding: "utf8", windowsHide: true,
  });
  // Never forward Prisma diagnostics that may contain connection strings or credentials.
  if (result.error || result.status !== 0) {
    console.error(`Database ${action} gagal pada target Salvora ${test ? "test" : "app"}; periksa konfigurasi/layanan dan status migrasi. Detail koneksi tidak dicetak.`);
    process.exitCode = 1;
  } else console.log(`Database ${action} berhasil pada target Salvora ${test ? "test" : "app"}.`);
} catch {
  console.error("Konfigurasi/perintah database tidak valid. Target harus database Salvora yang eksplisit; tidak ada fallback.");
  process.exitCode = 1;
}
