import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "../../src/lib/db/client";
import { createBuyerService } from "../../src/services/buyer";
import { createCheckoutService } from "../../src/services/checkout";
import { createPaymentService } from "../../src/services/payments";
import { issueNewBuyerVoucher } from "../../src/services/vouchers";
import { paymentHandler } from "../../src/lib/payments/http";
import { ApiError } from "../../src/lib/api/errors";
import { SnapFailure, type SnapGateway, type SnapInput } from "../../src/lib/payments/snap";
import type { Principal } from "../../src/lib/auth/access";

const db = createDatabaseClient(), buyer = createBuyerService(db), checkout = createCheckoutService(db);
const ids: string[] = [], productIds: string[] = [], categoryIds: string[] = [];
const result = () => { const token = randomUUID(); return { token, redirectUrl: `https://app.sandbox.midtrans.com/snap/v3/redirection/${token}` }; };
afterAll(async () => {
  const where = { userId: { in: ids } };
  await db.paymentEvent.deleteMany({ where: { payment: { order: where } } });
  await db.payment.deleteMany({ where: { order: where } });
  await db.discount.updateMany({ where, data: { status: "AVAILABLE", reservedOrderId: null, usedOrderId: null, usedAt: null } });
  await db.stockReservation.deleteMany({ where: { orderItem: { order: where } } });
  await db.orderStatusHistory.deleteMany({ where: { order: where } });
  await db.orderItem.deleteMany({ where: { order: where } });
  await db.order.deleteMany({ where }); await db.discount.deleteMany({ where });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.product.deleteMany({ where: { id: { in: productIds } } }); await db.category.deleteMany({ where: { id: { in: categoryIds } } });
  await db.$disconnect();
});
async function fixture() {
  const u = await db.user.create({ data: { name: "Payment Fixture", email: `payment-${randomUUID()}@example.test`, passwordHash: "not-a-login-hash" }, select: { id: true, role: true } }); ids.push(u.id);
  await db.$transaction(tx => issueNewBuyerVoucher(tx, u.id));
  const a = await buyer.createAddress(u, { recipientName: "Fixture", phone: "081200000000", addressLine: "Test", city: "Tanjungpinang", province: "Kepulauan Riau" });
  const c = await db.category.create({ data: { name: `Payment ${randomUUID()}` } }); categoryIds.push(c.id);
  const p = await db.product.create({ data: { categoryId: c.id, name: "Original product", description: "Test", price: 10003, physicalStock: 10 } }); productIds.push(p.id);
  await buyer.addItem(u, { productId: p.id, quantity: 2 });
  const q = await checkout.quote(u, { addressId: a.id }), order = (await checkout.order(u, { quoteId: q.quoteId }, randomUUID())).data;
  return { u, a, p, order };
}
describe("Pembayaran Snap dengan PostgreSQL dan provider double", () => {
  it("snapshot/counter/reservasi tetap, token disimpan tanpa menandai order dibayar", async () => {
    const f = await fixture(); let sent: SnapInput | undefined; const token = result();
    await db.product.update({ where: { id: f.p.id }, data: { price: 90000, name: "Changed product" } });
    const service = createPaymentService(db, () => ({ async create(input) { sent = input; return token; } }));
    const value = await service.pay(f.u, f.order.id);
    expect(value).toMatchObject({ status: "PENDING", snapToken: token.token, redirectUrl: token.redirectUrl, reused: false });
    expect(sent).toMatchObject({ total: f.order.total, discount: f.order.discount, shippingFee: 10000, items: [{ name: "Original product", unitPrice: 10003, quantity: 2 }] });
    expect(sent!.deadline.toISOString()).toBe(f.order.paymentDeadline);
    expect(sent!.providerOrderId).not.toBe(f.order.number); expect(sent!.providerOrderId).not.toBe(f.order.id);
    expect((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("AWAITING_PAYMENT");
    expect((await db.product.findUniqueOrThrow({ where: { id: f.p.id } })).reservedStock).toBe(2);
    expect((await db.discount.findUniqueOrThrow({ where: { userId: f.u.id } })).status).toBe("RESERVED");
    expect((await db.user.findUniqueOrThrow({ where: { id: f.u.id } })).isFirstPurchase).toBe(true);
    expect(await db.paymentApplication.count({ where: { orderId: f.order.id } })).toBe(0);
    expect((await service.pay(f.u, f.order.id)).snapToken).toBe(token.token);
  });
  it("request bersamaan mengirim satu POST; CREATED persisten sudah ada sebelum network", async () => {
    const f = await fixture(); let calls = 0, release!: () => void, entered!: () => void;
    const enteredPromise = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const service = createPaymentService(db, () => ({ async create() {
      calls++; expect(await db.payment.count({ where: { orderId: f.order.id, status: "CREATED" } })).toBe(1); entered(); await gate; return result();
    } }));
    const first = service.pay(f.u, f.order.id); await enteredPromise;
    const next = await Promise.all(Array.from({ length: 3 }, () => service.pay(f.u, f.order.id)));
    expect(next.every(value => value.status === "CREATED" && value.snapToken === null)).toBe(true); expect(calls).toBe(1);
    release(); await first;
    expect(await db.payment.count({ where: { orderId: f.order.id } })).toBe(1);
    expect((await service.pay(f.u, f.order.id)).reused).toBe(true); expect(calls).toBe(1);
  });
  it("timeout/5xx/duplicate/response rusak menjadi UNCONFIRMED dan tidak membuka percobaan baru", async () => {
    for (const failure of [new SnapFailure("SNAP_UNCONFIRMED"), new Error("private-provider-detail")]) {
      const f = await fixture(); let calls = 0;
      const service = createPaymentService(db, () => ({ async create() { calls++; throw failure; } }));
      const value = await service.pay(f.u, f.order.id); expect(value.status).toBe("UNCONFIRMED"); expect(value.snapToken).toBeNull();
      expect((await service.pay(f.u, f.order.id)).paymentId).toBe(value.paymentId); expect(calls).toBe(1);
      expect((await db.discount.findUniqueOrThrow({ where: { userId: f.u.id } })).status).toBe("RESERVED");
    }
  });
  it("penolakan autentikasi definitif dicatat dan retry memakai referensi baru", async () => {
    const f = await fixture(); let calls = 0;
    const service = createPaymentService(db, () => ({ async create() { if (++calls === 1) throw new SnapFailure("SNAP_AUTH_REJECTED", true); return result(); } }));
    await expect(service.pay(f.u, f.order.id)).rejects.toMatchObject({ code: "MIDTRANS_REJECTED" });
    const first = await db.payment.findFirstOrThrow({ where: { orderId: f.order.id } }); expect(first.status).toBe("FAILED");
    const next = await service.pay(f.u, f.order.id); expect(next.providerOrderId).not.toBe(first.providerOrderId); expect(calls).toBe(2);
  });
  it("FAILED/CANCELLED/EXPIRED tanpa bukti penolakan request tidak membuka retry", async () => {
    for (const status of ["FAILED", "CANCELLED", "EXPIRED"] as const) {
      const f = await fixture();
      await db.payment.create({ data: { orderId: f.order.id, providerOrderId: `SV-${randomUUID()}`, amount: f.order.total, expiresAt: new Date(f.order.paymentDeadline), status } });
      const service = createPaymentService(db, () => { throw new Error("must not call gateway"); });
      await expect(service.pay(f.u, f.order.id)).rejects.toMatchObject({ code: "PAYMENT_RECONCILIATION_REQUIRED" });
    }
  });
  it("aktif yang expired lokal tetap memblokir, bukan langsung membuat token baru", async () => {
    const f = await fixture();
    const payment = await db.payment.create({ data: { orderId: f.order.id, providerOrderId: `SV-${randomUUID()}`, amount: f.order.total, status: "PENDING", createdAt: new Date(Date.now() - 600000), expiresAt: new Date(Date.now() - 1000) } });
    const value = await createPaymentService(db, () => { throw new Error("must not retry"); }).pay(f.u, f.order.id);
    expect(value.paymentId).toBe(payment.id); expect(value.snapToken).toBeNull(); expect(value.reused).toBe(true);
  });
  it("gagal menyimpan token setelah provider menerima tetap meninggalkan CREATED penghalang retry", async () => {
    const f = await fixture(); let calls = 0;
    const extended = db.$extends({ query: { payment: { async update() { throw new Error("fixture-db-failure"); } } } });
    const gateway = () => ({ async create() { calls++; return result(); } });
    await expect(createPaymentService(extended as unknown as typeof db, gateway).pay(f.u, f.order.id)).rejects.toThrow("fixture-db-failure");
    const recovery = await createPaymentService(db, gateway).pay(f.u, f.order.id);
    expect(recovery.status).toBe("CREATED"); expect(recovery.snapToken).toBeNull(); expect(calls).toBe(1);
  });
  it("akses/order/status/deadline/config diperiksa sebelum membuat percobaan", async () => {
    const f = await fixture(), other = await fixture();
    const service = createPaymentService(db, () => { throw new ApiError(503, "ENV_NOT_CONFIGURED", "Fixture missing configuration"); });
    await expect(service.pay(null, f.order.id)).rejects.toMatchObject({ status: 401 });
    await expect(service.pay({ id: f.u.id, role: "ADMIN" }, f.order.id)).rejects.toMatchObject({ status: 403 });
    await expect(service.pay(other.u, f.order.id)).rejects.toMatchObject({ status: 404 });
    await expect(service.pay(f.u, f.order.id)).rejects.toMatchObject({ status: 503 });
    expect(await db.payment.count({ where: { orderId: f.order.id } })).toBe(0);
    await db.order.update({ where: { id: f.order.id }, data: { status: "PROCESSING" } });
    await expect(service.pay(f.u, f.order.id)).rejects.toMatchObject({ code: "ORDER_NOT_PAYABLE" });
  });
  it("penyimpanan partial index menolak percobaan aktif ganda", async () => {
    const f = await fixture();
    const data = { orderId: f.order.id, amount: f.order.total, expiresAt: new Date(f.order.paymentDeadline) };
    await db.payment.create({ data: { ...data, providerOrderId: `SV-${randomUUID()}` } });
    await expect(db.payment.create({ data: { ...data, providerOrderId: `SV-${randomUUID()}` } })).rejects.toMatchObject({ code: "P2002" });
  });
  it("tenggat berakhir atau kurang satu menit menolak pembuatan tanpa menggeser deadline", async () => {
    const f = await fixture(), base = await db.order.findUniqueOrThrow({ where: { id: f.order.id } });
    for (const remaining of [-1000, 30000]) {
      const deadline = new Date(Date.now() + remaining), id = randomUUID();
      await db.order.create({ data: { ...base, id, number: id, idempotencyKey: randomUUID(), discountId: null, discount: 0, total: base.subtotal + base.shippingFee, createdAt: new Date(deadline.getTime() - 3600000), paymentDeadline: deadline } });
      const service = createPaymentService(db, () => { throw new Error("must not call"); });
      await expect(service.pay(f.u, id)).rejects.toMatchObject({ code: remaining < 0 ? "ORDER_PAYMENT_EXPIRED" : "PAYMENT_WINDOW_TOO_SHORT" });
      expect(await db.payment.count({ where: { orderId: id } })).toBe(0);
    }
  });
  it("hasil Snap terlambat tidak menurunkan status sukses dari penerapan provider terverifikasi", async () => {
    const f = await fixture();
    const service = createPaymentService(db, () => ({ async create(input) {
      await db.payment.update({ where: { providerOrderId: input.providerOrderId }, data: { status: "SUCCESS", paidAt: new Date() } });
      return result();
    } }));
    const value = await service.pay(f.u, f.order.id); expect(value.status).toBe("SUCCESS"); expect(value.snapToken).toBeNull();
    expect((await db.order.findUniqueOrThrow({ where: { id: f.order.id } })).status).toBe("AWAITING_PAYMENT");
  });
  it("HTTP owner/role/Origin dan payload strict; status 201/200/202 privat tanpa secret", async () => {
    const f = await fixture(); let principal: Principal | null = f.u;
    const gateway: SnapGateway = { create: async () => result() };
    const handler = paymentHandler(() => ({ service: createPaymentService(db, () => gateway), principal: async () => principal, appUrl: "https://payment.example.test" }));
    const req = (body = {}, origin = "https://payment.example.test") => new Request("https://payment.example.test/api/orders/test/payments", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    expect((await handler(req({ amount: 1 }), f.order.id)).status).toBe(422);
    expect((await handler(req({}, "https://evil.example.test"), f.order.id)).status).toBe(403);
    principal = null; expect((await handler(req(), f.order.id)).status).toBe(401); principal = f.u;
    const first = await handler(req(), f.order.id); expect(first.status).toBe(201); expect(first.headers.get("vary")).toBe("Cookie"); expect(first.headers.get("cache-control")).toBe("no-store");
    expect((await handler(req(), f.order.id)).status).toBe(200);
    const json = await first.json(); expect(Object.keys(json.data).sort()).toEqual(["orderId", "paymentId", "providerOrderId", "status", "snapToken", "redirectUrl", "expiresAt", "reused"].sort());
    const uncertain = await fixture();
    const unknownHandler = paymentHandler(() => ({ service: createPaymentService(db, () => ({ async create() { throw new Error("private detail"); } })), principal: async () => uncertain.u, appUrl: "https://payment.example.test" }));
    const unknown = await unknownHandler(req(), uncertain.order.id); expect(unknown.status).toBe(202); expect((await unknown.json()).data.status).toBe("UNCONFIRMED");
  });
});
