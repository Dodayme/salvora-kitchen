import nextEnv from "@next/env";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { databaseUrl } from "../src/lib/config/schema.ts";
import { createDatabaseClient } from "../src/lib/db/client.ts";
import { sessionDigest } from "../src/lib/auth/session.ts";
import { rateLimitKey } from "../src/lib/auth/rate-limit.ts";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
const secret = randomBytes(32).toString("hex"), origin = "https://reconcile-http.example.test", users = [], orders = [], keys = [];
let db, child, productId, categoryId, stage = "configuration";
try {
  const url = databaseUrl(process.env, "test"); db = createDatabaseClient({ NODE_ENV: "test", TEST_DATABASE_URL: url });
  const tokens = [];
  for (let index = 0; index < 3; index++) {
    const user = await db.user.create({ data: { name: "HTTP Reconcile Fixture", email: `reconcile-http-${randomUUID()}@example.test`, role: index === 2 ? "ADMIN" : "BUYER", passwordHash: "not-a-login-hash" } }); users.push(user.id);
    const token = randomBytes(32).toString("hex"); tokens.push(token);
    await db.session.create({ data: { tokenDigest: sessionDigest(token, secret), userId: user.id, expiresAt: new Date(Date.now() + 3600000) } });
  }
  categoryId = (await db.category.create({ data: { name: `Reconcile HTTP ${randomUUID()}` } })).id;
  productId = (await db.product.create({ data: { categoryId, name: "Fixture", description: "Fixture", price: 10000, physicalStock: 5, reservedStock: 2 } })).id;
  for (const past of [false, true]) {
    const id = randomUUID(), createdAt = new Date(Date.now() - (past ? 3660000 : 1000)), paymentDeadline = new Date(createdAt.getTime() + 3600000);
    await db.order.create({ data: { id, number: id, userId: users[0], idempotencyKey: id, inputHash: "a".repeat(64), recipientName: "Fixture", phone: "081200000000", addressLine: "Fixture", city: "Tanjungpinang", province: "Kepulauan Riau", subtotal: 10000, shippingFee: 10000, total: 20000, shippingLabel: "Manual delivery", createdAt, paymentDeadline, items: { create: { productId, name: "Fixture", unitPrice: 10000, quantity: 1, lineSubtotal: 10000, reservation: { create: { expiresAt: paymentDeadline, createdAt } } } } } }); orders.push(id);
  }
  const socket = createServer(); socket.listen(0, "127.0.0.1"); await once(socket, "listening"); const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { windowsHide: true, stdio: "ignore", env: { ...process.env, NODE_ENV: "test", DATABASE_URL: "", TEST_DATABASE_URL: url, AUTH_SECRET: secret, NEXT_PUBLIC_APP_URL: origin, MIDTRANS_SERVER_KEY: "SB-Mid-server-http-fixture", NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "SB-Mid-client-http-fixture", MIDTRANS_IS_PRODUCTION: "false", MIDTRANS_WEBHOOK_URL: "", PAYMENT_EXPIRY_MINUTES: "60" } });
  let spawnError; child.on("error", error => { spawnError = error; }); const base = `http://127.0.0.1:${port}`; stage = "startup";
  let ready = false;
  for (let n = 0; n < 150; n++) { if (spawnError || child.exitCode !== null) throw new Error("Child failed"); try { if ((await fetch(base, { signal: AbortSignal.timeout(500) })).status === 200) { ready = true; break; } } catch {} await delay(100); } assert.ok(ready);
  const send = (id, token, requestOrigin = origin, data = {}) => fetch(`${base}/api/orders/${id}/payments/reconcile`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Cookie: `salvora_session=${token}` } : {}), ...(requestOrigin ? { Origin: requestOrigin } : {}) }, body: JSON.stringify(data) });
  const expectResponse = async (response, status) => { assert.equal(response.status, status); assert.equal(response.headers.get("cache-control"), "no-store"); assert.ok(response.headers.get("vary")?.includes("Cookie")); const text = await response.text(); assert.ok(!text.includes(secret) && tokens.every(token => !text.includes(token)) && !text.includes("not-a-login-hash")); return JSON.parse(text); };
  stage = "auth, origin, payload and ownership";
  await expectResponse(await send(orders[0]), 401);
  await expectResponse(await send(orders[0], tokens[0], "https://attacker.example.test"), 403);
  await expectResponse(await send(orders[0], tokens[0], origin, { isPaid: true }), 422);
  await expectResponse(await send(orders[0], tokens[1]), 404);
  stage = "owner and rate limiter";
  const value = await expectResponse(await send(orders[0], tokens[0]), 200); assert.equal(value.data.order.status, "AWAITING_PAYMENT"); assert.equal(value.data.order.canPay, true);
  const limited = await send(orders[0], tokens[0]); assert.ok(Number(limited.headers.get("retry-after")) > 0); await expectResponse(limited, 429);
  stage = "admin and atomic expiry with no provider attempt";
  const expired = await expectResponse(await send(orders[1], tokens[2]), 200); assert.equal(expired.data.order.status, "EXPIRED"); assert.equal(expired.data.order.canPay, false);
  const product = await db.product.findUniqueOrThrow({ where: { id: productId } }); assert.equal(product.physicalStock, 5); assert.equal(product.reservedStock, 1);
  assert.equal(await db.payment.count({ where: { orderId: { in: orders } } }), 0);
  console.log("Reconciliation HTTP passed: sessions, Origin, payload, owner/admin, 429 and retry headers, private DTO, atomic no-attempt expiry. No provider calls/real merchant keys.");
} catch { console.error(`Reconciliation HTTP failed at ${stage}; sensitive details suppressed.`); process.exitCode = 1; }
finally {
  if (child?.pid && child.exitCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
  if (db) {
    for (let offset = -1; offset <= 1; offset++) {
      for (const id of users) keys.push(rateLimitKey("reconcile-user", id, secret, new Date(Date.now() + offset * 900000)));
      for (const id of orders) keys.push(rateLimitKey("reconcile-order", id, secret, new Date(Date.now() + offset * 30000), 30000));
    }
    const orderWhere = { orderId: { in: orders } };
    await db.stockReservation.deleteMany({ where: { orderItem: orderWhere } }); await db.orderStatusHistory.deleteMany({ where: orderWhere }); await db.orderItem.deleteMany({ where: orderWhere }); await db.order.deleteMany({ where: { id: { in: orders } } });
    await db.user.deleteMany({ where: { id: { in: users } } }); if (productId) await db.product.deleteMany({ where: { id: productId } }); if (categoryId) await db.category.deleteMany({ where: { id: categoryId } }); await db.rateLimit.deleteMany({ where: { key: { in: keys } } }); await db.$disconnect();
  }
}
