import nextEnv from "@next/env";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { hash } from "bcryptjs";
import { databaseUrl } from "../src/lib/config/schema.ts";
import { createDatabaseClient } from "../src/lib/db/client.ts";
import { rateLimitKey, AUTH_WINDOW_MS } from "../src/lib/auth/rate-limit.ts";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
const suffix = randomUUID(), password = randomBytes(20).toString("base64url"), secret = randomBytes(32).toString("hex");
const origin = "https://buyer-http.example.test", started = Date.now();
const emails = [0, 1, 2].map(index => `buyer-http-${index}-${suffix}@example.test`);
let db, child, categoryId, productId, phase = "configuration";
try {
  const url = databaseUrl(process.env, "test");
  db = createDatabaseClient({ NODE_ENV: "test", TEST_DATABASE_URL: url });
  const passwordHash = await hash(password, 12);
  for (const [index, email] of emails.entries()) await db.user.create({ data: { name: "Buyer HTTP Fixture", email, passwordHash, role: index === 2 ? "ADMIN" : "BUYER" } });
  categoryId = (await db.category.create({ data: { name: `Buyer HTTP ${suffix}` } })).id;
  productId = (await db.product.create({ data: { categoryId, name: "Buyer HTTP product", description: "Fixture", price: 10000, physicalStock: 5 } })).id;
  const socket = createServer(); socket.listen(0, "127.0.0.1"); await once(socket, "listening");
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env: { ...process.env, NODE_ENV: "test", DATABASE_URL: "", TEST_DATABASE_URL: url, AUTH_SECRET: secret, NEXT_PUBLIC_APP_URL: origin, MIDTRANS_IS_PRODUCTION: "false", MIDTRANS_SERVER_KEY: "", NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "", MIDTRANS_WEBHOOK_URL: "" }, windowsHide: true, stdio: "ignore" });
  let spawnError; child.on("error", error => { spawnError = error; });
  const base = `http://127.0.0.1:${port}`;
  phase = "startup";
  let ready = false;
  for (let n = 0; n < 150; n++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error("Server exited");
    try { if ((await fetch(base, { signal: AbortSignal.timeout(500) })).status === 200) { ready = true; break; } } catch { /* startup */ }
    await delay(100);
  }
  assert.ok(ready);
  const send = (path, { data, method, token, key, requestOrigin = origin } = {}) => fetch(base + path, { method: method ?? (data === undefined ? "GET" : "POST"), headers: { ...(data === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Cookie: `salvora_session=${token}` } : {}), ...(key ? { "Idempotency-Key": key } : {}), ...(requestOrigin ? { Origin: requestOrigin } : {}) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const json = async (response, status = 200) => { assert.equal(response.status, status); assert.equal(response.headers.get("cache-control"), "no-store"); const body = await response.json(); assert.equal(body.success, status < 400); assert.ok(!JSON.stringify(body).includes(secret) && !JSON.stringify(body).includes(password)); return body; };
  const tokens = [];
  phase = "sessions and access guards";
  for (const [index, email] of emails.entries()) {
    phase = `fixture login ${index}`;
    const response = await send("/api/auth/login", { data: { email, password } }); await json(response);
    const token = response.headers.get("set-cookie")?.match(/salvora_session=([a-f0-9]{64})/)?.[1]; assert.ok(token); tokens.push(token);
  }
  for (const path of ["/api/cart", "/api/addresses"]) {
    phase = `access guard ${path}`;
    await json(await send(path), 401); await json(await send(path, { token: tokens[2] }), 403);
  }
  phase = "empty cart and private headers";
  const empty = await send("/api/cart", { token: tokens[0] }); assert.ok(empty.headers.get("vary")?.split(/,\s*/).includes("Cookie")); assert.deepEqual((await json(empty)).data, { id: null, items: [], subtotal: 0 });
  phase = "address CRUD and ownership";
  const input = { recipientName: "Fixture", phone: "081200000000", addressLine: "Jalan Test 1", city: "Test", province: "Test" };
  await json(await send("/api/addresses", { token: tokens[0], data: input, requestOrigin: "https://attacker.example.test" }), 403);
  await json(await send("/api/addresses", { token: tokens[0], data: { ...input, userId: "foreign" } }), 422);
  const address = (await json(await send("/api/addresses", { token: tokens[0], data: input }), 201)).data;
  assert.ok(!("userId" in address));
  assert.equal((await json(await send("/api/addresses", { token: tokens[1] }))).data.length, 0);
  await json(await send(`/api/addresses/${address.id}`, { token: tokens[1], method: "PATCH", data: { city: "Other" } }), 404);
  await json(await send(`/api/addresses/${address.id}`, { token: tokens[1], method: "DELETE", data: {} }), 404);
  assert.equal((await json(await send(`/api/addresses/${address.id}`, { token: tokens[0], method: "PATCH", data: { notes: "Call first" } }))).data.notes, "Call first");
  await json(await send(`/api/addresses/${address.id}`, { token: tokens[0], method: "DELETE", data: {} }));
  phase = "cart merging, replacement and ownership";
  const add = quantity => send("/api/cart/items", { token: tokens[0], data: { productId, quantity } });
  await json(await add(0), 422); await json(await add(-1), 422); await json(await add(1.5), 422);
  await json(await add(2), 201);
  const cart = (await json(await add(1), 201)).data; assert.equal(cart.items.length, 1); assert.equal(cart.subtotal, 30000);
  const id = cart.items[0].id;
  await json(await send(`/api/cart/items/${id}`, { token: tokens[1], method: "PATCH", data: { quantity: 1 } }), 404);
  await json(await send(`/api/cart/items/${id}`, { token: tokens[1], method: "DELETE", data: {} }), 404);
  await json(await add(3), 409);
  assert.equal((await json(await send(`/api/cart/items/${id}`, { token: tokens[0], method: "PATCH", data: { quantity: 2 } }))).data.subtotal, 20000);
  phase = "live price/stock and removal";
  await db.product.update({ where: { id: productId }, data: { price: 15000, physicalStock: 1 } });
  const changed = (await json(await send("/api/cart", { token: tokens[0] }))).data;
  assert.equal(changed.subtotal, 30000); assert.equal(changed.items[0].isAvailable, false);
  await db.product.update({ where: { id: productId }, data: { isActive: false } });
  await json(await add(1), 409);
  assert.equal((await json(await send(`/api/cart/items/${id}`, { token: tokens[0], method: "DELETE", data: {} }))).data, null);
  assert.equal((await json(await send("/api/cart", { token: tokens[0] }))).data.subtotal, 0);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: productId } })).reservedStock, 0);
  phase = "checkout origin/role/ownership and delivery";
  await db.product.update({ where: { id: productId }, data: { isActive: true, price: 10003, physicalStock: 5 } });
  await json(await add(1), 201);
  const localAddress = (await json(await send("/api/addresses", { token: tokens[0], data: { ...input, city: "Kota Tanjungpinang", province: "Kepulauan Riau" } }), 201)).data;
  const quoteData = { addressId: localAddress.id };
  await json(await send("/api/checkout/quote", { data: quoteData }), 401);
  await json(await send("/api/checkout/quote", { data: quoteData, token: tokens[2] }), 403);
  await json(await send("/api/checkout/quote", { data: quoteData, token: tokens[1] }), 404);
  await json(await send("/api/checkout/quote", { data: quoteData, token: tokens[0], requestOrigin: "https://evil.example.test" }), 403);
  await json(await send("/api/checkout/quote", { data: { ...quoteData, total: 1 }, token: tokens[0] }), 422);
  const q = (await json(await send("/api/checkout/quote", { token: tokens[0], data: quoteData }), 201)).data;
  assert.equal(q.total, 18003); assert.equal(q.shippingFee, 10000);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: productId } })).reservedStock, 0);
  await json(await send("/api/orders", { token: tokens[1], data: { quoteId: q.quoteId }, key: randomUUID() }), 404);
  await json(await send("/api/orders", { token: tokens[0], data: { quoteId: q.quoteId } }), 422);
  phase = "stale quote and idempotent order";
  await db.product.update({ where: { id: productId }, data: { price: 20003 } });
  await json(await send("/api/orders", { token: tokens[0], data: { quoteId: q.quoteId }, key: randomUUID() }), 409);
  const fresh = (await json(await send("/api/checkout/quote", { token: tokens[0], data: quoteData }), 201)).data;
  const key = randomUUID(), orderInput = { quoteId: fresh.quoteId };
  const order = (await json(await send("/api/orders", { token: tokens[0], data: orderInput, key }), 201)).data;
  assert.equal(order.total, 26003); assert.equal(order.status, "AWAITING_PAYMENT");
  assert.equal(new Date(order.paymentDeadline) - new Date(order.createdAt), 3600000);
  const replay = (await json(await send("/api/orders", { token: tokens[0], data: orderInput, key }))).data;
  assert.equal(replay.id, order.id); assert.equal(replay.paymentDeadline, order.paymentDeadline);
  await json(await send("/api/orders", { token: tokens[0], data: { quoteId: q.quoteId }, key }), 409);
  assert.equal((await json(await send("/api/cart", { token: tokens[0] }))).data.items.length, 0);
  assert.equal((await db.product.findUniqueOrThrow({ where: { id: productId } })).reservedStock, 1);
  assert.equal((await db.discount.findUniqueOrThrow({ where: { userId: (await db.user.findUniqueOrThrow({ where: { email: emails[0] } })).id } })).reservedOrderId, order.id);
  assert.equal((await db.stockReservation.findUniqueOrThrow({ where: { orderItemId: order.items[0].id } })).expiresAt.toISOString(), order.paymentDeadline);
  assert.equal(await db.payment.count({ where: { orderId: order.id } }), 0);
  phase = "payment HTTP guards and missing merchant configuration";
  const payPath = `/api/orders/${order.id}/payments`;
  await json(await send(payPath, { data: {} }), 401);
  await json(await send(payPath, { data: {}, token: tokens[2] }), 403);
  await json(await send(payPath, { data: {}, token: tokens[1] }), 404);
  await json(await send(payPath, { data: { amount: 1 }, token: tokens[0] }), 422);
  await json(await send(payPath, { data: {}, token: tokens[0], requestOrigin: "https://evil.example.test" }), 403);
  await json(await send(payPath, { data: {}, token: tokens[0] }), 503);
  assert.equal(await db.payment.count({ where: { orderId: order.id } }), 0);
  const finish = await fetch(`${base}/payment/finish?transaction_status=settlement&order_id=${order.providerOrderId ?? order.id}`);
  assert.equal(finish.status, 200);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "AWAITING_PAYMENT");
  console.log("Buyer/checkout HTTP verified: sessions/guards, address/cart ownership, live price/stock, quote review, stale rejection, 60-minute deadline, idempotent order, atomic stock/voucher reservations and cart removal; no payment provider called.");
} catch {
  console.error(`Buyer HTTP verification failed at: ${phase}. No credentials or tokens printed.`); process.exitCode = 1;
} finally {
  if (child?.pid && child.exitCode === null) { const exit = once(child, "exit"); child.kill(); await exit; }
  if (db) {
    try {
      const fixtureOwners = { user: { email: { in: emails } } };
      await db.discount.updateMany({ where: fixtureOwners, data: { status: "AVAILABLE", reservedOrderId: null, usedOrderId: null, usedAt: null } });
      const fixtureOrders = { user: { email: { in: emails } } };
      await db.stockReservation.deleteMany({ where: { orderItem: { order: fixtureOrders } } });
      await db.orderStatusHistory.deleteMany({ where: { order: fixtureOrders } });
      await db.orderItem.deleteMany({ where: { order: fixtureOrders } });
      await db.order.deleteMany({ where: fixtureOrders });
      await db.discount.deleteMany({ where: { user: { email: { in: emails } } } });
      await db.user.deleteMany({ where: { email: { in: emails } } });
      if (productId) await db.product.delete({ where: { id: productId } });
      if (categoryId) await db.category.delete({ where: { id: categoryId } });
      const keys = [];
      for (let time = Math.floor(started / AUTH_WINDOW_MS) * AUTH_WINDOW_MS; time <= Date.now(); time += AUTH_WINDOW_MS) {
        keys.push(rateLimitKey("auth.login.global", "all", secret, new Date(time)));
        for (const email of emails) keys.push(rateLimitKey("auth.login.email", email, secret, new Date(time)));
      }
      await db.rateLimit.deleteMany({ where: { key: { in: keys } } });
    } catch { console.error("Cleanup fixture pembeli/checkout belum lengkap; tidak menghapus data lain."); process.exitCode = 1; }
    finally { await db.$disconnect(); }
  }
}
