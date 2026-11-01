import { randomBytes, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "../../src/lib/db/client";
import { createAuthService } from "../../src/services/auth";
import { createVoucherService, issueNewBuyerVoucher } from "../../src/services/vouchers";
import type { Principal } from "../../src/lib/auth/access";
import { rateLimitKey, AUTH_WINDOW_MS } from "../../src/lib/auth/rate-limit";
import { priceBuyerCart, readPricingInputs } from "../../src/services/pricing";

const db = createDatabaseClient(), voucherService = createVoucherService(db);
const settings = { authSecret: randomBytes(32).toString("hex"), appUrl: "https://vouchers.example.test", sessionTtlDays: 7 };
const auth = createAuthService(db, settings), started = Date.now();
const password = randomBytes(20).toString("base64url"), ids: string[] = [], emails: string[] = [], orderIds: string[] = [];
const categoryIds: string[] = [], productIds: string[] = [];
let passwordHash: string;
beforeAll(async () => { passwordHash = await hash(password, 12); });
afterAll(async () => {
  await db.discount.updateMany({ where: { userId: { in: ids } }, data: { status: "AVAILABLE", reservedOrderId: null, usedOrderId: null, usedAt: null } });
  await db.paymentApplication.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.discount.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.product.deleteMany({ where: { id: { in: productIds } } });
  await db.category.deleteMany({ where: { id: { in: categoryIds } } });
  const keys: string[] = [];
  for (let time = Math.floor(started / AUTH_WINDOW_MS) * AUTH_WINDOW_MS; time <= Date.now(); time += AUTH_WINDOW_MS) {
    for (const operation of ["register", "login"]) {
      keys.push(rateLimitKey(`auth.${operation}.global`, "all", settings.authSecret, new Date(time)));
      for (const email of emails) keys.push(rateLimitKey(`auth.${operation}.email`, email, settings.authSecret, new Date(time)));
    }
  }
  await db.rateLimit.deleteMany({ where: { key: { in: keys } } });
  await db.$disconnect();
});
async function user(role: "BUYER" | "ADMIN" = "BUYER", isFirstPurchase = true) {
  const email = `voucher-${randomUUID()}@example.test`; emails.push(email);
  const value = await db.user.create({ data: { name: "Voucher Fixture", email, passwordHash, role, isFirstPurchase } }); ids.push(value.id); return value;
}
async function order(userId: string) {
  const id = randomUUID();
  const value = await db.order.create({ data: { id, number: id, userId, idempotencyKey: id, inputHash: "a".repeat(64), recipientName: "Fixture", phone: "0800000000", addressLine: "Test", city: "Test", province: "Test", subtotal: 10000, total: 10000, shippingFee: 0, shippingLabel: "TEST ONLY", paymentDeadline: new Date(Date.now() + 1800000) } }); orderIds.push(id); return value;
}
const issue = (id: string) => db.$transaction(tx => issueNewBuyerVoucher(tx, id));
describe("Voucher pembeli baru PostgreSQL", () => {
  it("registrasi/login pertama menerbitkan satu voucher tetap tanpa mengubah pembelian pertama", async () => {
    const email = `voucher-register-${randomUUID()}@example.test`; emails.push(email);
    const result = await auth.register({ name: "Voucher Fixture", email, password, confirmPassword: password }); ids.push(result.user.id);
    expect(await voucherService.mine(result.user)).toMatchObject({ voucher: { type: "NEW_BUYER", percentage: 20, maxDiscount: 100000, status: "AVAILABLE", reservedOrderId: null, usedAt: null } });
    expect((await db.user.findUniqueOrThrow({ where: { id: result.user.id } })).isFirstPurchase).toBe(true);
    const id = (await voucherService.mine(result.user)).voucher!.id;
    await auth.login({ email, password });
    expect((await voucherService.mine(result.user)).voucher!.id).toBe(id);
  });
  it("login pertama bersamaan membuat tepat satu voucher dan seluruh sesi valid", async () => {
    const u = await user();
    const results = await Promise.all(Array.from({ length: 4 }, () => auth.login({ email: u.email, password })));
    expect(await db.discount.count({ where: { userId: u.id } })).toBe(1);
    for (const result of results) expect((await auth.currentUser(result.session.token))?.id).toBe(u.id);
  });
  it("admin dan pembeli yang sudah pernah membayar tidak diterbitkan voucher", async () => {
    for (const u of [await user("ADMIN"), await user("BUYER", false)]) {
      await auth.login({ email: u.email, password });
      expect(await db.discount.count({ where: { userId: u.id } })).toBe(0);
    }
  });
  it("riwayat sukses/refund/reversal tetap menggugurkan kelayakan saat flag belum sinkron", async () => {
    for (const status of ["SUCCESS", "REFUNDED", "PARTIALLY_REFUNDED", "REVERSED"] as const) {
      const u = await user(), o = await order(u.id);
      await db.payment.create({ data: { orderId: o.id, providerOrderId: randomUUID(), amount: o.total, status, expiresAt: new Date(Date.now() + 1800000), paidAt: new Date() } });
      await issue(u.id); expect(await db.discount.count({ where: { userId: u.id } })).toBe(0);
    }
  });
  it("application sukses tetap tidak layak; pending/gagal belum membeli", async () => {
    const paid = await user(), o = await order(paid.id);
    const p = await db.payment.create({ data: { orderId: o.id, providerOrderId: randomUUID(), amount: o.total, status: "SUCCESS", paidAt: new Date(), expiresAt: new Date(Date.now() + 1800000) } });
    await db.paymentApplication.create({ data: { orderId: o.id, paymentId: p.id } });
    await issue(paid.id); expect(await db.discount.count({ where: { userId: paid.id } })).toBe(0);
    for (const status of ["PENDING", "FAILED", "EXPIRED", "CANCELLED"] as const) {
      const u = await user(), pending = await order(u.id);
      await db.payment.create({ data: { orderId: pending.id, providerOrderId: randomUUID(), amount: pending.total, status, expiresAt: new Date(Date.now() + 1800000) } });
      await issue(u.id); expect(await db.discount.count({ where: { userId: u.id } })).toBe(1);
    }
  });
  it("login tidak mereset RESERVED/USED, referensi order atau usedAt", async () => {
    for (const status of ["RESERVED", "USED"] as const) {
      const u = await user(), o = await order(u.id); await issue(u.id);
      await db.discount.update({ where: { userId: u.id }, data: status === "RESERVED" ? { status, reservedOrderId: o.id } : { status, usedOrderId: o.id, usedAt: new Date() } });
      const before = await db.discount.findUniqueOrThrow({ where: { userId: u.id } });
      await auth.login({ email: u.email, password });
      expect(await db.discount.findUniqueOrThrow({ where: { userId: u.id } })).toEqual(before);
    }
  });
  it("pembacaan hanya milik akun, tanpa efek penerbitan dan tanpa field internal", async () => {
    const a = await user(), b = await user(); await issue(a.id);
    expect(await voucherService.mine(b)).toEqual({ voucher: null });
    expect(await db.discount.count({ where: { userId: b.id } })).toBe(0);
    expect(Object.keys((await voucherService.mine(a)).voucher!).sort()).toEqual(["id", "maxDiscount", "percentage", "reservedOrderId", "status", "type", "usedAt"].sort());
    await expect(voucherService.mine(null)).rejects.toMatchObject({ status: 401 });
    await expect(voucherService.mine({ id: a.id, role: "ADMIN" } as Principal)).rejects.toMatchObject({ status: 403 });
  });
  it("gagal setelah penerbitan merollback voucher, sesi baru dan rotasi", async () => {
    const u = await user();
    const existing = await auth.login({ email: u.email, password });
    await db.discount.delete({ where: { userId: u.id } });
    const failing = createAuthService(db, settings, async (tx, principal) => { await issueNewBuyerVoucher(tx, principal.id); throw new Error("fixture-failure"); });
    const email = `voucher-rollback-${randomUUID()}@example.test`; emails.push(email);
    await expect(failing.register({ name: "Rollback Fixture", email, password, confirmPassword: password })).rejects.toThrow("fixture-failure");
    expect(await db.user.findUnique({ where: { email } })).toBeNull();
    await expect(failing.login({ email: u.email, password }, existing.session.token)).rejects.toThrow("fixture-failure");
    expect(await db.discount.count({ where: { userId: u.id } })).toBe(0);
    expect((await auth.currentUser(existing.session.token))?.id).toBe(u.id);
    expect(await db.session.count({ where: { userId: u.id } })).toBe(1);
  });
  it("input harga berasal dari cart pemilik dan harga terkini, tanpa mencadangkan voucher/stok", async () => {
    const u = await user(), other = await user(); await issue(u.id);
    const c = await db.category.create({ data: { name: `Pricing ${randomUUID()}` } }); categoryIds.push(c.id);
    const p = await db.product.create({ data: { categoryId: c.id, name: "Pricing Fixture", description: "Test", price: 10003, physicalStock: 4, reservedStock: 1 } }); productIds.push(p.id);
    await db.cart.create({ data: { userId: u.id, items: { create: { productId: p.id, quantity: 2 } } } });
    const read = () => db.$transaction(tx => readPricingInputs(tx, u), { isolationLevel: "RepeatableRead" });
    const price = () => db.$transaction(tx => priceBuyerCart(tx, u, 10000), { isolationLevel: "RepeatableRead" });
    const inputs = await read(); expect(inputs.subtotal).toBe(20006); expect(inputs.eligibleVoucherId).not.toBeNull();
    expect(await price()).toMatchObject({ subtotal: 20006, discount: 4001, shippingFee: 10000, total: 26005, currency: "IDR", voucher: { id: inputs.eligibleVoucherId, discount: 4001 } });
    await expect(db.$transaction(tx => readPricingInputs(tx, other))).rejects.toMatchObject({ code: "CART_EMPTY" });
    await db.product.update({ where: { id: p.id }, data: { price: 20001 } });
    expect((await read()).subtotal).toBe(40002);
    expect(await price()).toMatchObject({ subtotal: 40002, discount: 8000, total: 42002 });
    expect((await db.discount.findUniqueOrThrow({ where: { userId: u.id } })).status).toBe("AVAILABLE");
    expect((await db.product.findUniqueOrThrow({ where: { id: p.id } })).reservedStock).toBe(1);
    const o = await order(u.id);
    await db.discount.update({ where: { userId: u.id }, data: { status: "RESERVED", reservedOrderId: o.id } });
    expect((await read()).eligibleVoucherId).toBeNull();
    expect(await price()).toMatchObject({ discount: 0, total: 50002, voucher: null });
    await db.discount.update({ where: { userId: u.id }, data: { status: "AVAILABLE", reservedOrderId: null } });
    await db.user.update({ where: { id: u.id }, data: { isFirstPurchase: false } });
    expect(await price()).toMatchObject({ discount: 0, voucher: null });
    await db.product.update({ where: { id: p.id }, data: { physicalStock: 2 } });
    await expect(read()).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    await db.product.update({ where: { id: p.id }, data: { isActive: false } });
    await expect(read()).rejects.toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
  });
  it("perhitungan cart menerapkan cap dan tanpa voucher tidak menerbitkan apa pun", async () => {
    const u = await user();
    const c = await db.category.create({ data: { name: `Pricing cap ${randomUUID()}` } }); categoryIds.push(c.id);
    const p = await db.product.create({ data: { categoryId: c.id, name: "Cap Fixture", description: "Test", price: 600003, physicalStock: 1 } }); productIds.push(p.id);
    await db.cart.create({ data: { userId: u.id, items: { create: { productId: p.id, quantity: 1 } } } });
    const price = () => db.$transaction(tx => priceBuyerCart(tx, u, 10000), { isolationLevel: "RepeatableRead" });
    expect(await price()).toMatchObject({ discount: 0, total: 610003, voucher: null });
    expect(await db.discount.count({ where: { userId: u.id } })).toBe(0);
    await issue(u.id);
    expect(await price()).toMatchObject({ subtotal: 600003, discount: 100000, total: 510003 });
    expect((await db.discount.findUniqueOrThrow({ where: { userId: u.id } })).status).toBe("AVAILABLE");
  });
});
