import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { once } from "node:events";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import pg from "pg";

const root = resolve(import.meta.dirname, "..");
const directory = join(root, ".local", "postgres");
const data = join(directory, "data");
const stateFile = join(directory, "owner.json");
const environmentFile = join(root, ".env.local");
const bin = process.env.SALVORA_POSTGRES_BIN ?? "C:/Program Files/PostgreSQL/18/bin";
const port = 55433;
const action = process.argv[2] ?? "start";
const execute = (name, args, allowFailure = false) => {
  const result = spawnSync(join(bin, `${name}.exe`), args, { encoding: "utf8", windowsHide: true, timeout: 30000, stdio: name === "pg_ctl" ? ["ignore", "ignore", "ignore"] : ["ignore", "pipe", "pipe"] });
  if (result.error || (!allowFailure && result.status !== 0)) throw new Error(`${name} gagal. Periksa log lokal PostgreSQL; tidak ada layanan lain yang diubah.`);
  return result;
};
const sqlName = value => {
  if (!/^[a-z_]+$/.test(value)) throw new Error("Nama database/role tidak valid.");
  return `"${value}"`;
};

async function main() {
  if (!["start", "stop", "status"].includes(action)) throw new Error("Gunakan start, stop, atau status.");
  let state;
  if (existsSync(stateFile)) {
    state = JSON.parse(readFileSync(stateFile, "utf8"));
    if (state.root !== root || state.port !== port || state.owner !== "salvora_bootstrap") throw new Error("Marker cluster tidak cocok dengan workspace.");
  } else {
    if (action !== "start") throw new Error("Cluster Salvora belum dibuat.");
    if (existsSync(data) || existsSync(environmentFile) || existsSync(join(root, ".env"))) throw new Error("Konfigurasi/data sudah ada. Helper tidak akan menimpa atau mengadopsinya; gunakan panduan manual.");
    const version = execute("postgres", ["--version"]).stdout.trim();
    if (!/PostgreSQL\) 18\./.test(version)) throw new Error("Helper memerlukan PostgreSQL 18.");
    mkdirSync(directory, { recursive: true });
    state = {
      root, port, version, owner: "salvora_bootstrap", ownerPassword: randomBytes(32).toString("hex"),
      databases: ["dev", "test", "shadow"].map(kind => ({ name: `salvora_kitchen_${kind}`, role: `salvora_${kind}`, password: randomBytes(32).toString("hex") })),
    };
    writeFileSync(stateFile, JSON.stringify(state), { flag: "wx", mode: 0o600 });
  }
  if (!existsSync(join(data, "PG_VERSION"))) {
    if (action !== "start") throw new Error("Inisialisasi cluster belum selesai.");
    const passwordFile = join(directory, "init-password.tmp");
    writeFileSync(passwordFile, state.ownerPassword, { mode: 0o600 });
    try { execute("initdb", ["-D", data, "--username=salvora_bootstrap", `--pwfile=${passwordFile}`, "--auth=scram-sha-256", "--encoding=UTF8", "--no-locale"]); }
    finally { unlinkSync(passwordFile); }
    appendFileSync(join(data, "postgresql.conf"), `\n# Dedicated Salvora development cluster\nlisten_addresses = '127.0.0.1'\nport = ${port}\ntimezone = 'UTC'\n`);
  }
  const running = execute("pg_ctl", ["-D", data, "status"], true).status === 0;
  if (action === "status") { console.log(running ? "Cluster Salvora berjalan (127.0.0.1:55433)." : "Cluster Salvora berhenti."); return; }
  if (action === "stop") {
    if (running) execute("pg_ctl", ["-D", data, "stop", "-m", "fast", "-w"]);
    console.log("Cluster Salvora berhenti. Layanan PostgreSQL lain tidak diubah."); return;
  }
  if (!running) {
    const probe = createServer();
    probe.listen(port, "127.0.0.1");
    await once(probe, "listening");
    await new Promise(done => probe.close(done));
    execute("pg_ctl", ["-D", data, "-l", join(directory, "server.log"), "start", "-w"]);
  }
  const client = new pg.Client({ host: "127.0.0.1", port, database: "postgres", user: state.owner, password: state.ownerPassword, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    // All identifiers and credentials here belong to this fresh, marker-bound cluster.
    await client.query('REVOKE CONNECT ON DATABASE postgres FROM PUBLIC');
    await client.query('REVOKE CONNECT ON DATABASE template1 FROM PUBLIC');
    for (const db of state.databases) {
      const role = await client.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [db.role]);
      if (!role.rowCount) await client.query(`CREATE ROLE ${sqlName(db.role)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${db.password}'`);
      const database = await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [db.name]);
      if (!database.rowCount) await client.query(`CREATE DATABASE ${sqlName(db.name)} OWNER ${sqlName(db.role)}`);
      await client.query(`REVOKE ALL ON DATABASE ${sqlName(db.name)} FROM PUBLIC`);
      await client.query(`GRANT CONNECT ON DATABASE ${sqlName(db.name)} TO ${sqlName(db.role)}`);
    }
  } finally { await client.end(); }
  if (!existsSync(environmentFile)) {
    const urls = state.databases.map(db => `${db.name.endsWith("_test") ? "TEST_DATABASE_URL" : db.name.endsWith("_shadow") ? "SHADOW_DATABASE_URL" : "DATABASE_URL"}="postgresql://${db.role}:${db.password}@127.0.0.1:${port}/${db.name}"`);
    writeFileSync(environmentFile, ["# Local Salvora credentials generated in this workspace; never commit.", ...urls, `AUTH_SECRET="${randomBytes(32).toString("hex")}"`, 'NEXT_PUBLIC_APP_URL="http://localhost:3000"', 'MIDTRANS_IS_PRODUCTION="false"', 'MIDTRANS_SERVER_KEY=""', 'NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=""', 'MIDTRANS_WEBHOOK_URL=""', 'PAYMENT_EXPIRY_MINUTES=""', ""].join("\n"), { flag: "wx", mode: 0o600 });
  }
  console.log(`PostgreSQL Salvora tersedia di 127.0.0.1:${port}. Database dev/test/shadow dan role masing-masing terpisah; konfigurasi tersimpan di .env.local (diabaikan Git).`);
}

main().catch(() => {
  console.error("Penyiapan PostgreSQL Salvora gagal. Tidak ada kredensial ditampilkan. Periksa binary/port dan .local/postgres/server.log; helper tidak mengubah layanan PostgreSQL yang sudah ada.");
  process.exitCode = 1;
});
