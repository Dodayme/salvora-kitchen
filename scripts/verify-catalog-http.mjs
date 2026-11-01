import nextEnv from "@next/env";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { hash } from "bcryptjs";
import sharp from "sharp";
import { databaseUrl } from "../src/lib/config/schema.ts";
import { createDatabaseClient } from "../src/lib/db/client.ts";
import { localPhotoStorage, photoDirectory } from "../src/lib/catalog/photo-storage.ts";
import { rateLimitKey, AUTH_WINDOW_MS } from "../src/lib/auth/rate-limit.ts";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
const suffix = randomUUID(), password = randomBytes(20).toString("base64url"), secret = randomBytes(32).toString("hex");
const origin = "https://catalog-http.example.test", started = Date.now();
const emails = [`catalog-http-admin-${suffix}@example.test`, `catalog-http-buyer-${suffix}@example.test`];
const categoryIds = [], productIds = [];
let child, db, adminId, orderId, phase = "configuration";
try {
  const url = databaseUrl(process.env, "test");
  db = createDatabaseClient({ NODE_ENV: "test", TEST_DATABASE_URL: url });
  const passwordHash = await hash(password, 12);
  adminId = (await db.user.create({ data: { name: "Catalog HTTP Admin", email: emails[0], passwordHash, role: "ADMIN" } })).id;
  const buyerId = (await db.user.create({ data: { name: "Catalog HTTP Buyer", email: emails[1], passwordHash, role: "BUYER" } })).id;
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
  const send = (path, { data, method, token, form, requestOrigin = origin } = {}) => fetch(base + path, { method: method ?? (data !== undefined || form ? "POST" : "GET"), headers: { ...(data === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Cookie: `salvora_session=${token}` } : {}), ...(requestOrigin ? { Origin: requestOrigin } : {}) }, ...(form ? { body: form } : data !== undefined ? { body: JSON.stringify(data) } : {}) });
  const json = async (response, status = 200) => { assert.equal(response.status, status); const body = await response.json(); assert.equal(body.success, status < 400); assert.ok(!JSON.stringify(body).includes(password) && !JSON.stringify(body).includes(secret)); return body; };
  const token = response => { const value = response.headers.get("set-cookie")?.match(/salvora_session=([a-f0-9]{64})/)?.[1]; assert.ok(value); return value; };
  phase = "authentication";
  const adminLogin = await send("/api/auth/login", { data: { email: emails[0], password } }); await json(adminLogin); const adminToken = token(adminLogin);
  const buyerLogin = await send("/api/auth/login", { data: { email: emails[1], password } }); await json(buyerLogin); const buyerToken = token(buyerLogin);
  phase = "admin guards";
  assert.equal((await send("/api/admin/categories", { data: {} })).status, 401);
  assert.equal((await send("/api/admin/products", { data: {}, token: buyerToken })).status, 403);
  assert.equal((await send("/api/admin/categories", { data: {}, token: adminToken, requestOrigin: "https://attacker.example.test" })).status, 403);
  phase = "category and upload";
  const category = (await json(await send("/api/admin/categories", { token: adminToken, data: { name: `HTTP ${suffix}`, isActive: true } }), 201)).data; categoryIds.push(category.id);
  const png = await sharp({ create: { width: 5, height: 6, channels: 3, background: "orange" } }).png().toBuffer();
  const form = new FormData(); form.append("file", new File([new Uint8Array(png)], "../../malicious-name.php", { type: "image/png" }));
  assert.equal((await send("/api/admin/product-photos", { form, token: buyerToken })).status, 403);
  const uploaded = (await json(await send("/api/admin/product-photos", { form, token: adminToken }), 201)).data;
  assert.equal((await send(uploaded.url)).status, 404);
  const preview = await send(uploaded.url, { token: adminToken }); assert.equal(preview.status, 200); assert.equal(preview.headers.get("content-type"), "image/webp");
  const badForm = new FormData(); badForm.append("file", new File(["not an image"], "fake.png", { type: "image/png" }));
  assert.equal((await send("/api/admin/product-photos", { form: badForm, token: adminToken })).status, 422);
  phase = "product CRUD and public reads";
  let product = (await json(await send("/api/admin/products", { token: adminToken, data: { categoryId: category.id, name: `Risol 50%_ ${suffix}`, description: "HTTP fixture", price: 10000, physicalStock: 12, isActive: true, photoId: uploaded.photoId } }), 201)).data; productIds.push(product.id);
  const listed = await json(await send(`/api/products?categoryId=${category.id}`)); assert.equal(listed.meta.pagination.total, 1); assert.equal(listed.data[0].id, product.id); assert.ok(!("physicalStock" in listed.data[0]));
  assert.equal((await json(await send(`/api/products/${product.id}`))).data.reviewCount, 0);
  const media = await send(uploaded.url); assert.equal(media.status, 200); assert.equal(media.headers.get("x-content-type-options"), "nosniff"); assert.equal((await sharp(Buffer.from(await media.arrayBuffer())).metadata()).format, "webp");
  assert.equal((await send("/api/products?q=risol")).status, 422);
  assert.equal((await send(`/api/admin/products/${product.id}`, { method: "DELETE", token: adminToken })).status, 405);
  assert.equal((await send(`/api/admin/categories/${category.id}`, { method: "DELETE", token: adminToken, data: {} })).status, 409);
  assert.equal((await json(await send(`/api/categories?pageSize=100`))).data.find(c => c.id === category.id).productCount, 1);
  phase = "stock concurrency and reservations";
  const oldVersion = product.updatedAt;
  product = (await json(await send(`/api/admin/products/${product.id}/stock`, { method: "PUT", token: adminToken, data: { physicalStock: 5, expectedUpdatedAt: oldVersion } }))).data; assert.equal(product.availability, "LOW");
  assert.equal((await send(`/api/admin/products/${product.id}/stock`, { method: "PUT", token: adminToken, data: { physicalStock: 1, expectedUpdatedAt: oldVersion } })).status, 409);
  const filtered = await json(await send(`/api/admin/products?categoryId=${category.id}&availability=LOW&q=50%25_`, { token: adminToken })); assert.equal(filtered.meta.pagination.total, 1);
  await db.product.update({ where: { id: product.id }, data: { reservedStock: 5 } });
  product = (await json(await send(`/api/admin/products/${product.id}`, { token: adminToken }))).data;
  assert.equal((await send(`/api/admin/products/${product.id}/stock`, { method: "PUT", token: adminToken, data: { physicalStock: 4, expectedUpdatedAt: product.updatedAt } })).status, 409);
  assert.equal((await json(await send(`/api/products/${product.id}`))).data.availability, "OUT_OF_STOCK");
  phase = "history preservation and inactive visibility";
  orderId = randomUUID();
  await db.order.create({ data: { id: orderId, number: orderId, userId: buyerId, idempotencyKey: orderId, inputHash: "a".repeat(64), recipientName: "HTTP Fixture", phone: "0800000000", addressLine: "Historical address", city: "Test", province: "Test", subtotal: 10000, total: 10000, shippingFee: 0, shippingLabel: "TEST ONLY", paymentDeadline: new Date(Date.now() + 3600000), items: { create: { productId: product.id, name: product.name, unitPrice: 10000, quantity: 1, lineSubtotal: 10000 } } } });
  await json(await send(`/api/admin/products/${product.id}`, { method: "PATCH", token: adminToken, data: { price: 20000, name: "Updated HTTP product", isActive: false } }));
  assert.equal((await db.orderItem.findFirstOrThrow({ where: { orderId } })).unitPrice, 10000);
  assert.equal((await send(`/api/products/${product.id}`)).status, 404);
  assert.equal((await send(uploaded.url)).status, 404);
  assert.equal((await send(uploaded.url, { token: adminToken })).status, 200);
  console.log("Catalog HTTP verified: public reads, admin guards/Origin, category/product CRUD, photo upload/preview/public serving, content validation, stock/version/reservation guards, filters/counts and historical snapshots.");
} catch {
  console.error(`Catalog HTTP verification failed at: ${phase}. No credentials or tokens printed.`); process.exitCode = 1;
} finally {
  if (child?.pid && child.exitCode === null) { const exit = once(child, "exit"); child.kill(); await exit; }
  if (db) {
    try {
      if (orderId) { await db.orderItem.deleteMany({ where: { orderId } }); await db.order.deleteMany({ where: { id: orderId } }); }
      await db.product.deleteMany({ where: { id: { in: productIds } } });
      await db.category.deleteMany({ where: { id: { in: categoryIds } } });
      if (adminId) {
        const photos = await db.productPhoto.findMany({ where: { createdById: adminId }, select: { key: true } });
        await db.productPhoto.deleteMany({ where: { createdById: adminId } });
        const storage = localPhotoStorage(photoDirectory({ NODE_ENV: "test" }));
        for (const photo of photos) await storage.remove(photo.key);
      }
      await db.discount.deleteMany({ where: { user: { email: { in: emails } } } });
      await db.user.deleteMany({ where: { email: { in: emails } } });
      const keys = [];
      for (let time = Math.floor(started / AUTH_WINDOW_MS) * AUTH_WINDOW_MS; time <= Date.now(); time += AUTH_WINDOW_MS) {
        keys.push(rateLimitKey("auth.login.global", "all", secret, new Date(time)));
        for (const email of emails) keys.push(rateLimitKey("auth.login.email", email, secret, new Date(time)));
      }
      await db.rateLimit.deleteMany({ where: { key: { in: keys } } });
    } catch { console.error("Cleanup fixture katalog belum lengkap; tidak menghapus data lain."); process.exitCode = 1; }
    finally { await db.$disconnect(); }
  }
}
