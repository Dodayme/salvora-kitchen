import nextEnv from "@next/env";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { hash, compare } from "bcryptjs";
import { databaseUrl } from "../src/lib/config/schema.ts";
import { createDatabaseClient } from "../src/lib/db/client.ts";
import { rateLimitKey, AUTH_WINDOW_MS } from "../src/lib/auth/rate-limit.ts";
import { sessionDigest } from "../src/lib/auth/session.ts";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
let phase = "configuration";
let child, db;
const startTime = new Date();
const secret = randomBytes(32).toString("hex");
const origin = "https://auth-http.example.test";
const suffix = randomUUID();
const email = `http-buyer-${suffix}@example.test`;
const adminEmail = `http-admin-${suffix}@example.test`;
const otherAdminEmail = `http-other-${suffix}@example.test`;
const missingEmail = `http-missing-${suffix}@example.test`;
const limitedEmail = `http-limited-${suffix}@example.test`;
const fixtureEmails = [email, adminEmail, otherAdminEmail, missingEmail, limitedEmail];
const password = randomBytes(20).toString("base64url");
const readToken = response => {
  const header = response.headers.get("set-cookie") ?? "";
  const token = header.match(/(?:^|;\s*)salvora_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  assert.ok(token, "Expected session cookie");
  for (const flag of ["HttpOnly", "Secure", "SameSite=lax", "Path=/", "Max-Age=604800"]) assert.ok(header.includes(flag), "Expected secure cookie attributes");
  return token;
};

try {
  const connectionString = databaseUrl(process.env, "test");
  db = createDatabaseClient({ ...process.env, NODE_ENV: "test", TEST_DATABASE_URL: connectionString });
  assert.equal((await db.$queryRaw`SELECT current_database() AS name`)[0].name, "salvora_kitchen_test");
  phase = "fixtures";
  const passwordHash = await hash(password, 12);
  const admin = await db.user.create({ data: { email: adminEmail, name: "HTTP Admin", passwordHash, role: "ADMIN" } });
  const other = await db.user.create({ data: { email: otherAdminEmail, name: "Other HTTP Admin", passwordHash, role: "ADMIN" } });
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const env = { ...process.env, NODE_ENV: "test", DATABASE_URL: "", TEST_DATABASE_URL: connectionString, AUTH_SECRET: secret, NEXT_PUBLIC_APP_URL: origin, MIDTRANS_IS_PRODUCTION: "false", MIDTRANS_SERVER_KEY: "", NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "" };
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env, windowsHide: true, stdio: "ignore" });
  let spawnError;
  child.on("error", error => { spawnError = error; });
  const base = `http://127.0.0.1:${port}`;
  phase = "server startup";
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error("Server exited");
    try { if ((await fetch(base, { signal: AbortSignal.timeout(500) })).status === 200) { ready = true; break; } }
    catch { /* Local startup only. */ }
    await delay(100);
  }
  assert.ok(ready, "Server startup timeout");

  async function call(path, { data, method, token, requestOrigin = origin } = {}) {
    const response = await fetch(base + path, {
      method: method ?? (data === undefined ? "GET" : "POST"),
      headers: { ...(data === undefined ? {} : { "Content-Type": "application/json" }), ...(requestOrigin ? { Origin: requestOrigin } : {}), ...(token ? { Cookie: `salvora_session=${token}` } : {}) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    const text = await response.text();
    assert.ok(!text.includes(password) && !text.includes(secret), "Private value in response");
    assert.ok(!text.includes("passwordHash") && !text.includes("tokenDigest"), "Private field in response");
    if (token) assert.ok(!text.includes(token), "Session token in JSON");
    assert.equal(response.headers.get("cache-control"), "no-store");
    return { response, body: JSON.parse(text) };
  }

  phase = "anonymous access";
  assert.equal((await call("/api/auth/session")).body.data.user, null);
  assert.equal((await call("/api/admin/me")).response.status, 401);
  assert.equal((await call("/api/me/voucher")).response.status, 401);
  const registration = { name: "HTTP Buyer", email, password, confirmPassword: password };
  phase = "origin and role injection";
  assert.equal((await call("/api/auth/register", { data: registration, requestOrigin: "https://attacker.example.test" })).response.status, 403);
  assert.equal((await call("/api/auth/register", { data: { ...registration, role: "ADMIN" } })).response.status, 422);
  assert.equal(await db.user.count({ where: { email } }), 0);
  phase = "registration";
  const registered = await call("/api/auth/register", { data: { ...registration, email: ` ${email.toUpperCase()} ` } });
  assert.equal(registered.response.status, 201);
  assert.equal(registered.body.data.user.role, "BUYER");
  assert.deepEqual(Object.keys(registered.body.data.user).sort(), ["email", "id", "name", "role"]);
  const firstToken = readToken(registered.response);
  phase = "new buyer voucher read";
  const initialVoucher = await call("/api/me/voucher", { token: firstToken });
  assert.equal(initialVoucher.response.status, 200);
  assert.ok(initialVoucher.response.headers.get("vary")?.split(/,\s*/).includes("Cookie"));
  assert.deepEqual(Object.keys(initialVoucher.body.data.voucher).sort(), ["id", "type", "percentage", "maxDiscount", "status", "reservedOrderId", "usedAt"].sort());
  assert.equal(initialVoucher.body.data.voucher.percentage, 20);
  assert.equal(initialVoucher.body.data.voucher.maxDiscount, 100000);
  assert.equal(initialVoucher.body.data.voucher.status, "AVAILABLE");
  assert.ok(!JSON.stringify(registered.body).includes(firstToken));
  const buyer = await db.user.findUniqueOrThrow({ where: { email } });
  assert.ok(await compare(password, buyer.passwordHash));
  assert.ok(await db.session.findUnique({ where: { tokenDigest: sessionDigest(firstToken, secret) } }));
  assert.equal((await call("/api/auth/register", { data: registration })).response.status, 409);
  assert.equal((await call("/api/admin/me", { token: firstToken })).response.status, 403);
  phase = "generic login errors";
  const invalid = await call("/api/auth/login", { data: { email, password: "incorrect-http-test-password" } });
  const missing = await call("/api/auth/login", { data: { email: missingEmail, password } });
  assert.equal(invalid.response.status, 401);
  assert.equal(missing.response.status, 401);
  assert.deepEqual(invalid.body.error, missing.body.error);
  phase = "rotation and logout";
  const login = await call("/api/auth/login", { data: { email, password }, token: firstToken });
  assert.equal(login.response.status, 200);
  const secondToken = readToken(login.response);
  assert.equal((await call("/api/me/voucher", { token: secondToken })).body.data.voucher.id, initialVoucher.body.data.voucher.id);
  assert.notEqual(firstToken, secondToken);
  assert.equal((await call("/api/auth/session", { token: firstToken })).body.data.user, null);
  assert.equal((await call("/api/auth/logout", { data: {}, token: secondToken, requestOrigin: null })).response.status, 403);
  assert.equal((await call("/api/auth/session", { token: secondToken })).body.data.user.id, buyer.id);
  const logout = await call("/api/auth/logout", { data: {}, token: secondToken });
  assert.equal(logout.response.status, 200);
  assert.ok(logout.response.headers.get("set-cookie").includes("Max-Age=0"));
  assert.equal((await call("/api/auth/session", { token: secondToken })).body.data.user, null);
  assert.equal((await call("/api/auth/logout", { data: {}, token: secondToken })).response.status, 200);
  phase = "expiry";
  const fresh = await call("/api/auth/login", { data: { email, password } });
  const expiredToken = readToken(fresh.response);
  await db.session.update({ where: { tokenDigest: sessionDigest(expiredToken, secret) }, data: { createdAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await call("/api/auth/session", { token: expiredToken })).body.data.user, null);
  phase = "admin own profile";
  const adminLogin = await call("/api/auth/login", { data: { email: adminEmail, password } });
  const adminToken = readToken(adminLogin.response);
  assert.equal((await call("/api/me/voucher", { token: adminToken })).response.status, 403);
  assert.equal(await db.discount.count({ where: { userId: admin.id } }), 0);
  assert.equal((await call("/api/admin/me", { token: adminToken })).body.data.id, admin.id);
  for (const extra of [{ role: "BUYER" }, { id: other.id }, { email: "changed@example.test" }]) {
    assert.equal((await call("/api/admin/me", { method: "PATCH", data: { name: "Blocked", ...extra }, token: adminToken })).response.status, 422);
  }
  assert.equal((await call("/api/admin/me", { method: "PATCH", data: { name: "Updated HTTP Admin" }, token: adminToken })).response.status, 200);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: other.id } })).name, "Other HTTP Admin");
  await db.user.update({ where: { id: admin.id }, data: { role: "BUYER" } });
  assert.equal((await call("/api/admin/me", { token: adminToken })).response.status, 403);
  phase = "login rate limit";
  for (let n = 0; n < 10; n++) assert.equal((await call("/api/auth/login", { data: { email: limitedEmail, password } })).response.status, 401);
  const limited = await call("/api/auth/login", { data: { email: limitedEmail, password } });
  assert.equal(limited.response.status, 429);
  assert.ok(Number(limited.response.headers.get("retry-after")) > 0);
  assert.equal(await db.discount.count({ where: { userId: buyer.id } }), 1);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: buyer.id } })).isFirstPurchase, true);
  console.log("Auth HTTP verified on dedicated test DB: registration, validation, generic login errors, cookie flags, rotation, expiry, logout revocation, Origin, roles, own profile, rate limit; one buyer voucher issued.");
} catch {
  console.error(`Auth HTTP verification failed at: ${phase}. No credentials or session tokens printed.`);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null && child.pid) {
    const exit = once(child, "exit");
    child.kill();
    await exit;
  }
  if (db) {
    try {
      await db.discount.deleteMany({ where: { user: { email: { in: fixtureEmails } } } });
      await db.user.deleteMany({ where: { email: { in: fixtureEmails } } });
      const keys = [];
      for (let time = Math.floor(startTime.getTime() / AUTH_WINDOW_MS) * AUTH_WINDOW_MS; time <= Date.now(); time += AUTH_WINDOW_MS) {
        for (const operation of ["register", "login"]) {
          keys.push(rateLimitKey(`auth.${operation}.global`, "all", secret, new Date(time)));
          for (const identity of fixtureEmails) keys.push(rateLimitKey(`auth.${operation}.email`, identity, secret, new Date(time)));
        }
      }
      await db.rateLimit.deleteMany({ where: { key: { in: keys } } });
    } catch {
      console.error("Cleanup fixture auth test belum lengkap; tidak menghapus data lain.");
      process.exitCode = 1;
    } finally { await db.$disconnect(); }
  }
}
