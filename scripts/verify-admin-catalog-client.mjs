/** FE-09: frontend payload/controllers + Next HTTP + verified test DB; no gateway/worker paths. */
import nextEnv from "@next/env";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdir, readdir, readFile, writeFile, lstat } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { hash } from "bcryptjs";
import sharp from "sharp";
import { databaseUrl } from "../src/lib/config/schema.ts";
import { createDatabaseClient } from "../src/lib/db/client.ts";
import { localPhotoStorage, photoDirectory } from "../src/lib/catalog/photo-storage.ts";
import { rateLimitKey, AUTH_WINDOW_MS } from "../src/lib/auth/rate-limit.ts";
import { createApiClient, ApiClientError } from "../src/lib/http/client.ts";
import { createAdminAction } from "../src/lib/admin-client/action-controller.ts";
import { categoryPayload, productPayload, stockPayload, photoForm, decodeUploadedPhoto, decodeAdminCategory, decodeAdminProduct, decodeAdminProducts, catalogAdminPath, emptyCatalogFilter } from "../src/lib/admin-client/catalog-model.ts";
import { decodeCategories, decodeProduct } from "../src/lib/catalog-client/model.ts";
import { decodeNull } from "../src/lib/buyer-client/model.ts";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const run = randomUUID(), prefix = `fe09-${run}`, secret = randomBytes(32).toString("hex"), password = randomBytes(20).toString("base64url"), started = Date.now();
const emails = ["admin", "buyer"].map(role => `${prefix}-${role}@example.test`), categoryIds = [], productIds = [], cases = [];
const tables = ["User", "Session", "Address", "Category", "Product", "ProductPhoto", "Cart", "CartItem", "Discount", "CheckoutQuote", "Order", "OrderItem", "StockReservation", "OrderStatusHistory", "Payment", "Rating"];
const directory = photoDirectory({ NODE_ENV: "test" });
assert.equal(directory, path.resolve(".local/uploads/product-photos-test"));
let db, child, adminId, buyerId, orderId, verified = false, baseline, fileBaseline, phase = "configuration", cleanupPass = false;
const safeError = error => ({ category: ["AssertionError", "PrismaClientKnownRequestError", "PrismaClientValidationError", "TypeError"].includes(error?.name) ? error.name : "Error", code: typeof error?.code === "string" && /^[A-Z0-9_]{1,24}$/.test(error.code) ? error.code : "UNCLASSIFIED" });
async function fingerprint() {
  const result = {};
  for (const table of tables) result[table] = await db.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY to_jsonb(t)::text),'')) AS digest FROM "${table}" t`);
  return JSON.stringify(result);
}
async function filesFingerprint() {
  const result = [];
  async function visit(root) {
    assert.ok(!(await lstat(root)).isSymbolicLink());
    for (const name of (await readdir(root)).sort()) {
      const file = path.join(root, name), stat = await lstat(file), relative = path.relative(directory, file);
      assert.ok(!stat.isSymbolicLink());
      if (stat.isDirectory()) { result.push([relative, "directory"]); await visit(file); }
      else { assert.ok(stat.isFile()); result.push([relative, createHash("sha256").update(await readFile(file)).digest("hex")]); }
    }
  }
  try { await visit(directory); } catch (error) { if (error.code === "ENOENT" && !result.length) return "[]"; throw error; }
  return JSON.stringify(result);
}
try {
  const url = databaseUrl(process.env, "test"), target = new URL(url);
  assert.ok(["localhost", "127.0.0.1"].includes(target.hostname) && target.port === "55433");
  db = createDatabaseClient({ NODE_ENV: "test", TEST_DATABASE_URL: url });
  const identity = await db.$queryRaw`SELECT current_database()::text AS name, inet_server_port() AS port`;
  assert.equal(identity[0].name, "salvora_kitchen_test"); assert.equal(identity[0].port, 55433); verified = true;
  phase = "database baseline"; baseline = await fingerprint(); phase = "photo baseline"; fileBaseline = await filesFingerprint();
  phase = "fixture identities";
  const passwordHash = await hash(password, 12);
  adminId = (await db.user.create({ data: { email: emails[0], name: "FE09 Admin", passwordHash, role: "ADMIN" } })).id;
  buyerId = (await db.user.create({ data: { email: emails[1], name: "FE09 Buyer", passwordHash, role: "BUYER" } })).id;
  const socket = createServer(); socket.listen(0, "127.0.0.1"); await once(socket, "listening"); const port = socket.address().port; await new Promise(done => socket.close(done));
  const origin = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { windowsHide: true, stdio: "ignore", env: { ...process.env, NODE_ENV: "test", DATABASE_URL: "", TEST_DATABASE_URL: url, AUTH_SECRET: secret, NEXT_PUBLIC_APP_URL: origin, MIDTRANS_IS_PRODUCTION: "false", MIDTRANS_SERVER_KEY: "", NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "", MIDTRANS_WEBHOOK_URL: "" } });
  let spawnFailed = false; child.on("error", () => { spawnFailed = true; }); phase = "startup";
  for (let n = 0; ; n++) { assert.ok(n < 150 && !spawnFailed && child.exitCode === null); try { if ((await fetch(origin, { signal: AbortSignal.timeout(500) })).ok) break; } catch { /* bounded startup */ } await delay(100); }
  function client() {
    let cookie = "";
    return createApiClient(async (relative, options) => {
      const pathname = new URL(relative, origin).pathname;
      assert.ok(pathname === "/api/auth/login" || /^\/api\/admin\/(categories|products)(?:\/[A-Za-z0-9_-]+(?:\/stock)?)?$/.test(pathname) || pathname === "/api/admin/product-photos" || options.method === "GET" && /^\/api\/(products\/[A-Za-z0-9_-]+|product-photos\/[A-Za-z0-9_-]+)$/.test(pathname), "Only catalog/auth paths permitted");
      const headers = new Headers(options.headers); headers.set("Origin", origin); if (cookie) headers.set("Cookie", cookie);
      const response = await fetch(origin + relative, { ...options, headers });
      if (response.headers.getSetCookie().length) cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
      // Capture generated IDs before response decoding, including simulated response loss.
      if (options.method === "POST" && response.status === 201 && ["/api/admin/categories", "/api/admin/products"].includes(pathname)) {
        const body = await response.clone().json(); assert.ok(/^[A-Za-z0-9_-]{1,128}$/.test(body.data.id)); (pathname.endsWith("categories") ? categoryIds : productIds).push(body.data.id);
      }
      return response;
    });
  }
  const admin = client(), buyer = client(), anon = client();
  await admin("/api/auth/login", { method: "POST", json: { email: emails[0], password } });
  await buyer("/api/auth/login", { method: "POST", json: { email: emails[1], password } });
  const errorCode = async (promise, status, code) => { await assert.rejects(promise, error => error instanceof ApiClientError && error.status === status && (!code || error.code === code)); };
  const mutation = async (operation, phaseExpected = "saved") => { const action = createAdminAction({ request: admin, authorized: () => true }); let data; await action.run(operation, value => { data = value; }); assert.equal(action.getSnapshot().phase, phaseExpected); return { action, data }; };
  phase = "role guards";
  await errorCode(anon("/api/admin/categories"), 401); await errorCode(buyer("/api/admin/products"), 403);
  await errorCode(buyer("/api/admin/product-photos", { method: "POST", form: photoForm(new File(["fake"], "fake.png", { type: "image/png" })) }), 403);
  cases.push("HTTP guards: anonymous 401; buyer catalog/upload 403");
  phase = "category CRUD and pagination";
  const { data: category } = await mutation(client => client("/api/admin/categories", { method: "POST", json: categoryPayload(`${prefix} 50%_`, true).data, decode: decodeAdminCategory }));
  await errorCode(admin("/api/admin/categories", { method: "POST", json: categoryPayload(category.name, true).data }), 409, "RESOURCE_EXISTS");
  for (let i = 0; i < 11; i++) { const id = `${prefix}-page-${i}`; categoryIds.push(id); await db.category.create({ data: { id, name: `${prefix} page ${i}`, isActive: i !== 0 } }); }
  const filter = { ...emptyCatalogFilter, q: prefix };
  const page1 = await admin(catalogAdminPath("categories", 1, filter), { decode: decodeCategories }), page2 = await admin(catalogAdminPath("categories", 2, filter), { decode: decodeCategories });
  assert.equal(page1.data.length, 10); assert.equal(page2.data.length, 2); assert.equal(page1.meta.pagination.total, 12); assert.ok(!page2.data.some(row => page1.data.some(first => first.id === row.id)));
  const spare = categoryIds.find(id => id.includes("-page-")); await mutation(client => client(`/api/admin/categories/${spare}`, { method: "DELETE", json: {}, decode: decodeNull }));
  cases.push("category create/duplicate/delete; real picker pagination 10+2 distinct entries");
  phase = "photo validation and server preview";
  const png = await sharp({ create: { width: 5, height: 6, channels: 3, background: "orange" } }).png().toBuffer();
  const file = new File([new Uint8Array(png)], "demo.png", { type: "image/png" });
  const { data: photo } = await mutation(client => client("/api/admin/product-photos", { method: "POST", form: photoForm(file), decode: decodeUploadedPhoto }));
  await errorCode(admin("/api/admin/product-photos", { method: "POST", form: photoForm(new File(["corrupt"], "fake.png", { type: "image/png" })) }), 422);
  assert.equal((await fetch(origin + photo.url)).status, 404);
  // Binary read through a private login cookie obtained independently, never printed/stored.
  const previewLogin = await fetch(origin + "/api/auth/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email: emails[0], password }) }); assert.equal(previewLogin.status, 200);
  const cookie = previewLogin.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  const preview = await fetch(origin + photo.url, { headers: { Cookie: cookie } }); assert.equal(preview.status, 200); assert.equal(preview.headers.get("content-type"), "image/webp");
  cases.push("FormData actual PNG accepted/converted to WebP; corrupt PNG rejected; pending photo admin-only");
  phase = "product create and metadata";
  const draft = { categoryId: category.id, name: `${prefix} 50%_ risol`, description: "Fixture terisolasi", price: "14000", physicalStock: "12", isActive: true, photoId: photo.photoId };
  let { data: product } = await mutation(client => client("/api/admin/products", { method: "POST", json: productPayload(draft, false).data, decode: decodeAdminProduct }));
  const publicProduct = await anon(`/api/products/${product.id}`, { decode: decodeProduct }); assert.equal(publicProduct.data.imageUrl, photo.url); assert.ok(!("physicalStock" in publicProduct.data));
  const binary = await fetch(origin + photo.url); assert.equal(binary.status, 200); assert.equal((await sharp(Buffer.from(await binary.arrayBuffer())).metadata()).format, "webp");
  const list = await admin(catalogAdminPath("products", 1, { ...emptyCatalogFilter, categoryId: category.id, q: "50%_" }), { decode: decodeAdminProducts }); assert.equal(list.data.length, 1); assert.equal(list.data[0].id, product.id);
  await errorCode(admin(`/api/admin/categories/${category.id}`, { method: "DELETE", json: {} }), 409, "RESOURCE_IN_USE");
  orderId = randomUUID(); await db.order.create({ data: { id: orderId, number: orderId, userId: buyerId, idempotencyKey: orderId, inputHash: "a".repeat(64), recipientName: "FE09 fixture", phone: "0800000000", addressLine: "Fixture only", city: "Test", province: "Test", subtotal: 14000, total: 14000, shippingFee: 0, shippingLabel: "TEST ONLY", paymentDeadline: new Date(Date.now() + 3600000), items: { create: { productId: product.id, name: product.name, unitPrice: 14000, quantity: 1, lineSubtotal: 14000 } } } });
  const originalItem = await db.orderItem.findFirstOrThrow({ where: { orderId } });
  ({ data: product } = await mutation(client => client(`/api/admin/products/${product.id}`, { method: "PATCH", json: productPayload({ ...draft, price: "16000", physicalStock: "999" }, true).data, decode: decodeAdminProduct })));
  assert.equal(product.physicalStock, 12); assert.deepEqual(await db.orderItem.findFirstOrThrow({ where: { orderId } }), originalItem);
  cases.push("create/edit/photo association; literal %_ search; FK category rejection; metadata excludes stock; historical snapshot preserved");
  phase = "stock version and reservation conflict";
  const old = product.updatedAt;
  ({ data: product } = await mutation(client => client(`/api/admin/products/${product.id}/stock`, { method: "PUT", json: stockPayload("5", old).data, decode: decodeAdminProduct })));
  assert.equal(product.availability, "LOW");
  assert.equal((await admin(catalogAdminPath("products", 1, { ...emptyCatalogFilter, categoryId: category.id, availability: "LOW", isActive: "true" }), { decode: decodeAdminProducts })).data[0].id, product.id);
  const conflict = await mutation(client => client(`/api/admin/products/${product.id}/stock`, { method: "PUT", json: stockPayload("4", old).data, decode: decodeAdminProduct }), "needsReload");
  assert.equal(conflict.action.getSnapshot().error.code, "RESOURCE_VERSION_CONFLICT");
  await db.product.update({ where: { id: product.id }, data: { reservedStock: 5 } });
  product = (await admin(`/api/admin/products/${product.id}`, { decode: decodeAdminProduct })).data;
  const reserved = await mutation(client => client(`/api/admin/products/${product.id}/stock`, { method: "PUT", json: stockPayload("4", product.updatedAt).data, decode: decodeAdminProduct }), "needsReload");
  assert.equal(reserved.action.getSnapshot().error.code, "STOCK_RESERVED"); assert.equal((await anon(`/api/products/${product.id}`, { decode: decodeProduct })).data.availability, "OUT_OF_STOCK");
  const fresh = (await admin(`/api/admin/products/${product.id}`, { decode: decodeAdminProduct })).data;
  await mutation(client => client(`/api/admin/products/${product.id}/stock`, { method: "PUT", json: stockPayload("6", fresh.updatedAt).data, decode: decodeAdminProduct }));
  assert.equal((await admin(`/api/admin/products/${product.id}`, { decode: decodeAdminProduct })).data.availableStock, 1);
  cases.push("stock LOW; stale version and reservation floor rejected with controller reload required; public OUT_OF_STOCK");
  phase = "visibility and uncertain commit";
  await mutation(client => client(`/api/admin/categories/${category.id}`, { method: "PATCH", json: categoryPayload(category.name, false).data, decode: decodeAdminCategory }));
  await errorCode(anon(`/api/products/${product.id}`), 404); assert.equal((await fetch(origin + photo.url)).status, 404);
  await mutation(client => client(`/api/admin/categories/${category.id}`, { method: "PATCH", json: categoryPayload(category.name, true).data, decode: decodeAdminCategory }));
  await mutation(client => client(`/api/admin/products/${product.id}`, { method: "PATCH", json: { isActive: false }, decode: decodeAdminProduct }));
  await errorCode(anon(`/api/products/${product.id}`), 404); assert.deepEqual(await db.orderItem.findFirstOrThrow({ where: { orderId } }), originalItem);
  assert.equal((await admin(catalogAdminPath("products", 1, { ...emptyCatalogFilter, categoryId: category.id, isActive: "false" }), { decode: decodeAdminProducts })).data[0].id, product.id);
  let calls = 0;
  const uncertain = await mutation(async client => { calls++; await client("/api/admin/products", { method: "POST", json: productPayload({ ...draft, name: `${prefix} lost`, photoId: null }, false).data, decode: decodeAdminProduct }); throw new ApiClientError(0, "NETWORK_ERROR", "", "network"); }, "needsReload");
  await uncertain.action.run(async () => { calls++; throw Error("must not replay"); }, () => {}); assert.equal(calls, 1);
  assert.equal(await db.product.count({ where: { categoryId: category.id, name: `${prefix} lost` } }), 1);
  cases.push("category/product inactive visibility; historical snapshot intact; committed response lost blocks duplicate POST");
  phase = "session revoked";
  await db.session.deleteMany({ where: { userId: adminId } }); await errorCode(admin("/api/admin/products"), 401);
  cases.push("revoked admin session returns 401; no provider/payment/worker endpoint used");
} catch (error) { console.error(JSON.stringify({ result: "FAIL", phase, ...safeError(error), details: "Error details suppressed; no secrets or raw payloads logged" })); process.exitCode = 1; }
finally {
  if (child && child.exitCode === null) { const exit = once(child, "exit"); child.kill(); await exit; }
  if (db && verified && baseline !== undefined) {
    try {
      const photos = adminId ? await db.productPhoto.findMany({ where: { createdById: adminId }, select: { key: true } }) : [];
      if (orderId) { await db.orderItem.deleteMany({ where: { orderId, order: { userId: buyerId } } }); await db.order.deleteMany({ where: { id: orderId, userId: buyerId } }); }
      await db.product.deleteMany({ where: { id: { in: productIds }, categoryId: { in: categoryIds } } });
      await db.category.deleteMany({ where: { id: { in: categoryIds } } });
      if (adminId) await db.productPhoto.deleteMany({ where: { createdById: adminId } });
      const storage = localPhotoStorage(directory); for (const photo of photos) await storage.remove(photo.key);
      await db.$transaction(async tx => {
        await tx.discount.deleteMany({ where: { user: { email: { in: emails } } } });
        await tx.user.deleteMany({ where: { email: { in: emails } } });
      });
      const keys = [];
      for (let time = Math.floor(started / AUTH_WINDOW_MS) * AUTH_WINDOW_MS; time <= Date.now(); time += AUTH_WINDOW_MS) { keys.push(rateLimitKey("auth.login.global", "all", secret, new Date(time))); for (const email of emails) keys.push(rateLimitKey("auth.login.email", email, secret, new Date(time))); }
      await db.rateLimit.deleteMany({ where: { key: { in: keys } } });
      assert.equal(await fingerprint(), baseline); assert.equal(await filesFingerprint(), fileBaseline); assert.equal(await db.user.count({ where: { email: { in: emails } } }), 0); cleanupPass = true;
    } catch (error) { console.error(JSON.stringify({ cleanup: "FAIL", ...safeError(error), details: "Targeted cleanup/fingerprint requires review; no broad deletion attempted" })); process.exitCode = 1; }
  }
  if (db) await db.$disconnect();
  const result = { result: process.exitCode ? "FAIL" : "PASS", timestamp: new Date().toISOString(), run, target: "salvora_kitchen_test:55433", groups: cases.length, cases, cleanup: cleanupPass ? "PASS" : "FAIL", fingerprintTables: tables.length, existingPhotoFilesUnchanged: cleanupPass, providerCalls: 0, browserTested: false };
  await mkdir(".local/fe09", { recursive: true });
  await writeFile(`.local/fe09/${run}-result.json`, JSON.stringify(result, null, 2));
  await writeFile(".local/fe09/http-result.json", JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
}
