import nextEnv from "@next/env";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { databaseUrl } from "../src/lib/config/schema.ts";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
try {
  const url = new URL(databaseUrl(process.env));
  const database = url.pathname.slice(1);
  const directory = join(process.cwd(), ".local", "backups");
  mkdirSync(directory, { recursive: true });
  const name = `${database}-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`;
  const output = join(directory, name);
  const bin = process.env.SALVORA_POSTGRES_BIN ?? "C:/Program Files/PostgreSQL/18/bin";
  const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: database, PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGCONNECT_TIMEOUT: "5" };
  for (const key of ["PGSERVICE", "PGSERVICEFILE", "PGOPTIONS"]) delete env[key];
  const dump = spawnSync(join(bin, "pg_dump.exe"), ["--format=custom", "--no-owner", "--no-privileges", "--file", output], { env, windowsHide: true, stdio: "ignore", timeout: 60000 });
  if (dump.error || dump.status !== 0) throw new Error("Backup failed");
  const verify = spawnSync(join(bin, "pg_restore.exe"), ["--list", output], { windowsHide: true, stdio: "ignore", timeout: 10000 });
  if (verify.error || verify.status !== 0) throw new Error("Archive check failed");
  console.log(`Backup dan pemeriksaan arsip berhasil: .local/backups/${name}. Pemulihan ke database lain belum dijalankan.`);
} catch {
  console.error("Backup gagal; periksa konfigurasi/binary/izin. Detail koneksi dan password tidak dicetak.");
  process.exitCode = 1;
}
