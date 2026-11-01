import { createHash, randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabaseClient } from "../../src/lib/db/client";
import { createAuthService } from "../../src/services/auth";
import { createBuyerService } from "../../src/services/buyer";
import { createCheckoutService } from "../../src/services/checkout";
import { createPaymentService } from "../../src/services/payments";
import { createPaymentVerificationService } from "../../src/services/payment-verification";
import { createOrderService } from "../../src/services/orders";
import { createReviewService } from "../../src/services/reviews";
import { createDashboardService } from "../../src/services/dashboard";
import { createCatalogService } from "../../src/services/catalog";
import { issueNewBuyerVoucher } from "../../src/services/vouchers";
import { rateLimitKey } from "../../src/lib/auth/rate-limit";
import { sessionToken, SESSION_COOKIE } from "../../src/lib/auth/session";
import { reviewHandlers } from "../../src/lib/reviews/http";
import { orderHandlers } from "../../src/lib/orders/http";
import { dashboardHandlers } from "../../src/lib/dashboard/http";
import type { Principal } from "../../src/lib/auth/access";
import type { ProviderStatus } from "../../src/lib/payments/status";

// No provider HTTP is permitted. Database access is real and TEST-only.
const db = createDatabaseClient(), users: Principal[] = [], products: string[] = [], categories: string[] = [], authEmails: string[] = [];
const run = randomUUID(), started = Date.now(), secret = randomBytes(32).toString("hex"), key = "SB-Mid-server-be14-fixture";
const settings = { authSecret: secret, appUrl: "https://be14.example.test", sessionTtlDays: 7 };
const auth = createAuthService(db, settings), buyer = createBuyerService(db), checkout = createCheckoutService(db);
const orders = createOrderService(db), reviews = createReviewService(db), dashboard = createDashboardService(db);
const noNetwork = vi.fn(async () => { throw new Error("Provider HTTP forbidden in BE14 fixture"); });
let admin: Principal;
const formatTime = (time: Date) => new Date(time.getTime() + 7 * 3600000).toISOString().slice(0, 19).replace("T", " ");
const period = { from: "2000-01-01T00:00:00Z", to: "2100-01-01T00:00:00Z" };

