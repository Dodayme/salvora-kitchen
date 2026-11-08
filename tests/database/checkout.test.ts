import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "../../src/lib/db/client";
import { createCheckoutService } from "../../src/services/checkout";
import { createBuyerService } from "../../src/services/buyer";
import { issueNewBuyerVoucher } from "../../src/services/vouchers";
import { checkoutHandlers } from "../../src/lib/checkout/http";
import type { Principal } from "../../src/lib/auth/access";

const db = createDatabaseClient(), checkout = createCheckoutService(db), buyer = createBuyerService(db);
const promotionIds: string[] = [];
const users: Principal[] = [], categories: string[] = [], products: string[] = [];
afterAll(async () => {
  const userIds = users.map(u => u.id), where = { userId: { in: userIds } };
  await db.discount.updateMany({ where, data: { status: "AVAILABLE", reservedOrderId: null, usedOrderId: null, usedAt: null } });
  await db.stockReservation.deleteMany({ where: { orderItem: { order: where } } });
  await db.orderStatusHistory.deleteMany({ where: { order: where } });
  await db.orderItem.deleteMany({ where: { order: where } });
  await db.order.deleteMany({ where });
  await db.eventPromotion.deleteMany({ where: { id: { in: promotionIds } } });
  await db.discount.deleteMany({ where });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.product.deleteMany({ where: { id: { in: products } } });
  await db.category.deleteMany({ where: { id: { in: categories } } });
  await db.$disconnect();
});
async function account(voucher = true) {
  const u = await db.user.create({ data: { name: "Checkout Fixture", email: `checkout-${randomUUID()}@example.test`, passwordHash: "not-a-login-hash" }, select: { id: true, role: true } }); users.push(u);
  if (voucher) await db.$transaction(tx => issueNewBuyerVoucher(tx, u.id));
  const address = await buyer.createAddress(u, { recipientName: "Fixture Receiver", phone: "081200000000", addressLine: "Fixture street", city: "Tanjungpinang", province: "Kepulauan Riau", notes: "Call" });
  return { u, address };
}
async function product(stock = 10) {
  const c = await db.category.create({ data: { name: `Checkout ${randomUUID()}` } }); categories.push(c.id);
  const p = await db.product.create({ data: { categoryId: c.id, name: "Checkout product", description: "Fixture", price: 10003, physicalStock: stock } }); products.push(p.id); return p;
}
async function fixture(voucher = true, stock = 10) {
  const a = await account(voucher), p = await product(stock);
  await buyer.addItem(a.u, { productId: p.id, quantity: 1 });
  const q = await checkout.quote(a.u, { addressId: a.address.id });
  return { ...a, p, q };
}
const confirm = (f: Awaited<ReturnType<typeof fixture>>, key = randomUUID()) => checkout.order(f.u, { quoteId: f.q.quoteId }, key);
describe("Checkout atomik PostgreSQL", () => {
  it("quote milik akun, TTL 5 menit dan harga/ongkir tanpa reservasi", async () => {
    const f = await fixture();
    expect(f.q).toMatchObject({ subtotal: 10003, discount: 2000, shippingFee: 10000, total: 18003, currency: "IDR" });
    const stored = await db.checkoutQuote.findUniqueOrThrow({ where: { id: f.q.quoteId } });
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(300000);
    expect((await db.product.findUniqueOrThrow({ where: { id: f.p.id } })).reservedStock).toBe(0);
    expect((await db.discount.findUniqueOrThrow({ where: { userId: f.u.id } })).status).toBe("AVAILABLE");
    expect(await db.order.count({ where: { userId: f.u.id } })).toBe(0);
  });
  it("order menyimpan snapshot, deadline sama dengan reservasi, stok fisik dan flag pembelian tetap", async () => {
    const f = await fixture(); const result = await confirm(f), o = result.data;
    expect(result.replayed).toBe(false); expect(o).toMatchObject({ subtotal: 10003, discount: 2000, shippingFee: 10000, total: 18003, status: "AWAITING_PAYMENT", payments: [], canPay: true, canReconcile: false });
    expect(new Date(o.paymentDeadline).getTime() - new Date(o.createdAt).getTime()).toBe(3600000);
    const reservation = await db.stockReservation.findUniqueOrThrow({ where: { orderItemId: o.items[0].id } });
    expect(reservation.expiresAt.toISOString()).toBe(o.paymentDeadline); expect(reservation.status).toBe("RESERVED");
    expect(await db.product.findUniqueOrThrow({ where: { id: f.p.id } })).toMatchObject({ physicalStock: 10, reservedStock: 1 });
    expect(await db.discount.findUniqueOrThrow({ where: { userId: f.u.id } })).toMatchObject({ status: "RESERVED", reservedOrderId: o.id, usedAt: null });
    expect((await db.user.findUniqueOrThrow({ where: { id: f.u.id } })).isFirstPurchase).toBe(true);
    expect((await buyer.cart(f.u)).items).toEqual([]); expect(o.history[0].toStatus).toBe("AWAITING_PAYMENT");
  });
  it("menolak empty cart, alamat/quote asing, wilayah luar serta role salah", async () => {
    const a = await account(), b = await account();
    await expect(checkout.quote(a.u, { addressId: a.address.id })).rejects.toMatchObject({ code: "CART_EMPTY" });
    await expect(checkout.quote(a.u, { addressId: b.address.id })).rejects.toMatchObject({ status: 404 });
    const f = await fixture(); await expect(checkout.order(a.u, { quoteId: f.q.quoteId }, randomUUID())).rejects.toMatchObject({ status: 404 });
    await buyer.updateAddress(f.u, f.address.id, { city: "Batam" });
    await expect(checkout.quote(f.u, { addressId: f.address.id })).rejects.toMatchObject({ code: "DELIVERY_UNAVAILABLE" });
    await expect(checkout.quote(null, { addressId: f.address.id })).rejects.toMatchObject({ status: 401 });
    await expect(checkout.quote({ id: f.u.id, role: "ADMIN" }, { addressId: f.address.id })).rejects.toMatchObject({ status: 403 });
  });
  it("harga/alamat/cart/voucher berubah harus ditinjau melalui quote baru", async () => {
    for (const kind of ["price", "address", "cart", "voucher"] as const) {
      const f = await fixture();
      if (kind === "price") await db.product.update({ where: { id: f.p.id }, data: { price: 20000 } });
      if (kind === "address") await buyer.updateAddress(f.u, f.address.id, { addressLine: "New address" });
      if (kind === "cart") await buyer.addItem(f.u, { productId: f.p.id, quantity: 1 });
      if (kind === "voucher") await db.user.update({ where: { id: f.u.id }, data: { isFirstPurchase: false } });
      await expect(confirm(f)).rejects.toMatchObject({ code: "CHECKOUT_CHANGED" });
      expect(await db.order.count({ where: { userId: f.u.id } })).toBe(0);
      expect((await db.product.findUniqueOrThrow({ where: { id: f.p.id } })).reservedStock).toBe(0);
      const next = await checkout.quote(f.u, { addressId: f.address.id });
      expect((await checkout.order(f.u, { quoteId: next.quoteId }, randomUUID())).replayed).toBe(false);
    }
  });
  it("quote expired ditolak, tanpa order atau reservasi parsial", async () => {
    const f = await fixture();
    await db.checkoutQuote.update({ where: { id: f.q.quoteId }, data: { createdAt: new Date(Date.now() - 600000), expiresAt: new Date(Date.now() - 1000) } });
    await expect(confirm(f)).rejects.toMatchObject({ code: "QUOTE_EXPIRED" });
    expect(await db.order.count({ where: { userId: f.u.id } })).toBe(0);
  });
  it("konfirmasi bersamaan/key sama menjadi satu order, replay tetap setelah quote expired", async () => {
    const f = await fixture(), key = randomUUID();
    const results = await Promise.all(Array.from({ length: 4 }, () => confirm(f, key)));
    expect(new Set(results.map(r => r.data.id)).size).toBe(1); expect(results.filter(r => !r.replayed)).toHaveLength(1);
    await db.checkoutQuote.update({ where: { id: f.q.quoteId }, data: { createdAt: new Date(Date.now() - 600000), expiresAt: new Date(Date.now() - 1000) } });
    const replay = await confirm(f, key); expect(replay.replayed).toBe(true); expect(replay.data.paymentDeadline).toBe(results[0].data.paymentDeadline);
    expect((await db.product.findUniqueOrThrow({ where: { id: f.p.id } })).reservedStock).toBe(1);
    await expect(confirm(f, randomUUID())).rejects.toMatchObject({ code: "QUOTE_ALREADY_USED" });
    await expect(checkout.order(f.u, { quoteId: "different-quote" }, key)).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
  it("key sama dapat dipakai akun berbeda tanpa membocorkan order", async () => {
    const a = await fixture(), b = await fixture(), key = randomUUID();
    expect((await confirm(a, key)).data.id).not.toBe((await confirm(b, key)).data.id);
  });
  it("dua pembeli memperebutkan unit terakhir, hanya satu order/reservasi yang tersimpan", async () => {
    const a = await account(), b = await account(), p = await product(1);
    for (const f of [a, b]) await buyer.addItem(f.u, { productId: p.id, quantity: 1 });
    const qs = await Promise.all([a, b].map(f => checkout.quote(f.u, { addressId: f.address.id })));
    const results = await Promise.allSettled([a, b].map((f, i) => checkout.order(f.u, { quoteId: qs[i].quoteId }, randomUUID())));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((results.find(r => r.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(await db.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ physicalStock: 1, reservedStock: 1 });
    expect(await db.stockReservation.count({ where: { orderItem: { productId: p.id } } })).toBe(1);
  });
  it("satu voucher hanya di satu order aktif; pembelian selanjutnya bisa tanpa voucher", async () => {
    const f = await fixture(), otherQuote = await checkout.quote(f.u, { addressId: f.address.id });
    const results = await Promise.allSettled([confirm(f), checkout.order(f.u, { quoteId: otherQuote.quoteId }, randomUUID())]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const voucher = await db.discount.findUniqueOrThrow({ where: { userId: f.u.id } });
    expect(voucher.status).toBe("RESERVED");
    await buyer.addItem(f.u, { productId: f.p.id, quantity: 1 });
    const q = await checkout.quote(f.u, { addressId: f.address.id }); expect(q.voucher).toBeNull();
    const second = await checkout.order(f.u, { quoteId: q.quoteId }, randomUUID()); expect(second.data.discount).toBe(0);
    expect((await db.discount.findUniqueOrThrow({ where: { userId: f.u.id } })).reservedOrderId).toBe(voucher.reservedOrderId);
  });
  it("kegagalan penghapusan cart setelah reservasi merollback seluruh transaksi", async () => {
    const f = await fixture(), item = (await buyer.cart(f.u)).items[0];
    const extended = db.$extends({ query: { cartItem: { async deleteMany({ args, query }) { if (args.where?.id === item.id) throw new Error("fixture-late-failure"); return query(args); } } } });
    await expect(createCheckoutService(extended as unknown as typeof db).order(f.u, { quoteId: f.q.quoteId }, randomUUID())).rejects.toThrow("fixture-late-failure");
    expect(await db.order.count({ where: { userId: f.u.id } })).toBe(0);
    expect((await db.product.findUniqueOrThrow({ where: { id: f.p.id } })).reservedStock).toBe(0);
    expect((await db.discount.findUniqueOrThrow({ where: { userId: f.u.id } })).status).toBe("AVAILABLE");
    expect((await buyer.cart(f.u)).items[0].id).toBe(item.id);
  });
  it("stok turun/nonaktif setelah quote ditolak, tanpa menghapus cart", async () => {
    for (const data of [{ physicalStock: 0 }, { isActive: false }]) {
      const f = await fixture(); await db.product.update({ where: { id: f.p.id }, data });
      await expect(confirm(f)).rejects.toMatchObject({ status: 409 });
      expect((await buyer.cart(f.u)).items).toHaveLength(1);
    }
  });
  it("snapshot order/replay tetap setelah alamat dan produk diedit/dihapus alamatnya", async () => {
    const f = await fixture(false), key = randomUUID(), first = await confirm(f, key);
    await db.product.update({ where: { id: f.p.id }, data: { price: 20000, name: "Changed" } });
    await buyer.updateAddress(f.u, f.address.id, { addressLine: "Changed" }); await buyer.deleteAddress(f.u, f.address.id);
    const replay = await confirm(f, key);
    expect(replay.data).toEqual(first.data); expect(replay.data.voucher).toBeNull();
  });
  it("cart ditambah bersamaan dengan konfirmasi tidak hilang tanpa menjadi item pesanan", async () => {
    const f = await fixture(false);
    const results = await Promise.allSettled([confirm(f), buyer.addItem(f.u, { productId: f.p.id, quantity: 1 })]);
    expect(results[1].status).toBe("fulfilled");
    const orders = await db.order.count({ where: { userId: f.u.id } });
    const cart = await buyer.cart(f.u);
    expect(orders + cart.items.reduce((sum, item) => sum + item.quantity, 0)).toBe(2);
  });
  it("Origin, sesi dan role diperiksa sebelum input/konfirmasi", async () => {
    const f = await fixture(); let principal: Principal | null = null;
    const handlers = checkoutHandlers(() => ({ service: checkout, principal: async () => principal, appUrl: "https://checkout.example.test" }));
    const request = (origin = "https://checkout.example.test", key?: string) => new Request("https://checkout.example.test/api/orders", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: JSON.stringify({ quoteId: f.q.quoteId }) });
    const denied = await handlers.order(request()); expect(denied.status).toBe(401); expect(denied.headers.get("vary")).toBe("Cookie");
    principal = { id: f.u.id, role: "ADMIN" }; expect((await handlers.order(request())).status).toBe(403);
    principal = f.u; expect((await handlers.order(request("https://evil.example.test"))).status).toBe(403);
    expect((await handlers.order(request())).status).toBe(422);
    const good = await handlers.order(request(undefined, randomUUID())); expect(good.status).toBe(201); expect(good.headers.get("cache-control")).toBe("no-store");
  });
});

describe("Checkout ambil sendiri PostgreSQL", () => {
  it("menyimpan pickup, ongkir nol, kontak dan replay tanpa alamat tersimpan", async () => {
    const f = await fixture(false);
    await db.address.delete({ where: { id: f.address.id } });
    const q = await checkout.quote(f.u, { shippingMode: "PICKUP", contact: { recipientName: "Pengambil", phone: "081234567890" } });
    expect(q).toMatchObject({ shipping: { mode: "PICKUP" }, shippingFee: 0, total: 10003, address: { recipientName: "Pengambil" } });
    const key = randomUUID(), result = await checkout.order(f.u, { quoteId: q.quoteId }, key);
    expect(result.data).toMatchObject({ shipping: { mode: "PICKUP" }, shippingFee: 0, total: 10003, status: "AWAITING_PAYMENT" });
    expect((await checkout.order(f.u, { quoteId: q.quoteId }, key)).data.id).toBe(result.data.id);
  });
});

it("event discount persists on repeated orders and expired quote is rejected", async () => {
 const f = await fixture();
 const promo = await db.eventPromotion.create({ data: { name: "Checkout event", percentage: 30, maxDiscount: 50000, recipientIds: [f.u.id], startsAt: new Date(Date.now()-60000), endsAt: new Date(Date.now()+60000) } }); promotionIds.push(promo.id);
 for (let i=0;i<2;i++) {
   if (i) await buyer.addItem(f.u, { productId: f.p.id, quantity: 1 });
   const quote = await checkout.quote(f.u, { addressId: f.address.id });
   expect(quote.discount).toBe(3000);
   const result = await checkout.order(f.u, { quoteId: quote.quoteId }, randomUUID());
   expect(await db.order.findUnique({ where: { id: result.data.id } })).toMatchObject({ eventPromotionId: promo.id, discountId: null, discount: 3000 });
 }
 expect(await db.discount.findUnique({ where: { userId: f.u.id } })).toMatchObject({ status: "AVAILABLE" });
 await buyer.addItem(f.u, { productId: f.p.id, quantity: 1 });
 const quote = await checkout.quote(f.u, { addressId: f.address.id });
 await db.eventPromotion.update({ where: { id: promo.id }, data: { isActive: false } });
 await expect(checkout.order(f.u, { quoteId: quote.quoteId }, randomUUID())).rejects.toMatchObject({ code: "CHECKOUT_CHANGED" });
});
