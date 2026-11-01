/** FE-11: fixed vouchers/own profile, real Next HTTP + verified TEST DB. No provider/worker paths. */
import nextEnv from "@next/env";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { hash } from "bcryptjs";
import { databaseUrl } from "../src/lib/config/schema.ts";
import { createDatabaseClient } from "../src/lib/db/client.ts";
import { rateLimitKey, AUTH_WINDOW_MS } from "../src/lib/auth/rate-limit.ts";
import { createApiClient, ApiClientError } from "../src/lib/http/client.ts";
import { createSessionStore } from "../src/lib/auth-client/session-store.ts";
import { createAdminAction } from "../src/lib/admin-client/action-controller.ts";
import { adminNamePayload, adminVoucherPath, decodeAdminMe, decodeAdminVouchers, decodeVoucherPolicy } from "../src/lib/admin-client/account-model.ts";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const run = randomUUID(), prefix = `fe11-${run}`, secret = randomBytes(32).toString("hex"), password = randomBytes(20).toString("base64url"), started = Date.now();
const emails = Array.from({ length: 14 }, (_, i) => `${prefix}-${i}@example.test`), categoryId = `${prefix}-category`, productId = `${prefix}-product`, cases = [];
const tables = ["User", "Session", "Address", "Category", "Product", "ProductPhoto", "Cart", "CartItem", "Discount", "CheckoutQuote", "Order", "OrderItem", "StockReservation", "OrderStatusHistory", "Payment", "PaymentApplication", "PaymentEvent", "Rating"];
let db, child, verified = false, baseline, phase = "configuration", cleanupPass = false;
async function fingerprint() { const result = {}; for (const table of tables) result[table] = await db.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text),'')) AS digest FROM "${table}" t`); return JSON.stringify(result); }
const safeError = error => ({ category: ["AssertionError", "PrismaClientKnownRequestError", "PrismaClientValidationError", "ApiClientError"].includes(error?.name) ? error.name : "Error", code: typeof error?.code === "string" && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : "UNCLASSIFIED" });
try {
  const url = databaseUrl(process.env, "test"), target = new URL(url); assert.ok(["127.0.0.1", "localhost"].includes(target.hostname) && target.port === "55433");
  db = createDatabaseClient({ NODE_ENV: "test", TEST_DATABASE_URL: url }); const [identity] = await db.$queryRaw`SELECT current_database()::text AS name, inet_server_port() AS port`;
  assert.equal(identity.name, "salvora_kitchen_test"); assert.equal(identity.port, 55433); verified = true; baseline = await fingerprint();
  await mkdir(".local/fe11", { recursive: true }); await writeFile(`.local/fe11/${run}-baseline.json`, baseline);
  phase = "fixtures"; const passwordHash = await hash(password, 12), users = [];
  for (let i = 0; i < emails.length; i++) users.push(await db.user.create({ data: { email: emails[i], name: i < 2 ? "FE11 Admin" : `FE11 Buyer ${i}`, passwordHash, role: i < 2 ? "ADMIN" : "BUYER" } }));
  await db.category.create({ data: { id: categoryId, name: prefix, isDemo: true } }); await db.product.create({ data: { id: productId, categoryId, name: "FE11 fixture", description: "Test only", price: 10000, physicalStock: 10, isDemo: true } });
  const vouchers = [];
  for (let i = 2; i < users.length; i++) vouchers.push(await db.discount.create({ data: { userId: users[i].id } }));
  const relations = [];
  for (const [index, status] of [[10, "RESERVED"], [11, "USED"]]) {
    const voucher = vouchers[index], id = `${prefix}-order-${index}`;
    const order = await db.order.create({ data: { id, number: `${prefix}-N-${index}`, userId: voucher.userId, discountId: voucher.id, idempotencyKey: randomUUID(), inputHash: randomBytes(32).toString("hex"), status: status === "USED" ? "PROCESSING" : "AWAITING_PAYMENT", recipientName: "FE11 fixture", phone: "0800000000", addressLine: "Synthetic test snapshot", city: "Tanjungpinang", province: "Kepulauan Riau", subtotal: 10000, discount: 2000, shippingFee: 10000, total: 18000, shippingLabel: "Test delivery", paymentDeadline: new Date(Date.now() + 3600000), items: { create: { productId, name: "FE11 historical item", unitPrice: 10000, quantity: 1, lineSubtotal: 10000 } } } });
    await db.discount.update({ where: { id: voucher.id }, data: status === "RESERVED" ? { status, reservedOrderId: id } : { status, usedOrderId: id, usedAt: new Date() } }); relations.push({ voucherId: voucher.id, order, status });
  }
  const socket = createServer(); socket.listen(0, "127.0.0.1"); await once(socket, "listening"); const port = socket.address().port; await new Promise(done => socket.close(done)); const origin = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { windowsHide: true, stdio: "ignore", env: { ...process.env, NODE_ENV: "test", DATABASE_URL: "", TEST_DATABASE_URL: url, AUTH_SECRET: secret, NEXT_PUBLIC_APP_URL: origin, MIDTRANS_IS_PRODUCTION: "false", MIDTRANS_SERVER_KEY: "", NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "", MIDTRANS_WEBHOOK_URL: "" } });
  let spawnFailed = false; child.on("error", () => { spawnFailed = true; }); phase = "startup";
  for (let n = 0; ; n++) { assert.ok(n < 150 && !spawnFailed && child.exitCode === null); try { if ((await fetch(origin, { signal: AbortSignal.timeout(500) })).ok) break; } catch { /* bounded startup */ } await delay(100); }
  let patchCalls = 0;
  function client() { let cookie = ""; return createApiClient(async (relative, options) => {
    const path = new URL(relative, origin).pathname;
    assert.ok(path === "/api/auth/login" || options.method === "GET" && ["/api/auth/session", "/api/admin/me", "/api/admin/vouchers", "/api/admin/voucher-policy"].includes(path) || options.method === "PATCH" && path === "/api/admin/me", "Only own profile/voucher read/auth routes permitted");
    const headers = new Headers(options.headers); if (!headers.has("Origin")) headers.set("Origin", origin); if (cookie) headers.set("Cookie", cookie); if (options.method === "PATCH") patchCalls++;
    const response = await fetch(origin + relative, { ...options, headers }); if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; "); return response;
  }); }
  const admin = client(), other = client(), buyer = client(), anon = client();
  for (const [request, email] of [[admin, emails[0]], [other, emails[1]], [buyer, emails[2]]]) await request("/api/auth/login", { method: "POST", json: { email, password } });
  const errorCode = async (promise, status) => { await assert.rejects(promise, error => error instanceof ApiClientError && error.status === status); };
  phase = "access guards";
  for (const path of ["/api/admin/me", "/api/admin/vouchers", "/api/admin/voucher-policy"]) { await errorCode(anon(path), 401); await errorCode(buyer(path), 403); }
  await errorCode(buyer("/api/admin/me", { method: "PATCH", json: { name: "Forbidden" } }), 403);
  await errorCode(admin("/api/admin/me", { method: "PATCH", headers: { Origin: "https://wrong.example.test" }, json: { name: "Wrong origin" } }), 403);
  cases.push("anonymous 401/buyer 403 for own admin profile/voucher list/policy; buyer PATCH and wrong Origin denied");
  phase = "policy and pagination";
  const beforeVouchers = await db.discount.findMany({ orderBy: { id: "asc" } }), beforeOrders = await db.order.findMany({ where: { userId: { in: users.map(row => row.id) } }, orderBy: { id: "asc" } });
  assert.deepEqual((await admin("/api/admin/voucher-policy", { decode: decodeVoucherPolicy })).data, { type: "NEW_BUYER", percentage: 20, maxDiscount: 100000, oncePerAccount: true });
  for (const status of ["", "AVAILABLE", "RESERVED", "USED"]) {
    const rows = await db.discount.findMany({ where: status ? { status } : {}, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true } });
    for (const page of [1, 2]) { const response = await admin(adminVoucherPath(page, status), { decode: decodeAdminVouchers }); assert.equal(response.meta.pagination.total, rows.length); assert.deepEqual(response.data.map(row => row.id), rows.slice((page - 1) * 10, page * 10).map(row => row.id)); }
  }
  assert.equal((await admin(adminVoucherPath(100000), { decode: decodeAdminVouchers })).data.length, 0);
  cases.push("fixed 20%/100000/once policy; all/AVAILABLE/RESERVED/USED pagination 1+2 matches independent SQL including existing rows; out-of-range empty");
  phase = "voucher relations and readonly";
  for (const relation of relations) {
    const response = await admin(adminVoucherPath(1, relation.status), { decode: decodeAdminVouchers });
    // A fixture may fall beyond page 1 when archived test rows exist; follow actual pagination.
    let row = response.data.find(row => row.id === relation.voucherId);
    for (let page = 2; !row && page <= response.meta.pagination.totalPages; page++) row = (await admin(adminVoucherPath(page, relation.status), { decode: decodeAdminVouchers })).data.find(row => row.id === relation.voucherId);
    assert.ok(row); assert.equal(row.orderNumber, relation.order.number); assert.equal((row.usedOrder ?? row.reservedOrder).id, relation.order.id); assert.deepEqual(Object.keys(row.owner), ["name"]);
  }
  assert.deepEqual(await db.discount.findMany({ orderBy: { id: "asc" } }), beforeVouchers); assert.deepEqual(await db.order.findMany({ where: { userId: { in: users.map(row => row.id) } }, orderBy: { id: "asc" } }), beforeOrders);
  cases.push("RESERVED/USED owner and order links correct; read-only list/policy leaves voucher/order state intact; no owner email in client DTO");
  phase = "own profile and strict payload";
  const otherBefore = await db.user.findUniqueOrThrow({ where: { id: users[1].id } }), ownBefore = await db.user.findUniqueOrThrow({ where: { id: users[0].id } });
  assert.equal((await admin("/api/admin/me", { decode: value => decodeAdminMe(value, users[0].id) })).data.id, users[0].id);
  assert.equal((await other("/api/admin/me", { decode: value => decodeAdminMe(value, users[1].id) })).data.id, users[1].id);
  await errorCode(admin("/api/admin/me", { method: "PATCH", json: { name: "Injection", id: users[1].id, email: "other@example.test", role: "BUYER" } }), 422);
  for (const name of ["x", "x".repeat(101)]) await errorCode(admin("/api/admin/me", { method: "PATCH", json: { name } }), 422);
  const store = createSessionStore(admin); await store.refresh(true);
  async function save(name) {
    const action = createAdminAction({ request: store.accountRequest, authorized: () => store.getSnapshot().user?.id === users[0].id && store.getSnapshot().user?.role === "ADMIN" }); let refresh;
    await action.run(client => client("/api/admin/me", { method: "PATCH", json: adminNamePayload(name).data, decode: value => decodeAdminMe(value, users[0].id) }), () => { refresh = store.refresh(true); });
    assert.equal(action.getSnapshot().phase, "saved"); await refresh; return store.getSnapshot().user;
  }
  assert.equal((await save("  FE11 Confirmed Name  ")).name, "FE11 Confirmed Name");
  assert.equal((await admin("/api/admin/me", { decode: decodeAdminMe })).data.name, "FE11 Confirmed Name");
  const ownAfter = await db.user.findUniqueOrThrow({ where: { id: users[0].id } }); const unchanged = ({ name: _name, updatedAt: _time, ...rest }) => { void _name; void _time; return rest; };
  assert.deepEqual(unchanged(ownAfter), unchanged(ownBefore)); assert.deepEqual(await db.user.findUniqueOrThrow({ where: { id: users[1].id } }), otherBefore);
  cases.push("own GET for two admins; role/email/ID injection and invalid lengths 422; PATCH name only, trimmed; session/header revalidated from HTTP; other admin and own immutable fields unchanged");
  phase = "Unicode profile session round-trip";
  const unicode = "😀".repeat(100); assert.equal((await save(unicode)).name, unicode); assert.equal((await admin("/api/admin/me", { decode: decodeAdminMe })).data.name, unicode);
  cases.push("100 Unicode code point name accepted by API/profile and fresh session decoder; no false session error");
  phase = "committed profile response loss";
  const beforePatches = patchCalls, action = createAdminAction({ request: admin, authorized: () => true });
  const operation = client => client("/api/admin/me", { method: "PATCH", json: adminNamePayload("FE11 Recovered Name").data, decode: decodeAdminMe }).then(() => { throw new ApiClientError(0, "NETWORK_ERROR", "", "network"); });
  await action.run(operation, () => {}); action.reset(); await action.run(operation, () => {}); assert.equal(action.getSnapshot().phase, "needsReload"); assert.equal(patchCalls - beforePatches, 1);
  assert.equal((await admin("/api/admin/me", { decode: decodeAdminMe })).data.name, "FE11 Recovered Name"); await store.refresh(true); assert.equal(store.getSnapshot().user.name, "FE11 Recovered Name");
  assert.deepEqual(await db.discount.findMany({ orderBy: { id: "asc" } }), beforeVouchers);
  cases.push("profile response lost after commit: one PATCH only, reload sees saved name, session revalidation recovers; vouchers untouched");
  phase = "revoked session"; await db.session.deleteMany({ where: { userId: users[0].id } }); await errorCode(admin("/api/admin/me"), 401); await errorCode(admin("/api/admin/vouchers"), 401); cases.push("revoked session denied for profile and voucher reads; no gateway/worker/payment endpoints permitted");
} catch (error) { console.error(JSON.stringify({ result: "FAIL", phase, ...safeError(error), detailsRedacted: true })); process.exitCode = 1; }
finally {
  if (child && child.exitCode === null) { const exit = once(child, "exit"); child.kill(); await exit; }
  if (db && verified && baseline !== undefined) try {
    const owners = { user: { email: { in: emails } } }, orders = { order: owners };
    assert.equal(await db.payment.count({ where: orders }), 0);
    await db.$transaction(async tx => {
      await tx.discount.updateMany({ where: owners, data: { status: "AVAILABLE", reservedOrderId: null, usedOrderId: null, usedAt: null } });
      await tx.orderItem.deleteMany({ where: orders }); await tx.order.deleteMany({ where: owners }); await tx.discount.deleteMany({ where: owners }); await tx.user.deleteMany({ where: { email: { in: emails } } });
      await tx.product.deleteMany({ where: { id: productId, categoryId } }); await tx.category.deleteMany({ where: { id: categoryId } });
    });
    const keys = []; for (let time = Math.floor(started / AUTH_WINDOW_MS) * AUTH_WINDOW_MS; time <= Date.now(); time += AUTH_WINDOW_MS) { keys.push(rateLimitKey("auth.login.global", "all", secret, new Date(time))); for (const email of emails) keys.push(rateLimitKey("auth.login.email", email, secret, new Date(time))); }
    await db.rateLimit.deleteMany({ where: { key: { in: keys } } }); assert.equal(await fingerprint(), baseline); assert.equal(await db.user.count({ where: { email: { in: emails } } }), 0); cleanupPass = true;
  } catch (error) { console.error(JSON.stringify({ cleanup: "FAIL", ...safeError(error), detailsRedacted: true })); process.exitCode = 1; }
  if (db) await db.$disconnect();
  const result = { result: process.exitCode ? "FAIL" : "PASS", timestamp: new Date().toISOString(), run, phase, target: "salvora_kitchen_test:55433", groups: cases.length, cases, cleanup: cleanupPass ? "PASS" : "FAIL", fingerprintTables: tables.length, remainingFixtureUsers: cleanupPass ? 0 : null, providerCalls: 0, browserTested: false };
  await mkdir(".local/fe11", { recursive: true }); await writeFile(`.local/fe11/${run}-result.json`, JSON.stringify(result, null, 2)); await writeFile(".local/fe11/http-result.json", JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
}