beforeAll(async () => {
  const identity = await db.$queryRaw<Array<{ name: string; port: number }>>`SELECT current_database() AS name, inet_server_port() AS port`;
  expect(identity[0]).toEqual({ name: "salvora_kitchen_test", port: 55433 });
  vi.stubGlobal("fetch", noNetwork);
  admin = await account("ADMIN");
});
afterAll(async () => {
  try {
    const where = { userId: { in: users.map(user => user.id) } };
    // Only IDs created by this run. Never reset/truncate tables or provider fixtures.
    await db.rating.deleteMany({ where: { orderItem: { order: where } } });
    await db.paymentEvent.deleteMany({ where: { payment: { order: where } } });
    await db.paymentApplication.deleteMany({ where: { order: where } });
    await db.payment.deleteMany({ where: { order: where } });
    await db.discount.updateMany({ where, data: { status: "AVAILABLE", reservedOrderId: null, usedOrderId: null, usedAt: null } });
    await db.stockReservation.deleteMany({ where: { orderItem: { order: where } } });
    await db.orderStatusHistory.deleteMany({ where: { order: where } });
    await db.orderItem.deleteMany({ where: { order: where } });
    await db.order.deleteMany({ where }); await db.discount.deleteMany({ where });
    await db.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
    await db.product.deleteMany({ where: { id: { in: products } } });
    await db.category.deleteMany({ where: { id: { in: categories } } });
    const limiterKeys: string[] = [];
    for (let time = started - 900000; time <= Date.now() + 900000; time += 900000) {
      limiterKeys.push(rateLimitKey("auth.register.global", "all", secret, new Date(time)));
      for (const email of authEmails) limiterKeys.push(rateLimitKey("auth.register.email", email, secret, new Date(time)));
    }
    await db.rateLimit.deleteMany({ where: { key: { in: limiterKeys } } });
    expect(noNetwork).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); await db.$disconnect(); }
});
async function account(role: Principal["role"] = "BUYER") {
  const user = await db.user.create({ data: { name: "BE14 Fixture", email: `be14-${run}-${randomUUID()}@example.test`, passwordHash: "not-a-login-hash", role }, select: { id: true, role: true } });
  users.push(user); return user;
}
async function fixture({ paid = true, registered = false, pickup = false } = {}) {
  let user: Principal, token: string | null = null;
  if (registered) {
    const email = `be14-register-${run}@example.test`, password = randomBytes(18).toString("base64url"); authEmails.push(email);
    const result = await auth.register({ name: "BE14 Buyer", email, password, confirmPassword: password });
    user = result.user; users.push(user); token = result.session.token;
  } else { user = await account(); await db.$transaction(tx => issueNewBuyerVoucher(tx, user.id)); }
  const address = await buyer.createAddress(user, { recipientName: "BE14 Fixture", phone: "081200000000", addressLine: "Fixture address", city: "Tanjungpinang", province: "Kepulauan Riau" });
  const category = await db.category.create({ data: { name: `BE14 ${run} ${randomUUID()}` } }); categories.push(category.id);
  const product = await db.product.create({ data: { categoryId: category.id, name: "BE14 Historical Product", description: "Fixture only", price: 10000, physicalStock: 20, isDemo: true } }); products.push(product.id);
  await buyer.addItem(user, { productId: product.id, quantity: 2 });
  const quote = await checkout.quote(user, pickup ? { shippingMode: "PICKUP", contact: { recipientName: "Pickup Fixture", phone: "081200000000" } } : { addressId: address.id });
  const idempotency = randomUUID();
  const order = (await checkout.order(user, { quoteId: quote.quoteId }, idempotency)).data;
  const snap = vi.fn(async () => { const token = randomUUID(); return { token, redirectUrl: `https://app.sandbox.midtrans.com/snap/v3/redirection/${token}` }; });
  const paymentService = createPaymentService(db, () => ({ create: snap }));
  const payment = await paymentService.pay(user, order.id);
  let latest: ProviderStatus = { order_id: payment.providerOrderId, transaction_id: randomUUID(), status_code: "200", gross_amount: `${order.total}.00`, currency: "IDR", transaction_status: "settlement", payment_type: "bank_transfer", transaction_time: formatTime(new Date()), settlement_time: formatTime(new Date()) };
  const status = vi.fn(async () => latest);
  const verification = createPaymentVerificationService(db, { serverKey: key, gateway: { get: status } });
  const notify = () => verification.notification({ ...latest, signature_key: createHash("sha512").update(latest.order_id + latest.status_code + latest.gross_amount + key).digest("hex") });
  if (paid) await notify();
  return { user, token, address, category, product, quote, idempotency, order, payment, snap, paymentService, status, notify, refund: () => { latest = { ...latest, transaction_status: "refund" }; } };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const ship = (f: Fixture, service = orders) => service.fulfill(admin, f.order.id, { status: "SHIPPED", expectedStatus: "PROCESSING" });
async function complete(f: Fixture) {
  await ship(f); return orders.fulfill(admin, f.order.id, { status: "COMPLETED", expectedStatus: "SHIPPED", receiptConfirmed: true, note: "Penerimaan fixture dikonfirmasi manual." });
}
const reviewInput = { rating: 5, comment: "Makanan fixture diterima dengan baik." };

describe("BE14 PostgreSQL integration, provider MOCK only", () => {
  it("akun baru sampai pembayaran mock, pemenuhan, ulasan dan dashboard", async () => {
    const f = await fixture({ registered: true });
    expect(await auth.currentUser(f.token)).toMatchObject({ id: f.user.id, role: "BUYER" });
    const replay = (await checkout.order(f.user, { quoteId: f.quote.quoteId }, f.idempotency)).data;
    expect(replay.id).toBe(f.order.id); expect(f.snap).toHaveBeenCalledTimes(1); expect(f.status).toHaveBeenCalledTimes(1);
    expect(await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).toMatchObject({ physicalStock: 18, reservedStock: 0 });
    await complete(f);
    const handlers = reviewHandlers(() => ({ service: reviews, appUrl: settings.appUrl, principal: async () => auth.currentUser(sessionToken(new Request(settings.appUrl, { headers: { Cookie: `${SESSION_COOKIE}=${f.token}` } }))) }));
    const response = await handlers.create(new Request(`${settings.appUrl}/api/order-items/${f.order.items[0].id}/review`, { method: "POST", headers: { Origin: settings.appUrl, "Content-Type": "application/json" }, body: JSON.stringify(reviewInput) }), f.order.items[0].id);
    expect(response.status).toBe(201);
    expect((await reviews.list(f.product.id, {})).summary).toEqual({ averageRating: 5, reviewCount: 1 });
    expect(await createCatalogService(db).publicProduct(f.product.id)).toMatchObject({ averageRating: 5, reviewCount: 1 });
    const vouchers = await dashboard.vouchers(admin, { status: "USED", pageSize: "100" });
    expect(vouchers.data.find(row => row.owner.id === f.user.id)).toMatchObject({ usedOrderId: f.order.id, orderNumber: f.order.number });
    expect((await dashboard.dashboard(admin, period)).ordersByStatus.find(row => row.status === "COMPLETED")!.count).toBeGreaterThan(0);
    expect(await db.paymentApplication.count({ where: { orderId: f.order.id } })).toBe(1);
    expect((await orders.detail(f.user, f.order.id)).items[0].canReview).toBe(false);
  });
  it("BE11 owner/filters/snapshot dan catatan privat memakai data nyata", async () => {
    const f = await fixture(), other = await account();
    await expect(orders.detail(other, f.order.id)).rejects.toMatchObject({ status: 404 });
    expect((await orders.buyerOrders(other, {})).data).toEqual([]);
    await buyer.updateAddress(f.user, f.address.id, { addressLine: "Alamat baru" });
    await db.product.update({ where: { id: f.product.id }, data: { name: "Changed", price: 15000 } });
    await orders.addNote(admin, f.order.id, { note: "Catatan privat fixture" });
    const value = await orders.detail(f.user, f.order.id);
    expect(value.items[0]).toMatchObject({ name: "BE14 Historical Product", unitPrice: 10000 }); expect(value.address.addressLine).toBe("Fixture address");
    expect(JSON.stringify(value)).not.toContain("Catatan privat fixture");
    expect(JSON.stringify(await orders.detail(admin, f.order.id))).toContain("Catatan privat fixture");
    expect((await orders.adminOrders(admin, { q: f.order.number, paymentStatus: "SUCCESS", channel: "bank_transfer" })).data.map(row => row.id)).toEqual([f.order.id]);
    expect((await orders.adminOrders(admin, { q: f.order.number, paymentStatus: "FAILED", channel: "bank_transfer" })).data).toEqual([]);
  });
  it("BE11 belum dibayar/transisi ilegal/konfirmasi kurang ditolak tanpa mutasi", async () => {
    const f = await fixture({ paid: false });
    await expect(ship(f)).rejects.toMatchObject({ status: 409 });
    await f.notify(); await expect(orders.fulfill(admin, f.order.id, { status: "COMPLETED", expectedStatus: "PROCESSING", receiptConfirmed: true, note: "Fixture confirmation" })).rejects.toMatchObject({ code: "ORDER_TRANSITION_INVALID" });
    await ship(f); await expect(orders.fulfill(admin, f.order.id, { status: "COMPLETED", expectedStatus: "SHIPPED" })).rejects.toMatchObject({ code: "RECEIPT_CONFIRMATION_REQUIRED" });
    expect((await orders.detail(admin, f.order.id)).status).toBe("SHIPPED");
  });
  it("BE11 dua kirim bersamaan hanya satu transisi dan satu history", async () => {
    const f = await fixture(), results = await Promise.allSettled([ship(f), ship(f)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await db.orderStatusHistory.count({ where: { orderId: f.order.id, fromStatus: "PROCESSING", toStatus: "SHIPPED" } })).toBe(1);
  });
  it("BE11 gagal history merollback status pengiriman", async () => {
    const f = await fixture();
    const fail = db.$extends({ query: { orderStatusHistory: { async create() { throw new Error("be14-history-rollback"); } } } });
    await expect(ship(f, createOrderService(fail as unknown as typeof db))).rejects.toThrow("be14-history-rollback");
    expect((await orders.detail(admin, f.order.id)).status).toBe("PROCESSING");
    expect(await db.orderStatusHistory.count({ where: { orderId: f.order.id, toStatus: "SHIPPED" } })).toBe(0);
    await ship(f);
  });
  it("BE11 catatan concurrent tidak hilang atau mengubah status/nominal", async () => {
    const f = await fixture(); await Promise.all(["Catatan fixture A", "Catatan fixture B"].map(note => orders.addNote(admin, f.order.id, { note })));
    const value = await orders.detail(admin, f.order.id); expect(value.status).toBe("PROCESSING"); expect(value.total).toBe(f.order.total);
    expect(value.history.filter(row => row.actor === "ADMIN" && row.fromStatus === row.toStatus)).toHaveLength(2);
  });
  it("BE12 owner/belum selesai/validasi batas diperiksa saat penyimpanan", async () => {
    const f = await fixture(), other = await account();
    await expect(reviews.create(other, f.order.items[0].id, reviewInput)).rejects.toMatchObject({ status: 404 });
    await expect(reviews.create(f.user, f.order.items[0].id, reviewInput)).rejects.toMatchObject({ code: "ORDER_NOT_COMPLETED" });
    await complete(f);
    await expect(reviews.create(f.user, f.order.items[0].id, { rating: 6, comment: "x".repeat(10) })).rejects.toBeDefined();
    await expect(reviews.create(f.user, f.order.items[0].id, { rating: 1, comment: "x".repeat(9) })).rejects.toBeDefined();
    await expect(reviews.create(f.user, f.order.items[0].id, { rating: 1, comment: "x".repeat(1001) })).rejects.toBeDefined();
    expect(await db.rating.count({ where: { orderItemId: f.order.items[0].id } })).toBe(0);
  });
  it("BE12 dua Submit bersamaan menghasilkan satu ulasan", async () => {
    const f = await fixture(); await complete(f);
    const results = await Promise.allSettled([reviews.create(f.user, f.order.items[0].id, reviewInput), reviews.create(f.user, f.order.items[0].id, reviewInput)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find(result => result.status === "rejected")).toMatchObject({ reason: { code: "REVIEW_EXISTS" } });
    expect(await db.rating.count({ where: { orderItemId: f.order.items[0].id } })).toBe(1);
    // Bypassing the service still cannot defeat the database uniqueness guard.
    await expect(db.rating.create({ data: { orderItemId: f.order.items[0].id, ...reviewInput } })).rejects.toMatchObject({ code: "P2002" });
  });
  it("BE12 error setelah insert merollback ulasan dan agregasi", async () => {
    const f = await fixture(); await complete(f);
    const fail = db.$extends({ query: { rating: { async create({ args, query }) { await query(args); throw new Error("be14-review-rollback"); } } } });
    await expect(createReviewService(fail as unknown as typeof db).create(f.user, f.order.items[0].id, reviewInput)).rejects.toThrow("be14-review-rollback");
    expect((await reviews.list(f.product.id, {})).summary).toEqual({ averageRating: null, reviewCount: 0 });
    expect((await orders.detail(f.user, f.order.id)).items[0].canReview).toBe(true);
  });
  it("BE12 produk sama pada dua pesanan: dua ulasan dan rata-rata katalog cocok", async () => {
    const f = await fixture(); await complete(f); await reviews.create(f.user, f.order.items[0].id, reviewInput);
    await buyer.addItem(f.user, { productId: f.product.id, quantity: 1 });
    const q = await checkout.quote(f.user, { addressId: f.address.id }), second = (await checkout.order(f.user, { quoteId: q.quoteId }, randomUUID())).data;
    const payment = await f.paymentService.pay(f.user, second.id);
    const status: ProviderStatus = { order_id: payment.providerOrderId, transaction_id: randomUUID(), status_code: "200", gross_amount: `${second.total}.00`, currency: "IDR", transaction_status: "settlement", payment_type: "bank_transfer", transaction_time: formatTime(new Date()), settlement_time: formatTime(new Date()) };
    await createPaymentVerificationService(db, { serverKey: key, gateway: { get: async () => status } }).notification({ ...status, signature_key: createHash("sha512").update(status.order_id + status.status_code + status.gross_amount + key).digest("hex") });
    await complete({ ...f, order: second }); await reviews.create(f.user, second.items[0].id, { rating: 3, comment: "x".repeat(1000) });
    expect((await reviews.list(f.product.id, { pageSize: "1" })).summary).toEqual({ averageRating: 4, reviewCount: 2 });
    expect(await createCatalogService(db).publicProduct(f.product.id)).toMatchObject({ averageRating: 4, reviewCount: 2 });
    expect((await reviews.list(f.product.id, { page: "3", pageSize: "1" })).data).toEqual([]);
  });
  it("race refund dengan kirim: NEEDS_ATTENTION, tanpa pemenuhan/stock ganda", async () => {
    const f = await fixture(); f.refund();
    const results = await Promise.allSettled([f.notify(), ship(f)]); expect(results[0].status).toBe("fulfilled");
    expect((await orders.detail(admin, f.order.id)).status).toBe("NEEDS_ATTENTION");
    expect(await db.paymentApplication.count({ where: { orderId: f.order.id } })).toBe(1);
    expect(await db.product.findUniqueOrThrow({ where: { id: f.product.id } })).toMatchObject({ physicalStock: 18, reservedStock: 0 });
    await expect(ship(f)).rejects.toMatchObject({ status: 409 });
  });
  it("race refund dengan review: satu hasil terserialisasi, submit setelah refund ditolak", async () => {
    const f = await fixture(); await complete(f); f.refund();
    const results = await Promise.allSettled([f.notify(), reviews.create(f.user, f.order.items[0].id, reviewInput)]);
    expect(results[0].status).toBe("fulfilled");
    expect(await db.rating.count({ where: { orderItemId: f.order.items[0].id } })).toBe(results[1].status === "fulfilled" ? 1 : 0);
    if (results[1].status === "rejected") expect(results[1].reason).toMatchObject({ code: "ORDER_NOT_COMPLETED" });
    await expect(reviews.create(f.user, f.order.items[0].id, reviewInput)).rejects.toMatchObject({ code: "ORDER_NOT_COMPLETED" });
  });
  it("BE13 rentang from inklusif/to eksklusif cocok total/status/latest", async () => {
    const user = await account(), range = { from: "2001-01-01T00:00:00Z", to: "2001-02-01T00:00:00Z" };
    const before = await dashboard.dashboard(admin, range);
    for (const createdAt of [new Date(range.from), new Date(range.to), new Date(new Date(range.from).getTime() - 1)]) {
      await db.order.create({ data: { userId: user.id, number: `BE14-${randomUUID()}`, idempotencyKey: randomUUID(), inputHash: "a".repeat(64), recipientName: "Fixture", phone: "081200000000", addressLine: "Fixture", city: "Tanjungpinang", province: "Kepulauan Riau", subtotal: 10000, shippingFee: 10000, total: 20000, shippingLabel: "Delivery manual", createdAt, paymentDeadline: new Date(createdAt.getTime() + 3600000) } });
    }
    const after = await dashboard.dashboard(admin, range);
    expect(after.orderCount).toBe(before.orderCount + 1); expect(after.ordersByStatus.reduce((sum, row) => sum + row.count, 0)).toBe(after.orderCount);
    expect(after.latestOrders.every(row => row.createdAt >= new Date(range.from).toISOString() && row.createdAt < new Date(range.to).toISOString())).toBe(true);
  });
  it("BE13 stok 0/1/5/6 setelah reservasi dan produk nonaktif cocok SQL", async () => {
    const f = await fixture(), before = await dashboard.dashboard(admin, period);
    for (const [physicalStock, reservedStock, isActive] of [[3, 3, true], [8, 7, true], [7, 2, false], [6, 0, true]] as const) {
      const product = await db.product.create({ data: { categoryId: f.category.id, name: `BE14 Stock ${randomUUID()}`, description: "Fixture", price: 10000, physicalStock, reservedStock, isActive, isDemo: true } }); products.push(product.id);
    }
    await db.category.update({ where: { id: f.category.id }, data: { isActive: false } });
    const after = await dashboard.dashboard(admin, period);
    expect(after.activeProductCount).toBe(before.activeProductCount + 3); expect(after.lowStockCount).toBe(before.lowStockCount + 2); expect(after.outOfStockCount).toBe(before.outOfStockCount + 1);
    expect(after.lowStockProducts.every(row => row.availableStock === row.physicalStock - row.reservedStock && row.availableStock >= 1 && row.availableStock <= 5)).toBe(true);
    expect(after.outOfStockProducts.every(row => row.availableStock === 0)).toBe(true);
  });
  it("BE13 hitungan stok penuh meskipun cuplikan dibatasi 10", async () => {
    const f = await fixture(), before = await dashboard.dashboard(admin, period);
    for (let i = 0; i < 11; i++) {
      const product = await db.product.create({ data: { categoryId: f.category.id, name: `BE14 Low ${i}`, description: "Fixture", price: 10000, physicalStock: 5, reservedStock: 4 } }); products.push(product.id);
    }
    const value = await dashboard.dashboard(admin, period);
    expect(value.lowStockCount).toBe(before.lowStockCount + 11); expect(value.lowStockProducts).toHaveLength(10);
    expect(value.lowStockCount).toBeGreaterThan(value.lowStockProducts.length);
  });
  it("BE13 voucher reservasi/pakai dan pagination hanya baca, owner/relasi cocok", async () => {
    const f = await fixture({ paid: false });
    const before = await db.discount.findUniqueOrThrow({ where: { userId: f.user.id } });
    const list = await dashboard.vouchers(admin, { status: "RESERVED", pageSize: "100" });
    expect(list.data.find(row => row.owner.id === f.user.id)).toMatchObject({ reservedOrderId: f.order.id, orderNumber: f.order.number, usedOrder: null });
    expect(list.pagination.total).toBe(await db.discount.count({ where: { status: "RESERVED" } }));
    expect(await db.discount.findUniqueOrThrow({ where: { userId: f.user.id } })).toEqual(before);
    expect((await dashboard.vouchers(admin, { page: "100000" })).data).toEqual([]);
    await f.notify(); expect((await dashboard.vouchers(admin, { status: "USED", pageSize: "100" })).data.find(row => row.owner.id === f.user.id)?.usedOrderId).toBe(f.order.id);
  });
  it("BE13 dashboard mempertahankan snapshot saat order/stok berubah di tengah pembacaan", async () => {
    const f = await fixture(), range = { from: "2002-01-01T00:00:00Z", to: "2002-02-01T00:00:00Z" };
    const before = await dashboard.dashboard(admin, range);
    let injected = false;
    const concurrent = db.$extends({ query: { product: { async count({ args, query }) {
      const count = await query(args); // First read acquires the RepeatableRead snapshot.
      if (!injected) {
        injected = true;
        const createdAt = new Date(range.from);
        await db.order.create({ data: { userId: f.user.id, number: `BE14-${randomUUID()}`, idempotencyKey: randomUUID(), inputHash: "b".repeat(64), recipientName: "Fixture", phone: "081200000000", addressLine: "Fixture", city: "Tanjungpinang", province: "Kepulauan Riau", subtotal: 10000, shippingFee: 10000, total: 20000, shippingLabel: "Delivery manual", createdAt, paymentDeadline: new Date(createdAt.getTime() + 3600000) } });
        await db.product.update({ where: { id: f.product.id }, data: { physicalStock: 0 } });
      }
      return count;
    } } } });
    const during = await createDashboardService(concurrent as unknown as typeof db).dashboard(admin, range);
    expect(injected).toBe(true); expect(during.orderCount).toBe(before.orderCount); expect(during.outOfStockCount).toBe(before.outOfStockCount);
    const after = await dashboard.dashboard(admin, range);
    expect(after.orderCount).toBe(before.orderCount + 1); expect(after.outOfStockCount).toBe(before.outOfStockCount + 1);
  });
  it("BE13 total dan halaman voucher konsisten saat voucher baru terbit bersamaan", async () => {
    const before = await dashboard.vouchers(admin, { pageSize: "100" });
    let issuedTo: Principal | undefined;
    const concurrent = db.$extends({ query: { discount: { async count({ args, query }) {
      const total = await query(args);
      if (!issuedTo) { issuedTo = await account(); await db.$transaction(tx => issueNewBuyerVoucher(tx, issuedTo!.id)); }
      return total;
    } } } });
    const during = await createDashboardService(concurrent as unknown as typeof db).vouchers(admin, { pageSize: "100" });
    expect(issuedTo).toBeDefined(); expect(during.pagination.total).toBe(before.pagination.total);
    expect(during.data.some(row => row.owner.id === issuedTo!.id)).toBe(false);
    const after = await dashboard.vouchers(admin, { pageSize: "100" });
    expect(after.pagination.total).toBe(before.pagination.total + 1);
  });
  it("HTTP handlers dengan DB nyata: role/Origin/privasi dan metadata", async () => {
    const f = await fixture(), url = settings.appUrl;
    const orderApi = orderHandlers(() => ({ service: orders, appUrl: url, principal: async () => f.user }));
    expect((await orderApi.adminOrders(new Request(`${url}/api/admin/orders`))).status).toBe(403);
    const adminApi = orderHandlers(() => ({ service: orders, appUrl: url, principal: async () => admin }));
    expect((await adminApi.fulfill(new Request(`${url}/api/admin/orders/${f.order.id}/status`, { method: "PATCH", headers: { Origin: "https://wrong.example.test", "Content-Type": "application/json" }, body: '{}' }), f.order.id)).status).toBe(403);
    const dashApi = dashboardHandlers(() => ({ service: dashboard, principal: async () => admin }));
    const response = await dashApi.dashboard(new Request(`${url}/api/admin/dashboard?${new URLSearchParams(period)}`));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    const reviewApi = reviewHandlers(() => ({ service: reviews, appUrl: url, principal: async () => null }));
    expect((await reviewApi.list(new Request(`${url}/api/products/${f.product.id}/reviews`), f.product.id)).status).toBe(200);
  });
});

describe("Pickup fulfillment PostgreSQL regression", () => {
  it("persists ready status and history, then completes only after handover", async () => {
    const f = await fixture({ pickup: true });
    const ready = await orders.fulfill(admin, f.order.id, { status: "READY_FOR_PICKUP", expectedStatus: "PROCESSING", note: "Pesanan siap." });
    expect(ready.status).toBe("READY_FOR_PICKUP");
    expect(ready.shipping.mode).toBe("PICKUP");
    expect(ready.history.some(row => row.toStatus === "READY_FOR_PICKUP")).toBe(true);
    await expect(orders.fulfill(admin, f.order.id, { status: "COMPLETED", expectedStatus: "READY_FOR_PICKUP" })).rejects.toMatchObject({ code: "RECEIPT_CONFIRMATION_REQUIRED" });
    const completed = await orders.fulfill(admin, f.order.id, { status: "COMPLETED", expectedStatus: "READY_FOR_PICKUP", receiptConfirmed: true, note: "Diserahkan ke pembeli." });
    expect(completed.status).toBe("COMPLETED");
  });
});
