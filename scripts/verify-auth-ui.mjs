/** Opt-in, local UI test harness. No dev writes, provider calls, migrations or task changes. */
import nextEnv from "@next/env";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { hash } from "bcryptjs";
import { databaseUrl } from "../src/lib/config/schema.ts";
import { createDatabaseClient } from "../src/lib/db/client.ts";
import { registerSchema, loginSchema } from "../src/lib/auth/validation.ts";
import { AUTH_WINDOW_MS, rateLimitKey } from "../src/lib/auth/rate-limit.ts";
import { createCatalogFixtures, catalogCommands } from "./catalog-ui-fixtures.mjs";

const buyerMode = process.argv.includes("--buyer");
const catalogMode = buyerMode || process.argv.includes("--catalog"), directory = buyerMode ? ".local/fe04" : catalogMode ? ".local/fe03" : ".local/fe02";
const commands = ["expire", "demote", "limit", "fail-session", "fail-logout", "restore", "summary", "stop", ...(catalogMode ? catalogCommands : [])];
if (process.argv.includes("--control")) {
  const command = process.argv[process.argv.indexOf("--control") + 1];
  if (!commands.includes(command)) { console.error("Unknown fixture control."); process.exit(1); }
  const current = JSON.parse(await readFile(`${directory}/current.json`, "utf8"));
  if (typeof current.controlFile !== "string" || !/^\.local\/fe0[234]\/fe0[234]-[a-f0-9-]+\.control\.json$/.test(current.controlFile) || !resolve(current.controlFile).startsWith(resolve(directory) + sep)) { console.error("Control manifest invalid."); process.exit(1); }
  await writeFile(current.controlFile, JSON.stringify({ nonce: randomUUID(), command }));
  console.log(JSON.stringify({ status: "QUEUED", mode: current.mode, command })); process.exit(0);
}
const mode = process.argv.includes("--test-db") ? "test-db" : process.argv.includes("--mock") ? "mock" : null;
if (!mode) { console.error("Select --mock or --test-db explicitly. Test DB must already be running; this harness never starts PostgreSQL."); process.exit(1); }
if (catalogMode && mode !== "test-db") { console.error("Catalog fixtures require --test-db; mock overlays remain explicit local controls."); process.exit(1); }
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const run = randomUUID(), prefix = `${buyerMode ? "fe04" : catalogMode ? "fe03" : "fe02"}-${run}`, secret = randomBytes(32).toString("hex"), started = new Date();
const password = randomBytes(20).toString("base64url");
const buyerEmail = `${prefix}-buyer@example.test`, adminEmail = `${prefix}-admin@example.test`, limitedEmail = `${prefix}-limited@example.test`;
const fixtureEmails = [buyerEmail, adminEmail, limitedEmail], users = new Map(), passwords = new Map([[adminEmail, password]]), sessions = new Map(), calls = {};
let db, child, proxy, poll, phase = "configuration", closed = false, targetVerified = false, limited = false, failSession = false, failLogout = false;
let connectionString, origin, catalogFixture;
const addCall = (path, status) => { const key = `${path}:${status}`; calls[key] = (calls[key] ?? 0) + 1; };
function response(res, path, data, status = 200, code, cookie) {
  addCall(path, status);
  const requestId = randomUUID();
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-Id": requestId, ...(status === 429 ? { "Retry-After": "3" } : {}), ...(cookie ? { "Set-Cookie": cookie } : {}) });
  res.end(JSON.stringify({ success: status < 400, ...(status < 400 ? { data } : { error: { code, message: code === "INVALID_CREDENTIALS" ? "Email atau kata sandi salah." : code === "EMAIL_EXISTS" ? "Email sudah terdaftar." : "Permintaan contoh belum dapat diselesaikan.", ...(data?.fields ? { fields: data.fields } : {}) } }), meta: { requestId } }));
}
async function mock(req, res, path, body) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)salvora_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (req.method === "GET" && path === "/api/auth/session") return response(res, path, { user: sessions.get(token) ?? null }, failSession ? 503 : 200, "EXAMPLE_UNAVAILABLE");
  if (req.method !== "POST") return response(res, path, null, 405, "METHOD_NOT_ALLOWED");
  if (req.headers.origin !== origin) return response(res, path, null, 403, "ORIGIN_FORBIDDEN");
  let input; try { input = JSON.parse(body.toString()); } catch { return response(res, path, null, 422, "INVALID_JSON"); }
  if (path === "/api/auth/logout") {
    if (failLogout) return response(res, path, null, 503, "EXAMPLE_UNAVAILABLE");
    sessions.delete(token); return response(res, path, null, 200, undefined, "salvora_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  }
  const registering = path === "/api/auth/register", parsed = (registering ? registerSchema : loginSchema).safeParse(input);
  if (!parsed.success) return response(res, path, { fields: parsed.error.issues.map(issue => ({ path: issue.path.join("."), code: issue.code })) }, 422, "VALIDATION_ERROR");
  const { email } = parsed.data;
  if (limited && email === limitedEmail) return response(res, path, null, 429, "RATE_LIMITED");
  if (registering && users.has(email)) return response(res, path, null, 409, "EMAIL_EXISTS");
  if (registering) { users.set(email, { id: `${prefix}-buyer`, name: parsed.data.name, email, role: "BUYER" }); passwords.set(email, parsed.data.password); }
  const user = users.get(email);
  if (!user || parsed.data.password !== passwords.get(email)) return response(res, path, null, 401, "INVALID_CREDENTIALS");
  sessions.delete(token); const next = randomBytes(32).toString("hex"); sessions.set(next, user);
  return response(res, path, { user }, registering ? 201 : 200, undefined, `salvora_session=${next}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
}
async function stop() {
  if (closed) return; closed = true;
  clearInterval(poll);
  if (proxy) { proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve)); }
  if (child && child.exitCode === null) { const exiting = once(child, "exit"); child.kill(); await exiting; }
  if (db) {
    // Exact run-scoped identities only. Never delete orders/provider evidence or reset a database.
    try {
      if (!targetVerified) throw Error("Unverified target: no cleanup writes allowed");
      const fixtures = await db.user.findMany({ where: { email: { in: fixtureEmails } }, select: { id: true } });
      if (await db.order.count({ where: { userId: { in: fixtures.map(user => user.id) } } })) throw Error("Fixture contains an order; cleanup refused");
      await catalogFixture?.cleanup();
      await db.discount.deleteMany({ where: { userId: { in: fixtures.map(user => user.id) } } });
      await db.user.deleteMany({ where: { id: { in: fixtures.map(user => user.id) }, email: { in: fixtureEmails } } });
      const keys = [];
      for (let time = Math.floor(started.getTime() / AUTH_WINDOW_MS) * AUTH_WINDOW_MS; time <= Date.now(); time += AUTH_WINDOW_MS) for (const operation of ["login", "register"]) {
        keys.push(rateLimitKey(`auth.${operation}.global`, "all", secret, new Date(time)));
        for (const email of fixtureEmails) keys.push(rateLimitKey(`auth.${operation}.email`, email, secret, new Date(time)));
      }
      await db.rateLimit.deleteMany({ where: { key: { in: keys } } });
      await catalogFixture?.verifyCleanup();
    } catch { console.error(JSON.stringify({ status: "FAILED", phase: "targeted_cleanup", detailsRedacted: true })); process.exitCode = 1; }
    finally { await db.$disconnect(); }
  }
  console.log(JSON.stringify({ status: "STOPPED", mode, calls, providerCalls: 0, databaseWrites: mode === "test-db" ? (buyerMode ? "run-scoped auth/catalog/cart/address fixtures only" : catalogMode ? "run-scoped auth/catalog/cart fixtures only" : "run-scoped auth fixtures only") : 0 }));
}
try {
  await mkdir(directory, { recursive: true });
  if (mode === "test-db") {
    connectionString = databaseUrl(process.env, "test"); const target = new URL(connectionString);
    if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.port !== "55433") throw Error("Wrong test target");
    db = createDatabaseClient({ NODE_ENV: "test", TEST_DATABASE_URL: connectionString });
    phase = "identity";
    const identity = await db.$queryRaw`SELECT current_database()::text AS name, inet_server_port() AS port`;
    if (identity[0].name !== "salvora_kitchen_test" || identity[0].port !== 55433) throw Error("Wrong database identity");
    targetVerified = true;
    phase = "fixtures";
    await db.user.create({ data: { email: adminEmail, name: "FE02 Admin Test", passwordHash: await hash(password, 12), role: "ADMIN" } });
    if (catalogMode) catalogFixture = await createCatalogFixtures(db, run, fixtureEmails, { buyerMode, directory });
  } else users.set(adminEmail, { id: `${prefix}-admin`, email: adminEmail, name: "FE02 Admin Mock", role: "ADMIN" });
  proxy = createServer(); proxy.listen(0, "127.0.0.1"); await once(proxy, "listening");
  origin = `http://127.0.0.1:${proxy.address().port}`;
  const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
  const upstream = `http://127.0.0.1:${reservation.address().port}`; await new Promise(resolve => reservation.close(resolve));
  phase = "next_start";
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", upstream.split(":").at(-1)], { env: { ...process.env, NODE_ENV: "test", DATABASE_URL: "", TEST_DATABASE_URL: connectionString ?? "postgresql://mock:unused@127.0.0.1:1/salvora_kitchen_test", AUTH_SECRET: secret, NEXT_PUBLIC_APP_URL: origin, MIDTRANS_IS_PRODUCTION: "false", MIDTRANS_SERVER_KEY: "", NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "", MIDTRANS_WEBHOOK_URL: "" }, windowsHide: true, stdio: "ignore" });
  let startupError; child.on("error", () => { startupError = true; });
  for (let n = 0; ; n++) {
    if (startupError || child.exitCode !== null || n > 100) throw Error("Next startup failed");
    try { if ((await fetch(upstream, { signal: AbortSignal.timeout(500) })).ok) break; } catch { /* bounded startup */ }
    await delay(100);
  }
  proxy.on("request", async (req, res) => {
    const path = new URL(req.url, origin).pathname;
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 65536) throw Error("Body too large"); chunks.push(chunk); }
      const body = Buffer.concat(chunks);
      if (path.startsWith("/api/")) {
        if (catalogFixture?.intercept(req, res, path)) return;
        const dashboardRead = path === "/api/admin/dashboard" && req.method === "GET";
        if (!["/api/auth/session", "/api/auth/register", "/api/auth/login", "/api/auth/logout"].includes(path) && !dashboardRead && !catalogFixture?.allowed(path, req.method)) return response(res, path, null, 403, "HARNESS_ROUTE_BLOCKED");
        // Admin entry now reads dashboard. Mock mode has no operational database; do not fake metrics.
        if (mode === "mock" && dashboardRead) return response(res, path, null, 503, "FIXTURE_UNAVAILABLE");
        if (mode === "mock") return await mock(req, res, path, body);
        if (req.method === "POST" && ["/api/auth/login", "/api/auth/register"].includes(path)) {
          let email; try { email = JSON.parse(body.toString()).email?.trim().toLowerCase(); } catch { /* upstream validation */ }
          if (email && !fixtureEmails.includes(email)) return response(res, path, null, 403, "HARNESS_FIXTURE_ONLY");
        }
      }
      const headers = { ...req.headers }; delete headers.host; delete headers["content-length"]; delete headers.connection;
      const upstreamResponse = await fetch(upstream + req.url, { method: req.method, headers, ...(body.length ? { body } : {}), redirect: "manual" });
      if (catalogFixture?.loseResponse(path, req.method, upstreamResponse.status)) return response(res, path, null, 503, "FIXTURE_RESPONSE_LOST");
      const outgoing = Object.fromEntries(upstreamResponse.headers); delete outgoing["content-encoding"]; delete outgoing["transfer-encoding"]; delete outgoing["content-length"];
      const cookies = upstreamResponse.headers.getSetCookie(); if (cookies.length) outgoing["set-cookie"] = cookies;
      if (path.startsWith("/api/")) addCall(path, upstreamResponse.status);
      res.writeHead(upstreamResponse.status, outgoing); res.end(Buffer.from(await upstreamResponse.arrayBuffer()));
    } catch { response(res, path, null, 503, "HARNESS_UNAVAILABLE"); }
  });
  phase = "ready";
  await mkdir(directory, { recursive: true });
  const credentialsFile = `${directory}/${prefix}.private.json`;
  await writeFile(credentialsFile, JSON.stringify({ origin, mode, buyerEmail, adminEmail, limitedEmail, password, catalog: catalogFixture?.manifest }), { mode: 0o600 });
  const controlFile = `${directory}/${prefix}.control.json`;
  await writeFile(controlFile, JSON.stringify({ nonce: "initial", command: null }));
  await writeFile(`${directory}/current.json`, JSON.stringify({ mode, origin, credentialsFile, controlFile }));
  console.log(JSON.stringify({ status: "READY", mode, origin, credentialValuesPrinted: false, commands }));
  const lines = createInterface({ input: process.stdin });
  async function control(line) {
    const command = line.trim();
    try {
      if (command === "stop") { lines.close(); await stop(); return; }
      if (command === "expire") { if (db) await db.session.deleteMany({ where: { user: { email: { in: fixtureEmails } } } }); else sessions.clear(); }
      if (command === "demote") { if (db) await db.user.update({ where: { email: adminEmail }, data: { role: "BUYER" } }); else users.get(adminEmail).role = "BUYER"; }
      if (command === "limit") { limited = true; if (db) await db.rateLimit.upsert({ where: { key: rateLimitKey("auth.login.email", limitedEmail, secret, new Date()) }, create: { key: rateLimitKey("auth.login.email", limitedEmail, secret, new Date()), count: 10, resetAt: new Date(Date.now() + 900000) }, update: { count: 10 } }); }
      if (command === "fail-session" && mode === "mock") failSession = true;
      if (command === "fail-logout" && mode === "mock") failLogout = true;
      if (command === "restore") { failSession = false; failLogout = false; }
      if (catalogCommands.includes(command)) await catalogFixture?.control(command);
      console.log(JSON.stringify({ status: "CONTROLLED", mode, command: commands.includes(command) ? command : "unknown", ...(command === "summary" ? { calls } : {}) }));
    } catch { console.error(JSON.stringify({ status: "FAILED", phase: "fixture_control", detailsRedacted: true })); }
  }
  lines.on("line", line => { void control(line); });
  let last = "initial", reading = false;
  poll = setInterval(async () => {
    if (reading || closed) return; reading = true;
    try { const entry = JSON.parse(await readFile(controlFile, "utf8")); if (entry.nonce !== last && commands.includes(entry.command)) { last = entry.nonce; await control(entry.command); } } catch { /* Partial control-file write: retry without printing content. */ }
    finally { reading = false; }
  }, 200);
  process.on("SIGINT", () => { lines.close(); void stop(); }); process.on("SIGTERM", () => { lines.close(); void stop(); });
} catch { console.error(JSON.stringify({ status: "FAILED", phase, mode, detailsRedacted: true })); process.exitCode = 1; await stop(); }
