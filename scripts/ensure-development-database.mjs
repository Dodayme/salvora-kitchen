import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import pg from "pg";

export async function ensureDevelopmentDatabase({ root, source, exists = existsSync, read = readFileSync, run = spawnSync, Client = pg.Client }) {
  const url = new URL(source.DATABASE_URL ?? "");
  // Only the marker-owned project cluster may be started automatically.
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "55433") return;
  const directory = join(root, ".local", "postgres"), marker = join(directory, "owner.json"), data = join(directory, "data");
  if (!exists(marker) || !exists(join(data, "PG_VERSION"))) throw new Error("Database lokal belum disiapkan. Ikuti panduan DATABASE.md; data tidak dibuat atau direset otomatis.");
  const owner = JSON.parse(read(marker, "utf8"));
  if (resolve(owner.root) !== resolve(root) || owner.port !== 55433 || owner.owner !== "salvora_bootstrap") throw new Error("Penanda database tidak cocok dengan proyek Salvora.");
  const binary = join(source.SALVORA_POSTGRES_BIN ?? "C:/Program Files/PostgreSQL/18/bin", "pg_ctl.exe");
  const options = { windowsHide: true, timeout: 30000, stdio: "ignore" };
  const status = run(binary, ["-D", data, "status"], options);
  if (status.error || ![0, 3].includes(status.status)) throw new Error("Status database lokal tidak dapat diperiksa. Periksa PostgreSQL dan penanda cluster.");
  if (status.status === 3) {
    const started = run(binary, ["-D", data, "-l", join(directory, "server.log"), "start", "-w"], options);
    if (started.error || started.status !== 0) throw new Error("Database lokal gagal menyala. Periksa .local/postgres/server.log.");
  }
  const client = new Client({ connectionString: source.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try { await client.connect(); await client.query("SELECT 1"); }
  catch { throw new Error("Database belum dapat dihubungi. Periksa konfigurasi lokal dan layanan PostgreSQL."); }
  finally { await client.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, "..");
  nextEnv.loadEnvConfig(root, true, { info() {}, error() {} });
  try { await ensureDevelopmentDatabase({ root, source: process.env }); console.log("Database siap. Menjalankan website…"); }
  catch (error) { console.error(error instanceof Error && !/Invalid URL/.test(error.message) ? error.message : "Konfigurasi DATABASE_URL belum tersedia atau tidak valid."); process.exitCode = 1; }
}
