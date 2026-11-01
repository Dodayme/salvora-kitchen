/** FE-10 frontend controllers/payloads + real Next HTTP + test DB. Payments are synthetic; no gateway. */
import nextEnv from "@next/env";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createServer as createHttpServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { hash } from "bcryptjs";
import { databaseUrl } from "../src/lib/config/schema.ts";
import { createDatabaseClient } from "../src/lib/db/client.ts";
import { rateLimitKey, AUTH_WINDOW_MS } from "../src/lib/auth/rate-limit.ts";
import { createApiClient, ApiClientError } from "../src/lib/http/client.ts";
import { createAdminAction } from "../src/lib/admin-client/action-controller.ts";
import { adminOrdersPath, decodeAdminOrder, decodeAdminOrders, decodeAdminPayments, emptyOrderFilter, fulfillmentCandidate, fulfillmentPayload, notePayload } from "../src/lib/admin-client/orders-model.ts";
import { decodeBuyerOrder } from "../src/lib/order-client/model.ts";
import { dashboardRange } from "../src/lib/admin-client/dashboard-model.ts";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const run = randomUUID(), prefix = `fe10-${run}`, password = randomBytes(20).toString("base64url"), secret = randomBytes(32).toString("hex"), started = Date.now();
const emails = ["admin", "buyer", "foreign"].map(role => `${prefix}-${role}@example.test`), categoryId = `${prefix}-category`, productIds = [0, 1].map(i => `${prefix}-product-${i}`), orderIds = Array.from({ length: 11 }, (_, i) => `${prefix}-order-${i}`);
const tables = ["User", "Session", "Address", "Category", "Product", "ProductPhoto", "Cart", "CartItem", "Discount", "CheckoutQuote", "Order", "OrderItem", "StockReservation", "OrderStatusHistory", "Payment", "PaymentApplication", "PaymentEvent", "Rating"];
const cases = [], range = dashboardRange("2096-04-15", "2096-04-15"), from = Date.parse(range.from), to = Date.parse(range.to);
const uiMode = process.argv.includes("--ui");
let db, child, proxy, verified = false, baseline, adminId, buyerId, phase = "configuration", cleanupPass = false, uiCheckpoint = false;
async function fingerprint() { const result = {}; for (const table of tables) result[table] = await db.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text),'')) AS digest FROM "${table}" t`); return JSON.stringify(result); }
const safeError = error => ({ category: ["AssertionError", "PrismaClientKnownRequestError", "PrismaClientValidationError", "ApiClientError"].includes(error?.name) ? error.name : "Error", code: typeof error?.code === "string" && /^[A-Z0-9_]{1,64}$/.test(error.code) ? error.code : "UNCLASSIFIED" });
try {
  const url = databaseUrl(process.env, "test"), target = new URL(url); assert.ok(["127.0.0.1", "localhost"].includes(target.hostname) && target.port === "55433");
  db = createDatabaseClient({ NODE_ENV: "test", TEST_DATABASE_URL: url });
  const [identity] = await db.$queryRaw`SELECT current_database()::text AS name, inet_server_port() AS port`;
  assert.equal(identity.name, "salvora_kitchen_test"); assert.equal(identity.port, 55433); verified = true; baseline = await fingerprint();
  await mkdir(".local/fe10", { recursive: true }); await writeFile(`.local/fe10/${run}-baseline.json`, baseline);
  phase = "synthetic fixtures";
  const passwordHash = await hash(password, 12), users = [];
  for (let i = 0; i < emails.length; i++) users.push(await db.user.create({ data: { email: emails[i], name: i === 0 ? "FE10 Private Admin" : "FE10 Buyer", passwordHash, role: i === 0 ? "ADMIN" : "BUYER" } }));
  adminId = users[0].id; buyerId = users[1].id;
  await db.category.create({ data: { id: categoryId, name: prefix, isDemo: true } });
  for (let i = 0; i < productIds.length; i++) await db.product.create({ data: { id: productIds[i], categoryId, name: `Live product ${i}`, description: "Test only", price: 30000, physicalStock: 20, isDemo: true } });
  for (let i = 0; i < orderIds.length; i++) {
    const time = new Date(i === 0 ? from : i === 1 ? to - 1 : i === 2 ? to : i === 3 ? from - 1 : from + i);
    await db.order.create({ data: { id: orderIds[i], number: `${prefix}-${i}`, userId: buyerId, idempotencyKey: randomUUID(), inputHash: randomBytes(32).toString("hex"), status: i === 2 ? "NEEDS_ATTENTION" : "PROCESSING", attentionReason: i === 2 ? "Synthetic attention fixture" : null, recipientName: "Historical recipient", phone: "0800000000", addressLine: "Immutable fixture snapshot", city: "Tanjungpinang", province: "Kepulauan Riau", subtotal: 15000, shippingFee: 10000, total: 25000, shippingLabel: "Delivery manual fixture", createdAt: time, paymentDeadline: new Date(to + 3600000), items: { create: [{ productId: productIds[0], name: "Historical risol", unitPrice: 10000, quantity: 1, lineSubtotal: 10000 }, { productId: productIds[1], name: "Historical extra", unitPrice: 5000, quantity: 1, lineSubtotal: 5000 }] }, history: { create: { actor: "SYSTEM", fromStatus: null, toStatus: i === 2 ? "NEEDS_ATTENTION" : "PROCESSING", note: "Synthetic fixture, not provider proof" } } } });
  }
  async function successful(orderIndex, application = true) {
    const payment = await db.payment.create({ data: { orderId: orderIds[orderIndex], providerOrderId: `F10-${randomUUID()}`, midtransTransactionId: randomUUID(), amount: 25000, status: "SUCCESS", channel: "bank_transfer", createdAt: new Date(from + 1000), paidAt: new Date(from + 2000), expiresAt: new Date(to + 3600000) } });
    if (application) await db.paymentApplication.create({ data: { orderId: orderIds[orderIndex], paymentId: payment.id } });
    const items = await db.orderItem.findMany({ where: { orderId: orderIds[orderIndex] } });
    for (const item of items) await db.stockReservation.create({ data: { orderItemId: item.id, status: "CONSUMED", createdAt: new Date(from), expiresAt: new Date(to + 3600000), finalizedAt: new Date(from + 2000) } });
    return payment;
  }
  for (let i = 0; i < 11; i++) await db.payment.create({ data: { orderId: orderIds[0], providerOrderId: `F10-${randomUUID()}`, amount: 25000, status: "FAILED", channel: "credit_card", createdAt: new Date(i === 10 ? to : from + i), expiresAt: new Date(to + 3600000) } });
  await successful(0); await successful(1); await successful(3, false);
  await db.payment.create({ data: { orderId: orderIds[1], providerOrderId: `F10-${randomUUID()}`, amount: 25000, status: "PENDING", channel: "bank_transfer", createdAt: new Date(from), expiresAt: new Date(to + 3600000) } });
  const socket = createServer(); socket.listen(0, "127.0.0.1"); await once(socket, "listening"); const port = socket.address().port; await new Promise(done => socket.close(done)); const origin = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { windowsHide: true, stdio: "ignore", env: { ...process.env, NODE_ENV: "test", DATABASE_URL: "", TEST_DATABASE_URL: url, AUTH_SECRET: secret, NEXT_PUBLIC_APP_URL: origin, MIDTRANS_IS_PRODUCTION: "false", MIDTRANS_SERVER_KEY: "", NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "", MIDTRANS_WEBHOOK_URL: "" } });
  let spawnFailed = false; child.on("error", () => { spawnFailed = true; }); phase = "startup";
  for (let n = 0; ; n++) { assert.ok(n < 150 && !spawnFailed && child.exitCode === null); try { if ((await fetch(origin, { signal: AbortSignal.timeout(500) })).ok) break; } catch { /* bounded startup */ } await delay(100); }
  const statuses = [];
  function client() { let cookie = ""; const request = createApiClient(async (relative, options) => {
    const pathname = new URL(relative, origin).pathname;
    assert.ok(pathname === "/api/auth/login" || options.method === "GET" && (pathname === "/api/admin/orders" || pathname === "/api/admin/payments" || /^\/api\/(admin\/)?orders\/[A-Za-z0-9_-]+$/.test(pathname)) || ["PATCH", "POST"].includes(options.method) && /^\/api\/admin\/orders\/[A-Za-z0-9_-]+\/(status|notes)$/.test(pathname), "Only local order administration/auth paths permitted");
    const headers = new Headers(options.headers); if (!headers.has("Origin")) headers.set("Origin", origin); if (cookie) headers.set("Cookie", cookie);
    const response = await fetch(origin + relative, { ...options, headers });
    if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    if (options.method === "PATCH" || options.method === "POST" && pathname.endsWith("/notes")) statuses.push(response.status);
    return response;
  }); return Object.assign(request, { cookie: () => cookie }); }
  const admin = client(), buyer = client(), foreign = client(), anon = client();
  for (const [request, email] of [[admin, emails[0]], [buyer, emails[1]], [foreign, emails[2]]]) await request("/api/auth/login", { method: "POST", json: { email, password } });
  const errorCode = async (promise, status, code) => { await assert.rejects(promise, error => error instanceof ApiClientError && error.status === status && (!code || error.code === code)); };
  const detail = () => admin(`/api/admin/orders/${orderIds[0]}`, { decode: value => decodeAdminOrder(value, orderIds[0]) });
  const mutate = async (operation, expected = "saved") => { const action = createAdminAction({ request: admin, authorized: () => true }); let data; await action.run(operation, value => { data = value; }); assert.equal(action.getSnapshot().phase, expected); return { action, data }; };
  const fulfill = (index, input) => request => request(`/api/admin/orders/${orderIds[index]}/status`, { method: "PATCH", json: input, decode: value => decodeAdminOrder(value, orderIds[index]) });
  phase = "access and origin";
  await errorCode(anon("/api/admin/orders"), 401); await errorCode(buyer("/api/admin/payments"), 403); await errorCode(buyer(`/api/admin/orders/${orderIds[0]}`), 403); await errorCode(foreign(`/api/orders/${orderIds[0]}`), 404);
  await errorCode(admin(`/api/admin/orders/${orderIds[0]}/status`, { method: "PATCH", headers: { Origin: "https://wrong.example.test" }, json: { status: "SHIPPED", expectedStatus: "PROCESSING" } }), 403);
  cases.push("anonymous 401/buyer admin 403/foreign owner 404 and cross-Origin mutation 403");
  const stable = async () => ({ payments: await db.payment.findMany({ where: { orderId: { in: orderIds } }, orderBy: { id: "asc" } }), applications: await db.paymentApplication.findMany({ where: { orderId: { in: orderIds } }, orderBy: { orderId: "asc" } }), products: await db.product.findMany({ where: { id: { in: productIds } }, orderBy: { id: "asc" } }), reservations: await db.stockReservation.findMany({ where: { orderItem: { orderId: { in: orderIds } } }, orderBy: { orderItemId: "asc" } }) });
  const stableBefore = await stable();
  phase = "lists pagination and filters";
  const filter = { ...emptyOrderFilter, q: prefix }, page1 = await admin(adminOrdersPath("orders", 1, filter), { decode: decodeAdminOrders }), page2 = await admin(adminOrdersPath("orders", 2, filter), { decode: decodeAdminOrders });
  assert.equal(page1.data.length, 10); assert.equal(page2.data.length, 1); assert.equal(page1.meta.pagination.total, 11); assert.ok(!page2.data.some(row => page1.data.some(other => other.id === row.id)));
  const period = await admin(adminOrdersPath("orders", 1, { ...filter, fromDate: range.fromDate, toDate: range.toDate }), { decode: decodeAdminOrders }); assert.equal(period.meta.pagination.total, 9); assert.ok(period.data.some(row => row.id === orderIds[0])); assert.ok(period.data.some(row => row.id === orderIds[1])); assert.ok(!period.data.some(row => row.id === orderIds[2] || row.id === orderIds[3]));
  const historical = await admin(adminOrdersPath("orders", 1, { ...filter, paymentStatus: "FAILED", channel: "credit_card" }), { decode: decodeAdminOrders }); assert.equal(historical.data.length, 1); assert.equal(historical.data[0].paymentStatus, "SUCCESS"); assert.ok(historical.data[0].channels.includes("credit_card"));
  assert.equal((await admin(adminOrdersPath("orders", 1, { ...filter, paymentStatus: "FAILED", channel: "bank_transfer" }), { decode: decodeAdminOrders })).data.length, 0);
  assert.equal((await admin(adminOrdersPath("orders", 1, { ...filter, status: "NEEDS_ATTENTION" }), { decode: decodeAdminOrders })).data[0].id, orderIds[2]);
  cases.push("orders 10+1; inclusive from/exclusive to WIB period 9; historical attempt filter differs from SUCCESS summary; same-attempt status/channel and attention filter");
  const payFilter = { ...emptyOrderFilter, orderId: orderIds[0] }, pay1 = await admin(adminOrdersPath("payments", 1, payFilter), { decode: decodeAdminPayments }), pay2 = await admin(adminOrdersPath("payments", 2, payFilter), { decode: decodeAdminPayments });
  assert.equal(pay1.data.length, 10); assert.equal(pay2.data.length, 2); assert.equal(pay1.meta.pagination.total, 12); assert.ok(!pay2.data.some(row => pay1.data.some(other => other.id === row.id)));
  assert.equal((await admin(adminOrdersPath("payments", 1, { ...payFilter, fromDate: range.fromDate, toDate: range.toDate }), { decode: decodeAdminPayments })).meta.pagination.total, 11);
  assert.equal((await admin(adminOrdersPath("payments", 1, { ...payFilter, paymentStatus: "SUCCESS", channel: "bank_transfer" }), { decode: decodeAdminPayments })).meta.pagination.total, 1);
  cases.push("payments 10+2 attempts; orderId/status/exact channel/createdAt exclusive upper boundary; no provider calls");
  phase = "detail snapshot and blocked eligibility";
  const original = (await detail()).data; assert.equal(original.items.length, 2); assert.equal(original.payments.length, 12); assert.equal(original.address.addressLine, "Immutable fixture snapshot"); assert.equal(original.items.find(row => row.productId === productIds[0]).unitPrice, 10000); assert.equal(original.total, 25000); assert.equal(fulfillmentCandidate(original), "SHIPPED");
  for (const index of [1, 3]) {
    const blocked = (await admin(`/api/admin/orders/${orderIds[index]}`, { decode: decodeAdminOrder })).data;
    if (index === 1) assert.equal(fulfillmentCandidate(blocked), null); else assert.equal(fulfillmentCandidate(blocked), "SHIPPED");
    const result = await mutate(fulfill(index, fulfillmentPayload("PROCESSING", "SHIPPED", "", false).data), "needsReload"); assert.equal(result.action.getSnapshot().error.code, "ORDER_PAYMENT_NOT_FULFILLABLE");
  }
  const attention = (await admin(`/api/admin/orders/${orderIds[2]}`, { decode: decodeAdminOrder })).data; assert.equal(fulfillmentCandidate(attention), null);
  await mutate(request => request(`/api/admin/orders/${orderIds[2]}/notes`, { method: "POST", json: notePayload("Synthetic handling note").data, decode: decodeAdminOrder }));
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: orderIds[2] } })).status, "NEEDS_ATTENTION");
  cases.push("two-item immutable snapshot; active attempt and missing application rejected by server; NEEDS_ATTENTION note allowed without fulfillment");
  phase = "concurrent shipment and receipt confirmation";
  const a = createAdminAction({ request: admin, authorized: () => true }), b = createAdminAction({ request: admin, authorized: () => true });
  await Promise.all([a.run(fulfill(0, fulfillmentPayload("PROCESSING", "SHIPPED", "Ship fixture A", false).data), () => {}), b.run(fulfill(0, fulfillmentPayload("PROCESSING", "SHIPPED", "Ship fixture B", false).data), () => {})]);
  assert.deepEqual([a.getSnapshot().phase, b.getSnapshot().phase].sort(), ["needsReload", "saved"].sort()); assert.equal([a, b].find(action => action.getSnapshot().phase === "needsReload").getSnapshot().error.code, "ORDER_STATUS_CONFLICT");
  assert.equal(await db.orderStatusHistory.count({ where: { orderId: orderIds[0], toStatus: "SHIPPED" } }), 1);
  const historyCount = await db.orderStatusHistory.count({ where: { orderId: orderIds[0] } });
  await errorCode(admin(`/api/admin/orders/${orderIds[0]}/status`, { method: "PATCH", json: { status: "COMPLETED", expectedStatus: "SHIPPED", note: "No checkbox" } }), 422, "RECEIPT_CONFIRMATION_REQUIRED"); assert.equal(await db.orderStatusHistory.count({ where: { orderId: orderIds[0] } }), historyCount);
  const shipped = (await detail()).data; assert.equal(shipped.status, "SHIPPED");
  const completed = await mutate(fulfill(0, fulfillmentPayload(shipped.status, "COMPLETED", "Penerimaan fixture dikonfirmasi manual.", true).data)); assert.equal(completed.data.status, "COMPLETED"); assert.equal(fulfillmentCandidate(completed.data), null);
  await errorCode(admin(`/api/admin/orders/${orderIds[0]}/status`, { method: "PATCH", json: fulfillmentPayload("SHIPPED", "COMPLETED", "Stale completion", true).data }), 409, "ORDER_STATUS_CONFLICT");
  assert.equal(await db.orderStatusHistory.count({ where: { orderId: orderIds[0], toStatus: "COMPLETED" } }), 1);
  cases.push("two simultaneous shipping requests: one success/one status conflict and one history; missing receipt 422 leaves history unchanged; explicit manual completion once and stale repeat 409");
  phase = "private note lost response and buyer privacy";
  let calls = 0; const lost = await mutate(async request => { calls++; await request(`/api/admin/orders/${orderIds[0]}/notes`, { method: "POST", json: notePayload("<script>PRIVATE-FE10-NOTE</script>").data, decode: decodeAdminOrder }); throw new ApiClientError(0, "NETWORK_ERROR", "", "network"); }, "needsReload");
  await lost.action.run(async () => { calls++; throw Error("No replay"); }, () => {}); assert.equal(calls, 1);
  const latest = (await detail()).data; assert.equal(latest.history.filter(row => row.note?.includes("PRIVATE-FE10")).length, 1); assert.ok(latest.history.some(row => row.actorUser?.name === "FE10 Private Admin"));
  const rawBuyer = (await buyer(`/api/orders/${orderIds[0]}`)).data; assert.ok(!JSON.stringify(rawBuyer).includes("PRIVATE-FE10")); assert.ok(!JSON.stringify(rawBuyer).includes("actorUser")); assert.ok(!JSON.stringify(rawBuyer).includes("FE10 Private Admin"));
  const buyerDetail = decodeBuyerOrder(rawBuyer); assert.equal(buyerDetail.status, "COMPLETED"); assert.ok(buyerDetail.items.every(row => row.canReview)); assert.equal(buyerDetail.history.filter(row => row.actor === "ADMIN").length, 2); assert.ok(buyerDetail.history.filter(row => row.actor === "ADMIN").every(row => row.note === null));
  assert.deepEqual(latest.items, original.items); assert.deepEqual(latest.address, original.address); assert.equal(latest.total, original.total); assert.equal(latest.paymentDeadline, original.paymentDeadline); assert.deepEqual(await stable(), stableBefore);
  cases.push("committed private note response lost without replay; admin sees actor/note, buyer sees only transitions with null admin notes; snapshot/payment/application/inventory/reservations unchanged by admin operations");
  phase = "revoked session"; await db.session.deleteMany({ where: { userId: adminId } }); await errorCode(admin("/api/admin/orders"), 401); cases.push("revoked admin session denied; gateway/worker endpoints absent from allowlist");
  if (uiMode) {
    phase = "browser fixture preparation";
    await successful(4);
    await db.payment.create({ data: { orderId: orderIds[4], providerOrderId: `F10-${randomUUID()}`, amount: 25000, status: "FAILED", channel: "credit_card", createdAt: new Date(from), expiresAt: new Date(to + 3600000) } });
    await admin("/api/auth/login", { method: "POST", json: { email: emails[0], password } });
    let scope = "admin", loseNextNote = false; const cookies = { admin: admin.cookie(), buyer: buyer.cookie(), anonymous: "" }, sent = [];
    const controlPath = ".local/fe10/ui-control.json";
    await writeFile(controlPath, JSON.stringify({ scope, loseNextNote, stop: false }));
    proxy = createHttpServer(async (req, res) => {
      try {
        const url = new URL(req.url, origin), pathname = url.pathname;
        const fixtureDetail = orderIds.some(id => pathname === `/api/admin/orders/${id}`);
        const mutation = req.method === "PATCH" && pathname === `/api/admin/orders/${orderIds[4]}/status` || req.method === "POST" && pathname === `/api/admin/orders/${orderIds[4]}/notes`;
        const allowed = req.method === "GET" && (pathname === "/api/auth/session" || pathname === "/api/admin/orders" || pathname === "/api/admin/payments" || fixtureDetail) || req.method === "POST" && pathname === "/api/auth/logout" || mutation;
        if (pathname.startsWith("/api/") && !allowed) { res.writeHead(403); res.end(); return; }
        // Lists are restricted to fresh fixture IDs; user data/provider fixtures never enter the UI proxy.
        if (pathname === "/api/admin/orders") { const q = url.searchParams.get("q"); if (!q) url.searchParams.set("q", prefix); else if (!q.includes(prefix)) { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ success: true, data: [], meta: { requestId: randomUUID(), pagination: { page: Number(url.searchParams.get("page") ?? 1), pageSize: 10, total: 0, totalPages: 0 } } })); return; } }
        if (pathname === "/api/admin/payments") { const id = url.searchParams.get("orderId"); if (id && !orderIds.includes(id)) { res.writeHead(403); res.end(); return; } if (!id) url.searchParams.set("orderId", orderIds[4]); }
        const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; assert.ok(size <= 65536); chunks.push(chunk); }
        const body = Buffer.concat(chunks), headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) if (!["host", "cookie", "origin", "content-length", "connection"].includes(key) && typeof value === "string") headers.set(key, value);
        headers.set("Origin", origin); headers.set("Cookie", cookies[scope]);
        const upstream = await fetch(origin + url.pathname + url.search, { method: req.method, headers, ...(body.length ? { body } : {}), redirect: "manual" });
        if (mutation) sent.push({ kind: pathname.endsWith("/notes") ? "note" : "status", status: upstream.status });
        const payload = Buffer.from(await upstream.arrayBuffer());
        if (mutation && pathname.endsWith("/notes") && upstream.ok && loseNextNote) { loseNextNote = false; await writeFile(controlPath, JSON.stringify({ scope, loseNextNote, stop: false })); res.writeHead(503, { "Content-Type": "application/json" }); res.end(JSON.stringify({ success: false, error: { code: "FIXTURE_RESPONSE_LOST", message: "Respons fixture sengaja dihilangkan setelah commit." }, meta: { requestId: randomUUID() } })); return; }
        const outgoing = Object.fromEntries(upstream.headers); for (const key of ["content-encoding", "content-length", "transfer-encoding", "set-cookie"]) delete outgoing[key]; res.writeHead(upstream.status, outgoing); res.end(payload);
      } catch { res.writeHead(503); res.end(); }
    });
    proxy.listen(0, "127.0.0.1"); await once(proxy, "listening");
    console.log(JSON.stringify({ status: "UI_READY", origin: `http://127.0.0.1:${proxy.address().port}`, page: `/admin/pesanan/${orderIds[4]}`, fixturePrefix: prefix, controlPath, scope: "new test fixtures only, injected cookie; gateway paths blocked" }));
    phase = "browser checkpoint"; const until = Date.now() + 20 * 60000;
    for (;;) { assert.ok(Date.now() < until, "UI timeout"); const control = JSON.parse(await readFile(controlPath, "utf8")); if (control.stop) break; if (Object.hasOwn(cookies, control.scope)) scope = control.scope; loseNextNote = control.loseNextNote === true; await delay(250); }
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: orderIds[4] } })).status, "COMPLETED");
    assert.deepEqual(sent, [{ kind: "status", status: 200 }, { kind: "status", status: 200 }, { kind: "note", status: 201 }]);
    uiCheckpoint = true; cases.push("browser proxy API checkpoint: SHIPPED/COMPLETED and one note; visual/keyboard/responsive observations documented separately");
  }
} catch (error) { console.error(JSON.stringify({ result: "FAIL", phase, ...safeError(error), detailsRedacted: true })); process.exitCode = 1; }
finally {
  if (proxy) { proxy.closeAllConnections(); await new Promise(done => proxy.close(done)); }
  if (child && child.exitCode === null) { const exit = once(child, "exit"); child.kill(); await exit; }
  if (db && verified && baseline !== undefined) {
    try {
      const owners = { user: { email: { in: emails } } }, orders = { order: owners };
      await db.$transaction(async tx => {
        await tx.rating.deleteMany({ where: { orderItem: orders } }); await tx.paymentEvent.deleteMany({ where: { payment: orders } }); await tx.paymentApplication.deleteMany({ where: orders }); await tx.payment.deleteMany({ where: orders });
        await tx.stockReservation.deleteMany({ where: { orderItem: orders } }); await tx.orderStatusHistory.deleteMany({ where: orders }); await tx.orderItem.deleteMany({ where: orders }); await tx.order.deleteMany({ where: owners });
        await tx.discount.deleteMany({ where: owners }); await tx.user.deleteMany({ where: { email: { in: emails } } });
        await tx.product.deleteMany({ where: { id: { in: productIds }, categoryId } }); await tx.category.deleteMany({ where: { id: categoryId } });
      });
      const keys = []; for (let time = Math.floor(started / AUTH_WINDOW_MS) * AUTH_WINDOW_MS; time <= Date.now(); time += AUTH_WINDOW_MS) { keys.push(rateLimitKey("auth.login.global", "all", secret, new Date(time))); for (const email of emails) keys.push(rateLimitKey("auth.login.email", email, secret, new Date(time))); }
      await db.rateLimit.deleteMany({ where: { key: { in: keys } } }); assert.equal(await fingerprint(), baseline); assert.equal(await db.user.count({ where: { email: { in: emails } } }), 0); cleanupPass = true;
    } catch (error) { console.error(JSON.stringify({ cleanup: "FAIL", ...safeError(error), detailsRedacted: true })); process.exitCode = 1; }
  }
  if (db) await db.$disconnect();
  const result = { result: process.exitCode ? "FAIL" : "PASS", timestamp: new Date().toISOString(), run, phase, target: "salvora_kitchen_test:55433", groups: cases.length, cases, cleanup: cleanupPass ? "PASS" : "FAIL", fingerprintTables: tables.length, remainingFixtureUsers: cleanupPass ? 0 : null, paymentFixtures: "synthetic; not provider verification", providerCalls: 0, browserTested: uiCheckpoint, browserScope: uiCheckpoint ? "proxy API checkpoint plus separate manual evidence; not full acceptance" : "none" };
  await mkdir(".local/fe10", { recursive: true }); await writeFile(`.local/fe10/${run}-result.json`, JSON.stringify(result, null, 2)); await writeFile(`.local/fe10/${uiMode ? "ui" : "http"}-result.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
}
