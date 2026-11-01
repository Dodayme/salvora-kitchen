import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "../../src/lib/db/client";
import { createBuyerService } from "../../src/services/buyer";
import { buyerHandlers } from "../../src/lib/buyer/http";
import type { Principal } from "../../src/lib/auth/access";

const db = createDatabaseClient(), service = createBuyerService(db), suffix = randomUUID();
const users: Principal[] = [], productIds: string[] = [], orderIds: string[] = [];
let categoryId: string;
const address = { recipientName: "Buyer Fixture", phone: "081200000000", addressLine: "Jalan Fixture 1", city: "Test", province: "Test" };
beforeAll(async () => {
  for (const role of ["BUYER", "BUYER", "ADMIN"] as const) users.push(await db.user.create({ data: { name: "Buyer Fixture", email: `${role.toLowerCase()}-${users.length}-${suffix}@example.test`, passwordHash: "not-a-login-hash", role }, select: { id: true, role: true } }));
  categoryId = (await db.category.create({ data: { name: `Buyer ${suffix}` } })).id;
});
afterAll(async () => {
  await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
  await db.product.deleteMany({ where: { id: { in: productIds } } });
  if (categoryId) await db.category.delete({ where: { id: categoryId } });
  await db.$disconnect();
});
async function product(extra = {}) {
  const p = await db.product.create({ data: { categoryId, name: "Buyer product", description: "Fixture", price: 10000, physicalStock: 10, ...extra } });
  productIds.push(p.id); return p;
}
async function clearCart() { await db.cart.deleteMany({ where: { userId: { in: users.map(user => user.id) } } }); }
describe("Alamat dan keranjang PostgreSQL", () => {
  it("GET keranjang kosong tidak membuat record", async () => {
    expect(await service.cart(users[0])).toEqual({ id: null, items: [], subtotal: 0 });
    expect(await db.cart.count({ where: { userId: users[0].id } })).toBe(0);
  });
  it("alamat terisolasi, pagination dan DTO tanpa userId", async () => {
    const a = await service.createAddress(users[0], address);
    expect(a).not.toHaveProperty("userId");
    expect((await service.addresses(users[1], {})).data).toEqual([]);
    expect((await service.addresses(users[0], { pageSize: "1" })).pagination.total).toBe(1);
    await expect(service.updateAddress(users[1], a.id, { city: "Other" })).rejects.toMatchObject({ status: 404 });
    await expect(service.deleteAddress(users[1], a.id)).rejects.toMatchObject({ status: 404 });
    expect(await service.updateAddress(users[0], a.id, { notes: "Call", postalCode: "12345" })).toMatchObject({ notes: "Call", postalCode: "12345" });
    await service.deleteAddress(users[0], a.id);
  });
  it("edit/hapus alamat tidak mengubah snapshot pesanan", async () => {
    const a = await service.createAddress(users[0], address), id = randomUUID();
    await db.order.create({ data: { id, number: id, userId: users[0].id, idempotencyKey: id, inputHash: "a".repeat(64), ...address, subtotal: 10000, total: 10000, shippingFee: 0, shippingLabel: "TEST ONLY", paymentDeadline: new Date(Date.now() + 1800000) } }); orderIds.push(id);
    await service.updateAddress(users[0], a.id, { addressLine: "New address" });
    await service.deleteAddress(users[0], a.id);
    expect(await db.order.findUniqueOrThrow({ where: { id } })).toMatchObject(address);
  });
  it("penambahan pertama bersamaan tetap satu cart/baris tanpa lost update", async () => {
    await clearCart(); const p = await product();
    await Promise.all(Array.from({ length: 4 }, () => service.addItem(users[0], { productId: p.id, quantity: 1 })));
    const cart = await service.cart(users[0]); expect(cart.items).toHaveLength(1); expect(cart.items[0].quantity).toBe(4); expect(cart.subtotal).toBe(40000);
    expect(await db.cart.count({ where: { userId: users[0].id } })).toBe(1);
  });
  it("PATCH mengganti jumlah, mutasi lintas akun ditolak dan pemilik diabaikan dari browser", async () => {
    const cart = await service.cart(users[0]), id = cart.items[0].id;
    await expect(service.setItem(users[1], id, { quantity: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(service.deleteItem(users[1], id)).rejects.toMatchObject({ status: 404 });
    expect((await service.setItem(users[0], id, { quantity: 2 })).subtotal).toBe(20000);
    await expect(service.addItem(users[0], { productId: cart.items[0].productId, quantity: 1, userId: users[1].id })).rejects.toBeDefined();
  });
  it("stok tersedia memperhitungkan reservasi, tidak mencadangkan stok", async () => {
    await clearCart(); const p = await product({ physicalStock: 4, reservedStock: 2 });
    await service.addItem(users[0], { productId: p.id, quantity: 2 });
    await service.addItem(users[1], { productId: p.id, quantity: 2 });
    await expect(service.addItem(users[0], { productId: p.id, quantity: 1 })).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(await db.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ physicalStock: 4, reservedStock: 2 });
    expect(await db.stockReservation.count({ where: { orderItem: { productId: p.id } } })).toBe(0);
  });
  it("harga/stok/nonaktif terkini tampil tanpa diam-diam membuang item", async () => {
    await clearCart(); const p = await product();
    const cart = await service.addItem(users[0], { productId: p.id, quantity: 3 });
    await db.product.update({ where: { id: p.id }, data: { price: 15000, physicalStock: 1 } });
    expect((await service.cart(users[0])).items[0]).toMatchObject({ quantity: 3, unitPrice: 15000, lineSubtotal: 45000, availableStock: 1, isAvailable: false });
    await service.setItem(users[0], cart.items[0].id, { quantity: 1 });
    await db.product.update({ where: { id: p.id }, data: { isActive: false } });
    expect((await service.cart(users[0])).items[0].isAvailable).toBe(false);
    await expect(service.setItem(users[0], cart.items[0].id, { quantity: 1 })).rejects.toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
    await service.deleteItem(users[0], cart.items[0].id);
    expect((await service.cart(users[0])).items).toEqual([]);
  });
  it("produk habis/kategori nonaktif ditolak tanpa menyimpan cart baru", async () => {
    await clearCart(); const p = await product({ physicalStock: 0 });
    await expect(service.addItem(users[0], { productId: p.id, quantity: 1 })).rejects.toMatchObject({ status: 409 });
    await db.category.update({ where: { id: categoryId }, data: { isActive: false } });
    try { const active = await product(); await expect(service.addItem(users[0], { productId: active.id, quantity: 1 })).rejects.toMatchObject({ code: "PRODUCT_UNAVAILABLE" }); }
    finally { await db.category.update({ where: { id: categoryId }, data: { isActive: true } }); }
    expect(await db.cart.count({ where: { userId: users[0].id } })).toBe(0);
  });
  it("uang tidak overflow, rollback mutasi dan tetap bisa menghapus setelah kenaikan harga", async () => {
    await clearCart(); const p = await product({ price: 2147483647 });
    await expect(service.addItem(users[0], { productId: p.id, quantity: 2 })).rejects.toMatchObject({ code: "CART_TOTAL_LIMIT" });
    const cart = await service.addItem(users[0], { productId: p.id, quantity: 1 });
    const other = await product();
    await expect(service.addItem(users[0], { productId: other.id, quantity: 1 })).rejects.toMatchObject({ code: "CART_TOTAL_LIMIT" });
    expect((await service.cart(users[0])).items).toHaveLength(1);
    await service.deleteItem(users[0], cart.items[0].id);
    const low = await product(); const lowCart = await service.addItem(users[0], { productId: low.id, quantity: 2 });
    await db.product.update({ where: { id: low.id }, data: { price: 2147483647 } });
    await expect(service.cart(users[0])).rejects.toMatchObject({ code: "CART_TOTAL_LIMIT" });
    await service.deleteItem(users[0], lowCart.items[0].id);
    expect((await service.cart(users[0])).subtotal).toBe(0);
  });
  it("HTTP guard sesi/role/Origin dan respons privat berlaku juga pada error", async () => {
    let principal: Principal | null = null;
    const handlers = buyerHandlers(() => ({ service, principal: async () => principal, appUrl: "https://buyer.example.test" }));
    const get = () => new Request("https://buyer.example.test/api/cart");
    const anonymous = await handlers.cart(get()); expect(anonymous.status).toBe(401); expect(anonymous.headers.get("vary")).toBe("Cookie");
    principal = users[2]; expect((await handlers.cart(get())).status).toBe(403);
    principal = users[0];
    expect((await handlers.createAddress(new Request("https://buyer.example.test/api/addresses", { method: "POST", headers: { Origin: "https://attacker.example.test", "Content-Type": "application/json" }, body: JSON.stringify(address) }))).status).toBe(403);
    const response = await handlers.cart(get()); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await handlers.addresses(new Request("https://buyer.example.test/api/addresses?page=1&page=2"))).status).toBe(422);
  });
});
