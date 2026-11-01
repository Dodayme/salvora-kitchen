/** FE-05: real controller + Next HTTP + isolated existing PostgreSQL test. No provider endpoints. */
import nextEnv from "@next/env";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { databaseUrl } from "../src/lib/config/schema.ts";
import { createDatabaseClient } from "../src/lib/db/client.ts";
import { rateLimitKey, AUTH_WINDOW_MS } from "../src/lib/auth/rate-limit.ts";
import { createApiClient } from "../src/lib/http/client.ts";
import { createCheckoutController } from "../src/lib/checkout-client/controller.ts";
import { createCheckoutJournal } from "../src/lib/checkout-client/recovery.ts";
import { createPaymentController } from "../src/lib/payment-client/controller.ts";
import { verifyOrderClient } from "./order-client-fixtures.mjs";
import { verifyDashboardClient } from "./dashboard-client-fixtures.mjs";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const dashboardUi = process.argv.includes("--dashboard-ui"), ordersUi = process.argv.includes("--orders-ui"), uiMode = dashboardUi || ordersUi || process.argv.includes("--ui");
const dashboardMode = dashboardUi || process.argv.includes("--dashboard-client"), ordersMode = ordersUi || process.argv.includes("--orders-client"), paymentMode = process.argv.includes("--payment-client"), resultDirectory = dashboardMode ? ".local/fe08" : ordersMode ? ".local/fe07" : paymentMode ? ".local/fe06" : ".local/fe05";
if ([dashboardMode, ordersMode, paymentMode].filter(Boolean).length > 1 || (ordersMode || dashboardMode) && process.argv.includes("--ui") || paymentMode && uiMode) { console.error("Fixture modes must run separately."); process.exit(1); }
const run = randomUUID(), prefix = `${dashboardMode ? "fe08" : ordersMode ? "fe07" : paymentMode ? "fe06" : "fe05"}-${run}`, secret = randomBytes(32).toString("hex"), password = randomBytes(20).toString("base64url"), started = Date.now();
const emails = [0, 1, 2, 3, 4].map(i => `${prefix}-${i}@example.test`), productId = `${prefix}-product`, categoryId = `${prefix}-category`;
const extraProductId = `${prefix}-extra-product`;
const dashboardStockIds = []; let dashboardFixture;
const tables = ["User", "Session", "Address", "Category", "Product", "Cart", "CartItem", "Discount", "CheckoutQuote", "Order", "OrderItem", "StockReservation", "OrderStatusHistory", "Payment", "Rating"];
let db, child, uiProxy, verified = false, baseline, phase = "configuration", cases = [], cleanupPass = false, browserTested = false;
async function fingerprint() {
  const result = {};
  for (const table of tables) result[table] = await db.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text),'')) AS digest FROM "${table}" t`);
  return JSON.stringify(result);
}
try {
  const url = databaseUrl(process.env, "test"), target = new URL(url);
  assert.ok(["127.0.0.1", "localhost"].includes(target.hostname) && target.port === "55433");
  db = createDatabaseClient({ NODE_ENV: "test", TEST_DATABASE_URL: url });
  const identity = await db.$queryRaw`SELECT current_database()::text AS name, inet_server_port() AS port`;
  assert.equal(identity[0].name, "salvora_kitchen_test"); assert.equal(identity[0].port, 55433); verified = true;
  baseline = await fingerprint();
  await db.category.create({ data: { id: categoryId, name: "FE05 fixture", isDemo: true } });
  await db.product.create({ data: { id: productId, categoryId, name: "FE05 Risol", description: "Fixture test terisolasi", price: 10000, physicalStock: 20, isDemo: true } });
  const socket = createServer(); socket.listen(0, "127.0.0.1"); await once(socket, "listening"); const port = socket.address().port; await new Promise(done => socket.close(done));
  const origin = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env: { ...process.env, NODE_ENV: "test", DATABASE_URL: "", TEST_DATABASE_URL: url, AUTH_SECRET: secret, NEXT_PUBLIC_APP_URL: origin, MIDTRANS_IS_PRODUCTION: "false", MIDTRANS_SERVER_KEY: "", NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "", MIDTRANS_WEBHOOK_URL: "" }, windowsHide: true, stdio: "ignore" });
  let spawnFailed; child.on("error", () => { spawnFailed = true; });
  phase = "startup";
  for (let i = 0; ; i++) { assert.ok(i < 150 && !spawnFailed && child.exitCode === null); try { if ((await fetch(origin, { signal: AbortSignal.timeout(500) })).ok) break; } catch { /* bounded startup */ } await delay(100); }
  async function fixture(index, city = "Tanjungpinang") {
    let cookie = "", loseResponse = false, loseReviewResponse = false; const confirmations = [], reviewCalls = [];
    const request = createApiClient(async (path, options) => {
      const pathname = new URL(path, origin).pathname;
      const orderAllowed = ordersMode && (options.method === "GET" && (pathname === "/api/orders" || /^\/api\/products\/[A-Za-z0-9_-]+\/reviews$/.test(pathname)) || options.method === "POST" && (/^\/api\/order-items\/[A-Za-z0-9_-]+\/review$/.test(pathname) || pathname === "/api/auth/login"));
      const dashboardAllowed = dashboardMode && (options.method === "GET" && pathname === "/api/admin/dashboard" || options.method === "POST" && pathname === "/api/auth/login");
      assert.ok(/^\/api\/(auth\/(register|session)|addresses|cart\/items|checkout\/quote|orders(?:\/[A-Za-z0-9_-]+)?)$/.test(path) || orderAllowed || dashboardAllowed || paymentMode && /^\/api\/orders\/[A-Za-z0-9_-]+\/payments$/.test(path), "Provider path prohibited; payment endpoint only in explicit empty-key mode");
      const headers = new Headers(options.headers); headers.set("Origin", origin); if (cookie) headers.set("Cookie", cookie);
      const response = await fetch(origin + path, { ...options, headers });
      if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
      if (path === "/api/orders" && options.method === "POST") confirmations.push({ key: headers.get("Idempotency-Key"), body: JSON.parse(options.body), status: response.status });
      if (/^\/api\/order-items\//.test(pathname)) reviewCalls.push(response.status);
      if (loseReviewResponse && /^\/api\/order-items\//.test(pathname) && response.ok) { loseReviewResponse = false; await response.arrayBuffer(); throw Error("Simulated review response loss after commit"); }
      if (path === "/api/orders" && loseResponse && response.ok) { loseResponse = false; await response.arrayBuffer(); throw Error("Simulated response loss after commit"); }
      return response;
    });
    const { data: { user } } = await request("/api/auth/register", { method: "POST", json: { name: "FE05 Fixture", email: emails[index], password, confirmPassword: password } });
    const { data: address } = await request("/api/addresses", { method: "POST", json: { recipientName: "Fixture", phone: "0800000000", addressLine: "Alamat fiktif", city, province: "Kepulauan Riau" } });
    await request("/api/cart/items", { method: "POST", json: { productId, quantity: 2 } });
    const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }, journal = createCheckoutJournal(() => storage);
    const create = () => createCheckoutController({ ownerId: user.id, request, journal, key: randomUUID, authorized: () => true, completed() {} });
    const controller = create(); controller.hydrate();
    return { user, address, controller, create, journal, request, confirmations, reviewCalls, cookie: () => cookie, lose() { loseResponse = true; }, loseReview() { loseReviewResponse = true; } };
  }
  phase = "response loss and reload recovery";
  phase = "first fixture"; const first = await fixture(0);
  phase = "first quote"; await first.controller.quote(first.address.id);
  if (first.controller.getSnapshot().phase !== "review") { console.log(JSON.stringify({ state: first.controller.getSnapshot().phase, code: first.controller.getSnapshot().error?.code })); throw Error("Quote not reviewable"); }
  phase = "quote total and no reservation";
  assert.equal(first.controller.getSnapshot().quote.total, 26000);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: productId } })).reservedStock, 0);
  phase = "lost confirmation"; first.lose(); await Promise.all([first.controller.confirm(true), first.controller.confirm(true)]);
  assert.equal(first.controller.getSnapshot().phase, "uncertain"); assert.equal(first.confirmations.length, 1);
  phase = "committed order count"; const committed = await db.order.findMany({ where: { userId: first.user.id } }); assert.equal(committed.length, 1);
  // A replay must work even when the quote TTL has elapsed, without changing any order fields.
  await db.checkoutQuote.update({ where: { id: first.journal.load(first.user.id).quoteId }, data: { createdAt: new Date(Date.now() - 600000), expiresAt: new Date(Date.now() - 300000) } });
  phase = "expired replay"; const recovered = first.create(); recovered.hydrate(); assert.equal(recovered.getSnapshot().quote, undefined); await recovered.recover();
  if (recovered.getSnapshot().phase !== "done") { console.log(JSON.stringify({ state: recovered.getSnapshot().phase, code: recovered.getSnapshot().error?.code })); throw Error("Replay failed"); }
  assert.equal(recovered.getSnapshot().order.id, committed[0].id); assert.equal(first.confirmations[0].key, first.confirmations[1].key); assert.deepEqual(first.confirmations[0].body, first.confirmations[1].body); assert.deepEqual(first.confirmations.map(value => value.status), [201, 200]);
  const after = await db.order.findMany({ where: { userId: first.user.id } }); assert.equal(after.length, 1); assert.equal(after[0].paymentDeadline.toISOString(), committed[0].paymentDeadline.toISOString());
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: productId } })).reservedStock, 2);
  assert.equal(await db.stockReservation.count({ where: { orderItem: { orderId: after[0].id } } }), 1);
  assert.equal((await db.discount.findUniqueOrThrow({ where: { userId: first.user.id } })).status, "RESERVED");
  assert.equal(await db.cartItem.count({ where: { cart: { userId: first.user.id } } }), 0);
  const completeReload = first.create(); completeReload.hydrate(); await completeReload.recover(); assert.equal(first.confirmations.length, 2); assert.equal(completeReload.getSnapshot().order.id, after[0].id);
  cases.push("lost response: 201 then same-key/body 200 after reload and quote expiry; one order/reservation/voucher; completed reload GET only");
  phase = "price changed and fresh acceptance";
  const second = await fixture(1); await second.controller.quote(second.address.id);
  await db.product.update({ where: { id: productId }, data: { price: 12000 } }); await second.controller.confirm(true);
  assert.equal(second.controller.getSnapshot().error.code, "CHECKOUT_CHANGED"); assert.equal(second.controller.getSnapshot().phase, "select"); assert.equal(await db.order.count({ where: { userId: second.user.id } }), 0);
  await second.controller.quote(second.address.id); assert.equal(second.controller.getSnapshot().quote.total, 29200); await second.controller.confirm(false); assert.equal(second.confirmations.length, 1);
  await second.controller.confirm(true); assert.equal(second.controller.getSnapshot().phase, "done"); assert.notEqual(second.confirmations[0].key, second.confirmations[1].key);
  cases.push("price change rejected with zero orders; fresh server quote and explicit acceptance; new confirmation key");
  phase = "expiry, unavailable stock, delivery";
  const third = await fixture(2); await third.controller.quote(third.address.id);
  await db.checkoutQuote.update({ where: { id: third.controller.getSnapshot().quote.quoteId }, data: { createdAt: new Date(Date.now() - 600000), expiresAt: new Date(Date.now() - 300000) } }); await third.controller.confirm(true);
  assert.equal(third.controller.getSnapshot().error.code, "QUOTE_EXPIRED"); assert.equal(third.controller.getSnapshot().phase, "select");
  await third.controller.quote(third.address.id); await db.product.update({ where: { id: productId }, data: { physicalStock: 4 } }); await third.controller.confirm(true);
  assert.equal(third.controller.getSnapshot().error.code, "INSUFFICIENT_STOCK"); assert.equal(await db.order.count({ where: { userId: third.user.id } }), 0);
  await db.product.update({ where: { id: productId }, data: { physicalStock: 20 } });
  const fourth = await fixture(3, "Batam"); await fourth.controller.quote(fourth.address.id); assert.equal(fourth.controller.getSnapshot().error.code, "DELIVERY_UNAVAILABLE"); assert.equal(fourth.confirmations.length, 0);
  cases.push("server-expired quote and stock conflict create zero orders; outside delivery rejected before confirmation");
  if (ordersMode) { phase = "buyer history and reviews"; cases.push(await verifyOrderClient({ db, run, first, second, productId, extraProductId, categoryId, adminEmail: emails[4], password })); }
  if (dashboardMode) { phase = "admin dashboard"; dashboardFixture = await verifyDashboardClient({ db, run, first, second, productId, categoryId, adminEmail: emails[4], password, stockIds: dashboardStockIds, origin }); cases.push(dashboardFixture.case); }
  if (paymentMode) {
    phase = "payment client GET and fail-closed missing merchant config";
    let opened = 0, remembered = 0;
    const client = createPaymentController({ orderId: committed[0].id, request: first.request, authorized: () => true, sdk: () => ({ pay() { opened++; }, hide() {} }), remember() { remembered++; } });
    await client.refresh(); assert.equal(client.getSnapshot().order.id, committed[0].id); assert.equal(client.getSnapshot().order.canPay, true); assert.equal(client.getSnapshot().order.canReconcile, false);
    await client.reconcile(); // canReconcile=false must not call any reconciliation endpoint.
    await client.pay();
    for (let i = 0; client.getSnapshot().phase === "loading" && i < 100; i++) await delay(20);
    assert.equal(client.getSnapshot().phase, "ready"); assert.equal(client.getSnapshot().error.code, "ENV_NOT_CONFIGURED"); assert.equal(client.getSnapshot().order.status, "AWAITING_PAYMENT"); assert.equal(opened, 0); assert.equal(remembered, 1);
    assert.equal(await db.payment.count({ where: { orderId: committed[0].id } }), 0);
    let rejected = false; try { await second.request(`/api/orders/${committed[0].id}`); } catch (error) { rejected = error.status === 404; } assert.equal(rejected, true);
    const finish = await fetch(`${origin}/payment/finish?transaction_status=settlement&order_id=foreign-fixture`); assert.equal(finish.status, 200);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: committed[0].id } })).status, "AWAITING_PAYMENT"); client.dispose();
    cases.push("payment client real owner GET, foreign 404, missing-key 503 with zero Payment/SDK calls, reconcile flag false, forged finish query cannot mark paid");
  }
  if (uiMode) {
    phase = "browser fixture";
    const adminCookie = ordersUi ? first.cookie() : "";
    if (ordersUi) await first.request("/api/auth/login", { method: "POST", json: { email: emails[0], password } });
    if (dashboardUi) await first.request("/api/auth/login", { method: "POST", json: { email: emails[4], password } });
    const buyer = ordersUi || dashboardUi ? first : await fixture(4); let lose = true, scope = dashboardUi ? "admin" : "buyer"; const sent = [], reviewSent = [], dashboardReads = [];
    const cookies = { buyer: dashboardUi ? second.cookie() : buyer.cookie(), other: second.cookie(), admin: dashboardUi ? first.cookie() : adminCookie, anonymous: "" };
    await mkdir(resultDirectory, { recursive: true }); await writeFile(`${resultDirectory}/ui-control.json`, JSON.stringify({ stop: false, scope }));
    // This opt-in proxy injects only this run's test buyer cookie. No real account login UI.
    // It verifies checkout UI with real APIs; it does not establish browser auth/cookie acceptance.
    uiProxy = createHttpServer(async (req, res) => {
      try {
        const path = new URL(req.url, origin).pathname;
        const allowed = path === "/api/auth/session" && req.method === "GET" || path === "/api/addresses" && req.method === "GET" || path === "/api/cart" && req.method === "GET" || !ordersUi && !dashboardUi && (path === "/api/checkout/quote" && req.method === "POST" || path === "/api/orders" && req.method === "POST") || /^\/api\/orders\/[A-Za-z0-9_-]+$/.test(path) && req.method === "GET" || ordersUi && (path === "/api/orders" && req.method === "GET" || /^\/api\/order-items\/[A-Za-z0-9_-]+\/review$/.test(path) && req.method === "POST" || /^\/api\/products\/[A-Za-z0-9_-]+\/reviews$/.test(path) && req.method === "GET") || dashboardUi && (path === "/api/admin/dashboard" && req.method === "GET" || path === "/api/auth/logout" && req.method === "POST");
        if (path.startsWith("/api/") && !allowed) { res.writeHead(path === "/api/admin/dashboard" && req.method === "GET" ? 503 : 403); res.end(); return; }
        const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; assert.ok(size <= 65536); chunks.push(chunk); }
        const body = Buffer.concat(chunks), headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) if (!["host", "cookie", "origin", "content-length", "connection"].includes(key) && typeof value === "string") headers.set(key, value);
        headers.set("Origin", origin); headers.set("Cookie", cookies[scope]);
        const upstream = await fetch(origin + req.url, { method: req.method, headers, ...(body.length ? { body } : {}), redirect: "manual" });
        if (path === "/api/orders" && req.method === "POST") sent.push({ key: headers.get("Idempotency-Key"), body: JSON.parse(body.toString()), status: upstream.status });
        if (ordersUi && /^\/api\/order-items\//.test(path) && req.method === "POST") reviewSent.push(upstream.status);
        if (dashboardUi && path === "/api/admin/dashboard" && upstream.ok) dashboardReads.push(new URL(req.url, origin).searchParams.toString());
        const payload = Buffer.from(await upstream.arrayBuffer());
        if (lose && upstream.ok && (path === "/api/orders" && req.method === "POST" || ordersUi && /^\/api\/order-items\//.test(path) && req.method === "POST")) { lose = false; res.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify({ success: false, error: { code: "FIXTURE_RESPONSE_LOST", message: "Respons fixture sengaja dihilangkan setelah commit." }, meta: { requestId: randomUUID() } })); return; }
        const outgoing = Object.fromEntries(upstream.headers); for (const key of ["content-encoding", "content-length", "transfer-encoding", "set-cookie"]) delete outgoing[key]; res.writeHead(upstream.status, outgoing); res.end(payload);
      } catch { res.writeHead(503); res.end(); }
    });
    uiProxy.listen(0, "127.0.0.1"); await once(uiProxy, "listening");
    console.log(JSON.stringify({ status: "UI_READY", origin: `http://127.0.0.1:${uiProxy.address().port}`, page: dashboardUi ? "/admin" : ordersUi ? "/pesanan" : "/checkout", ...(dashboardUi ? { fixtureDates: { fromDate: dashboardFixture.range.fromDate, toDate: dashboardFixture.range.toDate } } : {}), scope: "run-scoped fixture cookie injected by proxy; payment paths blocked", stopControl: `${resultDirectory}/ui-control.json` }));
    phase = "browser checkpoint";
    const until = Date.now() + 20 * 60 * 1000;
    for (;;) { assert.ok(Date.now() < until, "UI timed out"); let control; try { control = JSON.parse(await readFile(`${resultDirectory}/ui-control.json`, "utf8")); } catch { await delay(250); continue; } if (control.stop) break; if ((ordersUi || dashboardUi) && Object.hasOwn(cookies, control.scope)) scope = control.scope; await delay(250); }
    if (dashboardUi) { assert.ok(dashboardReads.some(value => new URLSearchParams(value).get("from") === dashboardFixture.range.from && new URLSearchParams(value).get("to") === dashboardFixture.range.to)); cases.push("browser proxy dashboard fixture-period GET checkpoint; full visual/role/accessibility acceptance remains manual"); }
    else if (ordersUi) { assert.deepEqual(reviewSent, [201]); cases.push("browser proxy: one new review committed with lost response and no replay; manual visual evidence still separate"); }
    else { assert.deepEqual(sent.map(value => value.status), [201, 200]); assert.equal(sent[0].key, sent[1].key); assert.deepEqual(sent[0].body, sent[1].body); assert.equal(await db.order.count({ where: { userId: buyer.user.id } }), 1); }
    browserTested = true;
    if (!ordersUi && !dashboardUi) cases.push("browser proxy: one confirmed test order, response lost then same-key/body replay, real SQL count one; browser cookie authentication not tested");
  }
  assert.equal(await db.payment.count({ where: { order: { user: { email: { in: emails } } } } }), 0);
  console.log(JSON.stringify({ status: "PASS", groups: cases.length, providerCalls: 0, environment: "Next HTTP + PostgreSQL test:55433 + frontend controller", detailsRedacted: true }));
} catch { console.error(JSON.stringify({ status: "FAILED", phase, detailsRedacted: true })); process.exitCode = 1; }
finally {
  if (uiProxy) { uiProxy.closeAllConnections(); await new Promise(done => uiProxy.close(done)); }
  if (child?.pid && child.exitCode === null) { const exit = once(child, "exit"); child.kill(); await exit; }
  if (db) {
    try {
      assert.ok(verified);
      const owners = { user: { email: { in: emails } } }, orders = { order: owners };
      assert.equal(await db.payment.count({ where: orders }), 0, "Provider evidence found; refuse cleanup");
      await db.$transaction(async tx => {
        await tx.discount.updateMany({ where: owners, data: { status: "AVAILABLE", reservedOrderId: null, usedOrderId: null, usedAt: null } });
        if (ordersMode) await tx.rating.deleteMany({ where: { orderItem: orders } });
        await tx.stockReservation.deleteMany({ where: { orderItem: orders } }); await tx.orderStatusHistory.deleteMany({ where: orders }); await tx.orderItem.deleteMany({ where: orders }); await tx.order.deleteMany({ where: owners });
        await tx.discount.deleteMany({ where: owners }); await tx.user.deleteMany({ where: { email: { in: emails } } });
        await tx.product.deleteMany({ where: { id: { in: [...(ordersMode ? [productId, extraProductId] : [productId]), ...dashboardStockIds] }, categoryId } }); await tx.category.deleteMany({ where: { id: categoryId } });
      });
      const keys = [];
      for (let time = Math.floor(started / AUTH_WINDOW_MS) * AUTH_WINDOW_MS; time <= Date.now(); time += AUTH_WINDOW_MS) for (const operation of ["register", "login"]) { keys.push(rateLimitKey(`auth.${operation}.global`, "all", secret, new Date(time))); for (const email of emails) keys.push(rateLimitKey(`auth.${operation}.email`, email, secret, new Date(time))); }
      await db.rateLimit.deleteMany({ where: { key: { in: keys } } });
      cleanupPass = baseline === await fingerprint(); assert.ok(cleanupPass);
      console.log(JSON.stringify({ status: "CLEANUP_PASS", fingerprintTables: tables.length, baselineMatched: cleanupPass, remainingFixtureUsers: 0 }));
    } catch { console.error(JSON.stringify({ status: "FAILED", phase: "targeted_cleanup", detailsRedacted: true })); process.exitCode = 1; }
    finally { await db.$disconnect(); }
  }
  await mkdir(resultDirectory, { recursive: true }); await writeFile(`${resultDirectory}/${uiMode ? "ui-result" : "http-result"}.json`, JSON.stringify({ timestamp: new Date().toISOString(), status: process.exitCode ? "FAILED" : "PASS", phase, cases, cleanupPass, fingerprintTables: tables, providerCalls: 0, browserTested }, null, 2));
}
