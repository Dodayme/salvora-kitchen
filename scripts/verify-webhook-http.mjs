import nextEnv from "@next/env";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { databaseUrl } from "../src/lib/config/schema.ts";
import { createDatabaseClient } from "../src/lib/db/client.ts";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
const key = "SB-Mid-server-http-fixture", origin = "https://webhook-http.example.test";
let db, child, userId, orderId, paymentId, stage = "fixture";
try {
  const url = databaseUrl(process.env, "test"); db = createDatabaseClient({ NODE_ENV: "test", TEST_DATABASE_URL: url });
  userId = (await db.user.create({ data: { name: "Webhook HTTP", email: `webhook-http-${randomUUID()}@example.test`, passwordHash: "not-a-login-hash" } })).id;
  orderId = randomUUID();
  await db.order.create({ data: { id: orderId, number: orderId, userId, idempotencyKey: orderId, inputHash: "a".repeat(64), recipientName: "Fixture", phone: "081200000000", addressLine: "Fixture", city: "Tanjungpinang", province: "Kepulauan Riau", subtotal: 10000, total: 20000, shippingFee: 10000, shippingLabel: "Fixture", paymentDeadline: new Date(Date.now() + 3600000) } });
  const payment = await db.payment.create({ data: { orderId, providerOrderId: `SV-${randomUUID()}`, amount: 20000, status: "PENDING", midtransTransactionId: randomUUID(), expiresAt: new Date(Date.now() + 3500000) } }); paymentId = payment.id;
  const socket = createServer(); socket.listen(0, "127.0.0.1"); await once(socket, "listening"); const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env: { ...process.env, NODE_ENV: "test", DATABASE_URL: "", TEST_DATABASE_URL: url, AUTH_SECRET: randomBytes(32).toString("hex"), NEXT_PUBLIC_APP_URL: origin, MIDTRANS_SERVER_KEY: key, NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "SB-Mid-client-http-fixture", MIDTRANS_WEBHOOK_URL: "", MIDTRANS_IS_PRODUCTION: "false", PAYMENT_EXPIRY_MINUTES: "60" }, windowsHide: true, stdio: "ignore" });
  let spawnError; child.on("error", error => { spawnError = error; });
  const base = `http://127.0.0.1:${port}`;
  stage = "startup"; let ready = false;
  for (let n = 0; n < 150; n++) { if (spawnError || child.exitCode !== null) throw new Error("Server failed"); try { if ((await fetch(base, { signal: AbortSignal.timeout(500) })).status === 200) { ready = true; break; } } catch {} await delay(100); }
  assert.ok(ready);
  const raw = (body, type = "application/json") => fetch(`${base}/api/webhooks/midtrans`, { method: "POST", headers: { "Content-Type": type }, body });
  const body = { order_id: payment.providerOrderId, transaction_id: payment.midtransTransactionId, gross_amount: "20000.00", status_code: "200", transaction_status: "settlement", currency: "IDR" };
  const sign = data => ({ ...data, signature_key: createHash("sha512").update(data.order_id + data.status_code + data.gross_amount + key).digest("hex") });
  const expectStatus = async (response, status) => { assert.equal(response.status, status); assert.equal(response.headers.get("cache-control"), "no-store"); const text = await response.text(); assert.ok(!text.includes(key)); return JSON.parse(text); };
  stage = "body and signature guards";
  assert.equal((await fetch(`${base}/api/webhooks/midtrans`)).status, 405);
  await expectStatus(await raw("{}", "text/plain"), 415);
  await expectStatus(await raw("invalid"), 400);
  await expectStatus(await raw("x".repeat(65537)), 413);
  await expectStatus(await raw(JSON.stringify(body)), 422);
  await expectStatus(await raw(JSON.stringify({ ...body, signature_key: "a".repeat(128) })), 403);
  stage = "binding guards without Origin/cookie or provider calls";
  await expectStatus(await raw(JSON.stringify(sign({ ...body, order_id: `SV-${randomUUID()}` }))), 404);
  await expectStatus(await raw(JSON.stringify(sign({ ...body, gross_amount: "1.00" }))), 409);
  await expectStatus(await raw(JSON.stringify(sign({ ...body, transaction_id: randomUUID() }))), 409);
  assert.equal((await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).status, "PENDING");
  assert.equal(await db.paymentApplication.count({ where: { orderId } }), 0);
  console.log("Webhook HTTP verified: JSON/content/byte limits, invalid signature, unknown reference, amount/transaction binding, no Origin/session requirement and no payment application. No provider calls or real merchant keys used.");
} catch { console.error(`Webhook HTTP failed at ${stage}; private diagnostics suppressed.`); process.exitCode = 1; }
finally {
  if (child?.pid && child.exitCode === null) { const exit = once(child, "exit"); child.kill(); await exit; }
  if (db) { try { if (paymentId) { await db.paymentEvent.deleteMany({ where: { paymentId } }); await db.payment.delete({ where: { id: paymentId } }); } if (orderId) await db.order.deleteMany({ where: { id: orderId } }); if (userId) await db.user.deleteMany({ where: { id: userId } }); } finally { await db.$disconnect(); } }
}
