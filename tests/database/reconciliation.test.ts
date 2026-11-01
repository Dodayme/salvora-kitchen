import { createHash, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "../../src/lib/db/client";
import { createReconciliationService } from "../../src/services/reconciliation";
import { createPaymentService } from "../../src/services/payments";
import { createPaymentVerificationService } from "../../src/services/payment-verification";
import { runPaymentBatch } from "../../src/services/payment-job";
import { withPaymentJobLock } from "../../src/lib/payments/job-lock";
import { databaseUrl } from "../../src/lib/config/schema";
import { rateLimitKey } from "../../src/lib/auth/rate-limit";
import type { ProviderStatus } from "../../src/lib/payments/status";

const db = createDatabaseClient(), users: string[] = [], products: string[] = [], categories: string[] = [], orders: string[] = [];
const key = "SB-Mid-server-reconcile-fixture", secret = "reconcile-fixture-auth-secret-more-than-32-characters";
const formatted = (date: Date) => new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 19).replace("T", " ");
const queueKey = (id: string) => createHash("md5").update("salvora-payment-job:" + id).digest("hex") + createHash("md5").update(id + ":salvora-payment-job").digest("hex");
afterAll(async () => {
  const where = { userId: { in: users } };
  await db.paymentEvent.deleteMany({ where: { payment: { order: where } } });
  await db.paymentApplication.deleteMany({ where: { order: where } }); await db.payment.deleteMany({ where: { order: where } });
  await db.discount.updateMany({ where, data: { status: "AVAILABLE", reservedOrderId: null, usedOrderId: null, usedAt: null } });
  await db.stockReservation.deleteMany({ where: { orderItem: { order: where } } }); await db.orderStatusHistory.deleteMany({ where: { order: where } });
  await db.orderItem.deleteMany({ where: { order: where } }); await db.order.deleteMany({ where });
  await db.discount.deleteMany({ where }); await db.user.deleteMany({ where: { id: { in: users } } });
  await db.product.deleteMany({ where: { id: { in: products } } }); await db.category.deleteMany({ where: { id: { in: categories } } });
  const time = new Date(), limiterKeys = [...orders.map(queueKey)];
  for (let offset = -1; offset <= 1; offset++) {
    for (const id of users) limiterKeys.push(rateLimitKey("reconcile-user", id, secret, new Date(time.getTime() + offset * 900000)));
    for (const id of orders) limiterKeys.push(rateLimitKey("reconcile-order", id, secret, new Date(time.getTime() + offset * 30000), 30000));
  }
  await db.rateLimit.deleteMany({ where: { key: { in: limiterKeys } } }); await db.$disconnect();
});
async function fixture({ past = false, payment = true, voucher = true } = {}) {
  const user = await db.user.create({ data: { name: "Reconcile Test", email: `reconcile-${randomUUID()}@example.test`, passwordHash: "not-a-login-hash" }, select: { id: true, role: true } }); users.push(user.id);
  const category = await db.category.create({ data: { name: `Reconcile ${randomUUID()}` } }); categories.push(category.id);
  const product = await db.product.create({ data: { categoryId: category.id, name: "Test", description: "Test", price: 10000, physicalStock: 10, reservedStock: 2 } }); products.push(product.id);
  const discount = voucher ? await db.discount.create({ data: { userId: user.id } }) : null;
  const createdAt = new Date(Date.now() - (past ? 3660000 : 1000)), deadline = new Date(createdAt.getTime() + 3600000), id = randomUUID();
  const order = await db.order.create({ data: { id, number: id, userId: user.id, discountId: discount?.id, idempotencyKey: randomUUID(), inputHash: "a".repeat(64), recipientName: "Fixture", phone: "081200000000", addressLine: "Test", city: "Tanjungpinang", province: "Kepulauan Riau", subtotal: 20000, discount: voucher ? 4000 : 0, shippingFee: 10000, total: voucher ? 26000 : 30000, shippingLabel: "Delivery manual", createdAt, paymentDeadline: deadline, items: { create: { productId: product.id, name: "Test", unitPrice: 10000, quantity: 2, lineSubtotal: 20000, reservation: { create: { expiresAt: deadline, createdAt } } } } }, include: { items: true } }); orders.push(id);
  if (discount) await db.discount.update({ where: { id: discount.id }, data: { status: "RESERVED", reservedOrderId: id } });
  const attempt = payment ? await db.payment.create({ data: { orderId: id, providerOrderId: `SV-${randomUUID()}`, amount: order.total, status: "PENDING", snapToken: randomUUID(), createdAt, expiresAt: deadline } }) : null;
  let latest: ProviderStatus | null = attempt ? { order_id: attempt.providerOrderId, transaction_id: randomUUID(), status_code: "201", transaction_status: "pending", gross_amount: `${order.total}.00`, currency: "IDR", payment_type: "bank_transfer", transaction_time: formatted(createdAt) } : null;
  let calls = 0;
  const gateway = { async get() { calls++; return latest; } }, settings = { serverKey: key, authSecret: secret, gateway };
  const service = createReconciliationService(db, settings);
  return { user, product, order, attempt, discount, service, gateway, settings, set: (value: ProviderStatus | null) => { latest = value; }, latest: () => latest!, calls: () => calls, run: () => service.reconcileOrder(order.id, "STATUS_API") };
}
async function assertReserved(f: Awaited<ReturnType<typeof fixture>>) {
  expect(await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).toMatchObject({ physicalStock: 10, reservedStock: 2 });
  expect((await db.stockReservation.findUniqueOrThrow({ where: { orderItemId: f.order.items[0].id } })).status).toBe("RESERVED");
}
describe("Rekonsiliasi, retry, expiry dan worker PostgreSQL", () => {
  it("GET status sukses memakai penerapan BE-09 tanpa signature webhook sintetis", async () => {
    const f = await fixture(); f.set({ ...f.latest(), transaction_status: "settlement", status_code: "200", settlement_time: formatted(new Date()) });
    const value = await f.service.reconcile(f.user, f.order.id);
    expect(value.order.status).toBe("PROCESSING"); expect(value.order.canPay).toBe(false);
    expect(await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).toMatchObject({ physicalStock: 8, reservedStock: 0 });
    expect(await db.paymentEvent.count({ where: { paymentId: f.attempt!.id, source: "STATUS_API", verification: "VERIFIED" } })).toBe(1);
    expect(await db.paymentEvent.count({ where: { paymentId: f.attempt!.id, source: "WEBHOOK" } })).toBe(0);
  });
  it("owner/role dan limiter berlaku sebelum provider; admin boleh memeriksa", async () => {
    const f = await fixture();
    await expect(f.service.reconcile(null, f.order.id)).rejects.toMatchObject({ status: 401 });
    await expect(f.service.reconcile({ id: randomUUID(), role: "BUYER" }, f.order.id)).rejects.toMatchObject({ status: 404 }); expect(f.calls()).toBe(0);
    const admin = await db.user.create({ data: { name: "Test Admin", email: `admin-${randomUUID()}@example.test`, passwordHash: "invalid", role: "ADMIN" }, select: { id: true, role: true } }); users.push(admin.id);
    await f.service.reconcile(admin, f.order.id); expect(f.calls()).toBe(1);
    await expect(f.service.reconcile(f.user, f.order.id)).rejects.toMatchObject({ status: 429 }); expect(f.calls()).toBe(1);
  });
  it("deadline lokal, pending, 404, timeout dan status asing tidak melepas reservasi", async () => {
    const f = await fixture({ past: true }), pending = f.latest();
    await f.run(); await assertReserved(f);
    f.set(null); await expect(f.run()).rejects.toMatchObject({ status: 503 }); await assertReserved(f);
    f.gateway.get = async () => { throw new Error("private provider timeout"); };
    await expect(f.run()).rejects.toMatchObject({ status: 503 }); await assertReserved(f);
    f.gateway.get = async () => ({ ...pending, transaction_status: "mystery" });
    await expect(f.run()).rejects.toMatchObject({ status: 503 }); await assertReserved(f);
    expect((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("AWAITING_PAYMENT");
  });
  it("expire terverifikasi melepas stok/voucher sekali walau empat job bertabrakan", async () => {
    const f = await fixture({ past: true }); f.set({ ...f.latest(), transaction_status: "expire", status_code: "407" });
    await Promise.all(Array.from({ length: 4 }, () => f.run()));
    expect(await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).toMatchObject({ physicalStock: 10, reservedStock: 0 });
    expect((await db.discount.findUniqueOrThrow({ where: { id: f.discount!.id } })).status).toBe("AVAILABLE");
    expect((await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).isFirstPurchase).toBe(true);
    expect(await db.orderStatusHistory.count({ where: { orderId: f.order.id, toStatus: "EXPIRED" } })).toBe(1);
    expect(await db.paymentApplication.count({ where: { orderId: f.order.id } })).toBe(0);
  });
  it("order tanpa attempt atau hanya penolakan Snap definitif aman dilepas setelah tenggat", async () => {
    for (const rejection of [false, true]) {
      const f = await fixture({ past: true, payment: false, voucher: false });
      if (rejection) await db.payment.create({ data: { orderId: f.order.id, providerOrderId: `SV-${randomUUID()}`, amount: f.order.total, status: "FAILED", createdAt: f.order.createdAt, expiresAt: f.order.paymentDeadline, events: { create: { source: "SNAP_REQUEST", verification: "REJECTED", resultingStatus: "FAILED", errorCode: "SNAP_AUTH_REJECTED", deduplicationKey: "definitive" } } } });
      await f.run(); expect(f.calls()).toBe(0);
      expect((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("EXPIRED");
      expect((await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).physicalStock).toBe(10);
    }
  });
  it("retry terminal terverifikasi memakai order/snapshot/tenggat sama dan referensi baru", async () => {
    const f = await fixture(); f.set({ ...f.latest(), transaction_status: "deny", status_code: "202" }); await f.run();
    const token = randomUUID(), calls: string[] = [];
    const payer = createPaymentService(db, () => ({ async create(input) { calls.push(input.providerOrderId); expect(input.deadline.getTime()).toBe(f.order.paymentDeadline.getTime()); return { token, redirectUrl: `https://app.sandbox.midtrans.com/snap/v3/redirection/${token}` }; } }));
    const retry = await payer.pay(f.user, f.order.id); expect(retry.providerOrderId).not.toBe(f.attempt!.providerOrderId);
    expect(retry.orderId).toBe(f.order.id); expect(retry.expiresAt).toBe(f.order.paymentDeadline.toISOString());
    expect((await payer.pay(f.user, f.order.id)).paymentId).toBe(retry.paymentId); expect(calls).toHaveLength(1); await assertReserved(f);
    expect(await db.order.count({ where: { userId: f.user.id } })).toBe(1);
  });
  it("terminal sebelum deadline tidak melepas reservasi; sesudah deadline menolak attempt baru", async () => {
    const f = await fixture(); f.set({ ...f.latest(), transaction_status: "cancel", status_code: "202" });
    expect(await f.run()).toEqual({ released: false }); await assertReserved(f);
    const past = await fixture({ past: true }); past.set({ ...past.latest(), transaction_status: "expire", status_code: "407" }); await past.run();
    let calls = 0;
    const payer = createPaymentService(db, () => ({ async create() { calls++; throw new Error("must not call"); } }));
    await expect(payer.pay(past.user, past.order.id)).rejects.toMatchObject({ code: "ORDER_NOT_PAYABLE" }); expect(calls).toBe(0);
  });
  it("currency legacy hilang mengikuti kontrak Core API IDR; currency eksplisit salah ditolak", async () => {
    const f = await fixture(); f.set({ ...f.latest(), currency: undefined, transaction_status: "settlement", status_code: "200", settlement_time: formatted(new Date()) });
    await f.run(); expect((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("PROCESSING");
    const other = await fixture(); other.set({ ...other.latest(), currency: "USD" }); await expect(other.run()).rejects.toMatchObject({ status: 503 }); await assertReserved(other);
  });
  it("status FAILED tanpa bukti atau CREATED terdampar tidak membuka retry/release", async () => {
    for (const status of ["FAILED", "CREATED"] as const) {
      const f = await fixture({ past: true }); await db.payment.update({ where: { id: f.attempt!.id }, data: { status } }); f.set(null);
      await expect(f.run()).rejects.toMatchObject({ status: 503 }); await assertReserved(f);
    }
  });
  it("satu attempt terminal tidak melepas saat attempt lain masih unknown", async () => {
    const f = await fixture({ past: true });
    // Historical terminal row has no active-index collision with the pending row.
    const other = await db.payment.create({ data: { orderId: f.order.id, providerOrderId: `SV-${randomUUID()}`, amount: f.order.total, status: "FAILED", createdAt: f.order.createdAt, expiresAt: f.order.paymentDeadline } });
    const original = f.latest(); f.gateway.get = async (reference?: string) => reference === other.providerOrderId ? null : { ...original, transaction_status: "expire", status_code: "407" };
    await expect(f.run()).rejects.toMatchObject({ status: 503 }); await assertReserved(f);
  });
  it("rollback pelepasan tidak menyimpan sebagian stok/voucher/history", async () => {
    const f = await fixture({ past: true, payment: false });
    const extended = db.$extends({ query: { orderStatusHistory: { async create() { throw new Error("fixture history failure"); } } } });
    const failing = createReconciliationService(extended as unknown as typeof db, f.settings);
    await expect(failing.reconcileOrder(f.order.id, "SCHEDULER")).rejects.toThrow("fixture history failure");
    await assertReserved(f); expect((await db.discount.findUniqueOrThrow({ where: { id: f.discount!.id } })).status).toBe("RESERVED");
    await f.run(); expect((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("EXPIRED");
  });
  it("late success sesudah release masuk Perlu Penanganan dan tidak mengirim ulang", async () => {
    const f = await fixture({ past: true }); const base = f.latest(); f.set({ ...base, transaction_status: "expire", status_code: "407" }); await f.run();
    f.set({ ...base, transaction_status: "settlement", status_code: "200", settlement_time: formatted(new Date()) }); await f.run();
    expect((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("NEEDS_ATTENTION");
    expect((await db.payment.findUniqueOrThrow({ where: { id: f.attempt!.id } })).status).toBe("SUCCESS");
    expect(await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).toMatchObject({ physicalStock: 10, reservedStock: 0 });
    expect((await db.discount.findUniqueOrThrow({ where: { id: f.discount!.id } })).status).toBe("AVAILABLE");
    expect(await db.paymentApplication.count({ where: { orderId: f.order.id } })).toBe(0);
  });
  it("webhook bersamaan dengan rekonsiliasi sukses tetap satu penerapan", async () => {
    const f = await fixture(); f.set({ ...f.latest(), transaction_status: "settlement", status_code: "200", settlement_time: formatted(new Date()) });
    const body = { ...f.latest(), signature_key: createHash("sha512").update(f.latest().order_id + "200" + f.latest().gross_amount + key).digest("hex") };
    await Promise.all([f.run(), createPaymentVerificationService(db, f.settings).notification(body)]);
    expect(await db.paymentApplication.count({ where: { orderId: f.order.id } })).toBe(1);
    expect((await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).physicalStock).toBe(8);
  });
  it("session advisory lock menolak worker overlap dan dilepas setelah kegagalan", async () => {
    const url = databaseUrl(process.env, "test");
    const first = await withPaymentJobLock(url, async () => { expect(await withPaymentJobLock(url, async () => { throw new Error("must not run"); })).toEqual({ skipped: true }); return 1; });
    expect(first).toEqual({ skipped: false, value: 1 });
    await expect(withPaymentJobLock(url, async () => { throw new Error("fixture failure"); })).rejects.toThrow("fixture failure");
    expect(await withPaymentJobLock(url, async () => 2)).toEqual({ skipped: false, value: 2 });
  });
  it("batch menyimpan jeda per order; kegagalan tidak membuat antrean berikutnya kelaparan", async () => {
    const f = await fixture({ past: true, payment: false });
    const result = await runPaymentBatch(db, f.service, () => {}, [f.order.id]); expect(result).toEqual({ checked: 1, released: 1, unconfirmed: 0 });
    expect((await db.rateLimit.findUniqueOrThrow({ where: { key: queueKey(f.order.id) } })).resetAt.getTime()).toBeGreaterThan(Date.now());
    const unknown = await fixture({ past: true }), next = await fixture({ past: true, payment: false }); unknown.set(null);
    const passed: string[] = [];
    const worker = { async reconcileOrder(id: string) { passed.push(id); return id === unknown.order.id ? unknown.run() : next.run(); } };
    expect(await runPaymentBatch(db, worker, () => {}, [unknown.order.id, next.order.id])).toEqual({ checked: 2, released: 1, unconfirmed: 1 });
    expect(await runPaymentBatch(db, worker, () => {}, [unknown.order.id, next.order.id])).toEqual({ checked: 0, released: 0, unconfirmed: 0 });
    expect(passed).toHaveLength(2);
  });
});
