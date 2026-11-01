import { createHash, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "../../src/lib/db/client";
import { createBuyerService } from "../../src/services/buyer";
import { createCheckoutService } from "../../src/services/checkout";
import { createPaymentService } from "../../src/services/payments";
import { createPaymentVerificationService } from "../../src/services/payment-verification";
import { issueNewBuyerVoucher } from "../../src/services/vouchers";
import type { ProviderStatus } from "../../src/lib/payments/status";

const db = createDatabaseClient(), buyer = createBuyerService(db), checkout = createCheckoutService(db);
const key = "SB-Mid-server-database-webhook-fixture", ids: string[] = [], products: string[] = [], categories: string[] = [];
afterAll(async () => {
  const where = { userId: { in: ids } };
  await db.paymentEvent.deleteMany({ where: { payment: { order: where } } });
  await db.paymentApplication.deleteMany({ where: { order: where } });
  await db.payment.deleteMany({ where: { order: where } });
  await db.discount.updateMany({ where, data: { status: "AVAILABLE", reservedOrderId: null, usedOrderId: null, usedAt: null } });
  await db.stockReservation.deleteMany({ where: { orderItem: { order: where } } });
  await db.orderStatusHistory.deleteMany({ where: { order: where } });
  await db.orderItem.deleteMany({ where: { order: where } }); await db.order.deleteMany({ where });
  await db.discount.deleteMany({ where }); await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.product.deleteMany({ where: { id: { in: products } } }); await db.category.deleteMany({ where: { id: { in: categories } } }); await db.$disconnect();
});
const formatted = (time: Date) => new Date(time.getTime() + 7 * 3600000).toISOString().slice(0, 19).replace("T", " ");
const sign = (value: ProviderStatus) => ({ ...value, signature_key: createHash("sha512").update(value.order_id + value.status_code + value.gross_amount + key).digest("hex") });
async function fixture(voucher = true) {
  const user = await db.user.create({ data: { name: "Webhook Fixture", email: `webhook-${randomUUID()}@example.test`, passwordHash: "not-a-login-hash" }, select: { id: true, role: true } }); ids.push(user.id);
  if (voucher) await db.$transaction(tx => issueNewBuyerVoucher(tx, user.id));
  const address = await buyer.createAddress(user, { recipientName: "Fixture", phone: "081200000000", addressLine: "Test", city: "Tanjungpinang", province: "Kepulauan Riau" });
  const category = await db.category.create({ data: { name: `Webhook ${randomUUID()}` } }); categories.push(category.id);
  const product = await db.product.create({ data: { categoryId: category.id, name: "Webhook product", description: "Test", price: 10000, physicalStock: 10 } }); products.push(product.id);
  await buyer.addItem(user, { productId: product.id, quantity: 2 });
  const quote = await checkout.quote(user, { addressId: address.id }), order = (await checkout.order(user, { quoteId: quote.quoteId }, randomUUID())).data;
  const payment = await createPaymentService(db, () => ({ async create() { const token = randomUUID(); return { token, redirectUrl: `https://app.sandbox.midtrans.com/snap/v3/redirection/${token}` }; } })).pay(user, order.id);
  let latest: ProviderStatus | null = { order_id: payment.providerOrderId, transaction_id: randomUUID(), status_code: "200", gross_amount: `${order.total}.00`, currency: "IDR", transaction_status: "settlement", payment_type: "bank_transfer", transaction_time: formatted(new Date()), settlement_time: formatted(new Date()) };
  let calls = 0;
  const service = createPaymentVerificationService(db, { serverKey: key, gateway: { async get() { calls++; return latest; } } });
  return { user, product, order, payment, service, set: (value: ProviderStatus | null) => { latest = value; }, latest: () => latest!, calls: () => calls, notify: (body = latest!) => service.notification(sign(body)) };
}
async function assertPaid(f: Awaited<ReturnType<typeof fixture>>) {
  expect((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("PROCESSING");
  expect(await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).toMatchObject({ physicalStock: 8, reservedStock: 0 });
  expect((await db.stockReservation.findUniqueOrThrow({ where: { orderItemId: f.order.items[0].id } })).status).toBe("CONSUMED");
  expect((await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).isFirstPurchase).toBe(false);
  expect(await db.paymentApplication.count({ where: { orderId: f.order.id } })).toBe(1);
}
describe("Webhook verified payment application PostgreSQL", () => {
  it("signature palsu/referensi/nominal/currency salah tidak memanggil provider atau memproses order", async () => {
    const f = await fixture();
    await expect(f.service.notification({ ...sign(f.latest()), signature_key: "0".repeat(128) })).rejects.toMatchObject({ status: 403 });
    await expect(f.notify({ ...f.latest(), order_id: `SV-${randomUUID()}` })).rejects.toMatchObject({ status: 404 });
    await expect(f.notify({ ...f.latest(), gross_amount: "1.00" })).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_MISMATCH" });
    await expect(f.notify({ ...f.latest(), currency: "USD" })).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_MISMATCH" });
    await expect(f.notify({ ...f.latest(), currency: "" })).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_MISMATCH" });
    expect(f.calls()).toBe(0); expect(await db.paymentApplication.count({ where: { orderId: f.order.id } })).toBe(0);
  });
  it("status API harus tersedia dan mencocokkan ref/transaction/nominal/currency sebelum sukses", async () => {
    const f = await fixture(), original = f.latest();
    for (const latest of [null, { ...original, transaction_id: randomUUID() }, { ...original, gross_amount: "1.00" }, { ...original, currency: "USD" }]) {
      f.set(latest); await expect(f.notify(original)).rejects.toBeDefined();
      expect(await db.paymentApplication.count({ where: { orderId: f.order.id } })).toBe(0);
    }
    expect((await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).physicalStock).toBe(10);
  });
  it("pending body tidak memaksa status jika Get Status terbaru sudah settlement", async () => {
    const f = await fixture();
    expect(await f.notify({ ...f.latest(), transaction_status: "pending", status_code: "201" })).toEqual({ accepted: true });
    await assertPaid(f);
    expect(await db.discount.findUniqueOrThrow({ where: { userId: f.user.id } })).toMatchObject({ status: "USED", reservedOrderId: null, usedOrderId: f.order.id });
  });
  it("body settlement tidak melunaskan jika status API masih pending atau capture challenge", async () => {
    for (const status of ["pending", "capture"]) {
      const f = await fixture(), body = f.latest(); f.set({ ...body, transaction_status: status, status_code: status === "pending" ? "201" : "200", payment_type: "credit_card", fraud_status: "challenge" });
      await f.notify(body);
      expect(await db.paymentApplication.count({ where: { orderId: f.order.id } })).toBe(0);
      expect((await db.discount.findUniqueOrThrow({ where: { userId: f.user.id } })).status).toBe("RESERVED");
    }
  });
  it("duplicate dan callback bersamaan mengonsumsi stok/voucher persis sekali", async () => {
    const f = await fixture(); await Promise.all(Array.from({ length: 4 }, () => f.notify())); await assertPaid(f);
    const first = await db.payment.findUniqueOrThrow({ where: { id: f.payment.paymentId } });
    await f.notify(); expect(await db.payment.findUniqueOrThrow({ where: { id: f.payment.paymentId } })).toEqual(first);
    expect(await db.paymentEvent.count({ where: { paymentId: f.payment.paymentId, source: "WEBHOOK", verification: "VERIFIED" } })).toBe(1);
    expect(await db.orderStatusHistory.count({ where: { orderId: f.order.id, toStatus: "PROCESSING" } })).toBe(1);
  });
  it("notifikasi/status pending atau expired lama tidak menurunkan sukses", async () => {
    const f = await fixture(); await f.notify();
    for (const status of ["pending", "expire", "deny"]) { f.set({ ...f.latest(), transaction_status: status }); await f.notify(); }
    expect((await db.payment.findUniqueOrThrow({ where: { id: f.payment.paymentId } })).status).toBe("SUCCESS"); await assertPaid(f);
  });
  it("pesanan tanpa voucher tetap sukses dan memperbarui first purchase tanpa membuat voucher", async () => {
    const f = await fixture(false); await f.notify(); await assertPaid(f);
    expect(await db.discount.count({ where: { userId: f.user.id } })).toBe(0);
  });
  it("gagal menulis history merollback payment/status/stok/voucher/application/flag lalu retry berhasil", async () => {
    const f = await fixture();
    const extended = db.$extends({ query: { orderStatusHistory: { async create() { throw new Error("fixture-application-failure"); } } } });
    const failing = createPaymentVerificationService(extended as unknown as typeof db, { serverKey: key, gateway: { get: async () => f.latest() } });
    await expect(failing.notification(sign(f.latest()))).rejects.toThrow("fixture-application-failure");
    expect((await db.payment.findUniqueOrThrow({ where: { id: f.payment.paymentId } })).status).toBe("PENDING");
    expect((await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).physicalStock).toBe(10);
    expect((await db.discount.findUniqueOrThrow({ where: { userId: f.user.id } })).status).toBe("RESERVED");
    expect((await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).isFirstPurchase).toBe(true);
    expect(await db.paymentApplication.count({ where: { orderId: f.order.id } })).toBe(0);
    await f.notify(); await assertPaid(f);
  });
  it("dua pembayaran sukses disimpan, fulfillment hanya sekali dan order perlu penanganan", async () => {
    const f = await fixture(); await f.notify();
    const second = await db.payment.create({ data: { orderId: f.order.id, providerOrderId: `SV-${randomUUID()}`, amount: f.order.total, expiresAt: new Date(f.order.paymentDeadline), status: "FAILED" } });
    f.set({ ...f.latest(), order_id: second.providerOrderId, transaction_id: randomUUID() }); await f.notify();
    expect(await db.payment.count({ where: { orderId: f.order.id, status: "SUCCESS" } })).toBe(2);
    expect(await db.paymentApplication.count({ where: { orderId: f.order.id } })).toBe(1);
    expect((await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).physicalStock).toBe(8);
    expect(await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).toMatchObject({ status: "NEEDS_ATTENTION", attentionReason: "DUPLICATE_SUCCESS_PAYMENT" });
  });
  it("refund/partial/reversal tidak mengembalikan stok atau voucher dan tidak turun lagi ke sukses", async () => {
    const f = await fixture(); await f.notify();
    for (const [provider, expected] of [["partial_refund", "PARTIALLY_REFUNDED"], ["refund", "REFUNDED"], ["reversal", "REVERSED"]]) {
      f.set({ ...f.latest(), transaction_status: provider }); await f.notify();
      expect((await db.payment.findUniqueOrThrow({ where: { id: f.payment.paymentId } })).status).toBe(expected);
    }
    f.set({ ...f.latest(), transaction_status: "settlement" }); await f.notify();
    expect((await db.payment.findUniqueOrThrow({ where: { id: f.payment.paymentId } })).status).toBe("REVERSED");
    expect((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("NEEDS_ATTENTION");
    expect((await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).physicalStock).toBe(8);
    expect((await db.discount.findUniqueOrThrow({ where: { userId: f.user.id } })).status).toBe("USED");
  });
  it("sukses setelah reservasi dilepas dicatat tanpa fulfillment/stock/voucher consumption", async () => {
    const f = await fixture();
    await db.stockReservation.update({ where: { orderItemId: f.order.items[0].id }, data: { status: "RELEASED", finalizedAt: new Date() } });
    await db.product.update({ where: { id: f.product.id }, data: { reservedStock: 0 } });
    await db.discount.update({ where: { userId: f.user.id }, data: { status: "AVAILABLE", reservedOrderId: null } });
    await db.order.update({ where: { id: f.order.id }, data: { status: "EXPIRED" } });
    await f.notify();
    expect((await db.payment.findUniqueOrThrow({ where: { id: f.payment.paymentId } })).status).toBe("SUCCESS");
    expect((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("NEEDS_ATTENTION");
    expect((await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).physicalStock).toBe(10);
    expect(await db.paymentApplication.count({ where: { orderId: f.order.id } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).isFirstPurchase).toBe(false);
  });
  it("timestamp sukses hilang atau status asing tidak mengizinkan fulfillment", async () => {
    const f = await fixture(), original = f.latest();
    f.set({ ...original, settlement_time: undefined }); await expect(f.notify(original)).rejects.toMatchObject({ status: 503 });
    f.set({ ...original, transaction_status: "future_provider_status" }); await expect(f.notify(original)).rejects.toMatchObject({ status: 503 });
    expect(await db.paymentApplication.count({ where: { orderId: f.order.id } })).toBe(0);
  });
  it("transaction_id terikat global dan tidak dapat dipindah ke order lain", async () => {
    const a = await fixture(), b = await fixture(); await a.notify();
    b.set({ ...b.latest(), transaction_id: a.latest().transaction_id });
    await expect(b.notify()).rejects.toMatchObject({ code: "PAYMENT_REFERENCE_CONFLICT" });
    expect(await db.paymentApplication.count({ where: { orderId: b.order.id } })).toBe(0);
  });
  it("deny/cancel/expire hanya memperbarui attempt, tidak melepas stok/voucher otomatis", async () => {
    for (const [provider, expected] of [["deny", "FAILED"], ["cancel", "CANCELLED"], ["expire", "EXPIRED"]]) {
      const f = await fixture(); f.set({ ...f.latest(), transaction_status: provider }); await f.notify();
      expect((await db.payment.findUniqueOrThrow({ where: { id: f.payment.paymentId } })).status).toBe(expected);
      expect((await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).reservedStock).toBe(2);
      expect((await db.discount.findUniqueOrThrow({ where: { userId: f.user.id } })).status).toBe("RESERVED");
      expect((await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).isFirstPurchase).toBe(true);
    }
  });
  it("waktu bayar provider, bukan waktu notifikasi, menentukan tenggat fulfillment", async () => {
    for (const late of [false, true]) {
      const f = await fixture(false), base = await db.order.findUniqueOrThrow({ where: { id: f.order.id } });
      const deadline = new Date(Date.now() - 60000), id = randomUUID();
      const order = await db.order.create({ data: { ...base, id, number: id, idempotencyKey: id, createdAt: new Date(deadline.getTime() - 3600000), paymentDeadline: deadline, items: { create: { productId: f.product.id, name: "Timed Fixture", quantity: 2, unitPrice: 10000, lineSubtotal: 20000, reservation: { create: { expiresAt: deadline, createdAt: new Date(deadline.getTime() - 3600000) } } } } } });
      await db.product.update({ where: { id: f.product.id }, data: { reservedStock: { increment: 2 } } });
      const p = await db.payment.create({ data: { orderId: order.id, providerOrderId: `SV-${randomUUID()}`, amount: order.total, status: "PENDING", createdAt: new Date(deadline.getTime() - 60000), expiresAt: deadline } });
      f.set({ ...f.latest(), order_id: p.providerOrderId, transaction_id: randomUUID(), settlement_time: formatted(new Date(deadline.getTime() + (late ? 10000 : -10000))) });
      await f.notify();
      expect((await db.order.findUniqueOrThrow({ where: { id } })).status).toBe(late ? "NEEDS_ATTENTION" : "PROCESSING");
      expect(await db.paymentApplication.count({ where: { orderId: id } })).toBe(late ? 0 : 1);
    }
  });
  it("refund sebelum penerapan sukses tidak memicu fulfillment, tetapi menutup kelayakan pembeli baru", async () => {
    const f = await fixture(); f.set({ ...f.latest(), transaction_status: "refund" }); await f.notify();
    expect((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("NEEDS_ATTENTION");
    expect(await db.paymentApplication.count({ where: { orderId: f.order.id } })).toBe(0);
    expect((await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).physicalStock).toBe(10);
    expect((await db.user.findUniqueOrThrow({ where: { id: f.user.id } })).isFirstPurchase).toBe(false);
  });
});
