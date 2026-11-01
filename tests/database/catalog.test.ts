import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "../../src/lib/db/client";
import { createCatalogService } from "../../src/services/catalog";
import { createPhotoService } from "../../src/services/product-photos";
import { catalogHandlers } from "../../src/lib/catalog/http";
import { localPhotoStorage } from "../../src/lib/catalog/photo-storage";
import type { Principal } from "../../src/lib/auth/access";

const db = createDatabaseClient();
const service = createCatalogService(db);
const suffix = randomUUID();
const directory = path.resolve(`.local/uploads/product-photos-test/${suffix}`);
const storage = localPhotoStorage(directory), photos = createPhotoService(db, storage);
const categoryIds: string[] = [], productIds: string[] = [], orderIds: string[] = [], photoIds: string[] = [];
let admin: Principal, buyer: Principal;
beforeAll(async () => {
  admin = await db.user.create({ data: { name: "Catalog Admin Fixture", email: `catalog-admin-${suffix}@example.test`, passwordHash: "not-a-login-hash", role: "ADMIN" }, select: { id: true, role: true } });
  buyer = await db.user.create({ data: { name: "Catalog Buyer Fixture", email: `catalog-buyer-${suffix}@example.test`, passwordHash: "not-a-login-hash" }, select: { id: true, role: true } });
});
afterAll(async () => {
  await db.rating.deleteMany({ where: { orderItem: { orderId: { in: orderIds } } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.product.deleteMany({ where: { id: { in: productIds } } });
  await db.category.deleteMany({ where: { id: { in: categoryIds } } });
  const records = await db.productPhoto.findMany({ where: { createdById: admin.id }, select: { key: true } });
  await db.productPhoto.deleteMany({ where: { createdById: admin.id } });
  for (const record of records) await storage.remove(record.key);
  await db.user.deleteMany({ where: { id: { in: [admin.id, buyer.id] } } });
  await db.$disconnect();
});
async function category(isActive = true) {
  const value = await service.createCategory(admin, { name: `Category ${randomUUID()}`, isActive });
  categoryIds.push(value.id);
  return value;
}
async function product(categoryId: string, extra: Record<string, unknown> = {}) {
  const value = await service.createProduct(admin, { categoryId, name: `Product ${randomUUID()}`, description: "Fixture description", price: 10000, physicalStock: 10, isActive: true, ...extra });
  productIds.push(value.id);
  return value;
}
async function order(productId: string) {
  const p = await db.product.findUniqueOrThrow({ where: { id: productId } });
  const id = randomUUID();
  const value = await db.order.create({ data: { id, number: id, userId: buyer.id, idempotencyKey: id, inputHash: "a".repeat(64), recipientName: "Fixture", phone: "0800000000", addressLine: "Fixture address", city: "Test", province: "Test", subtotal: p.price, total: p.price, shippingFee: 0, shippingLabel: "TEST ONLY", paymentDeadline: new Date(Date.now() + 3600000), status: "COMPLETED", items: { create: { productId, name: p.name, unitPrice: p.price, quantity: 1, lineSubtotal: p.price } } }, include: { items: true } });
  orderIds.push(value.id);
  return value;
}
const image = async () => new File([new Uint8Array(await sharp({ create: { width: 4, height: 5, channels: 3, background: "orange" } }).png().toBuffer())], "../../untrusted-name.php", { type: "image/png" });

describe("Katalog/admin/foto pada PostgreSQL nyata", () => {
  it("publik hanya melihat produk dan kategori aktif, stok habis tetap tampil, tanpa field internal", async () => {
    const active = await category(), inactive = await category(false);
    const normal = await product(active.id), sold = await product(active.id, { physicalStock: 0 });
    await product(active.id, { isActive: false });
    await product(inactive.id);
    const result = await service.publicProducts({ categoryId: active.id });
    expect(result.data.map(p => p.id).sort()).toEqual([normal.id, sold.id].sort());
    expect(result.data.find(p => p.id === sold.id)?.availability).toBe("OUT_OF_STOCK");
    expect(result.data.every(p => !("physicalStock" in p) && !("reservedStock" in p) && !("photoKey" in p))).toBe(true);
    expect(result.data[0].averageRating).toBeNull();
    expect(result.data[0].reviewCount).toBe(0);
    expect((await service.publicProducts({ categoryId: inactive.id })).data).toHaveLength(0);
    const customerCount = (await service.publicCategories({ pageSize: "100" })).data.find(c => c.id === active.id)?.productCount;
    const adminCount = (await service.adminCategories(admin, { pageSize: "100" })).data.find(c => c.id === active.id)?.productCount;
    expect(customerCount).toBe(2); expect(adminCount).toBe(3);
  });
  it("detail nonaktif disembunyikan dan rating dihitung dari ulasan tersimpan", async () => {
    const c = await category(), p = await product(c.id);
    for (const rating of [3, 5]) {
      const o = await order(p.id);
      await db.rating.create({ data: { orderItemId: o.items[0].id, rating, comment: "Verified fixture review" } });
    }
    expect(await service.publicProduct(p.id)).toMatchObject({ averageRating: 4, reviewCount: 2 });
    await service.updateProduct(admin, p.id, { isActive: false });
    await expect(service.publicProduct(p.id)).rejects.toMatchObject({ status: 404 });
    expect(await service.adminProduct(admin, p.id)).toMatchObject({ isActive: false });
  });
  it("filter stok menghitung reservedStock, q literal, pagination/count konsisten", async () => {
    const c = await category();
    const low = await product(c.id, { name: `Needle 50%_ ${suffix}` });
    const normal = await product(c.id), zero = await product(c.id, { physicalStock: 0 });
    await db.product.update({ where: { id: low.id }, data: { reservedStock: 5 } });
    expect((await service.adminProducts(admin, { categoryId: c.id, availability: "LOW" })).data.map(p => p.id)).toEqual([low.id]);
    expect((await service.adminProducts(admin, { categoryId: c.id, availability: "AVAILABLE" })).data.map(p => p.id)).toEqual([normal.id]);
    expect((await service.adminProducts(admin, { categoryId: c.id, availability: "OUT_OF_STOCK" })).data.map(p => p.id)).toEqual([zero.id]);
    expect((await service.adminProducts(admin, { q: "50%_" })).data.map(p => p.id)).toEqual([low.id]);
    const page = await service.adminProducts(admin, { categoryId: c.id, page: "2", pageSize: "1" });
    expect(page.data).toHaveLength(1); expect(page.pagination).toEqual({ page: 2, pageSize: 1, total: 3, totalPages: 3 });
    expect((await service.publicProducts({ categoryId: c.id, page: "100" })).data).toEqual([]);
  });
  it("kategori tersimpan wajib, duplikasi/penghapusan kategori terpakai ditolak", async () => {
    const c = await category();
    await expect(service.createCategory(admin, { name: c.name, isActive: true })).rejects.toMatchObject({ status: 409 });
    await expect(product("missing-category")).rejects.toMatchObject({ status: 422 });
    await product(c.id);
    await expect(service.deleteCategory(admin, c.id)).rejects.toMatchObject({ status: 409, code: "RESOURCE_IN_USE" });
    const empty = await category();
    await service.deleteCategory(admin, empty.id);
    await expect(service.deleteCategory(admin, empty.id)).rejects.toMatchObject({ status: 404 });
  });
  it("ubah produk tidak mengubah snapshot/riwayat pesanan, stok lewat endpoint khusus", async () => {
    const c = await category(), p = await product(c.id);
    const historical = await order(p.id);
    await service.updateProduct(admin, p.id, { name: "Changed current name", price: 25000, isActive: false });
    const item = await db.orderItem.findUniqueOrThrow({ where: { id: historical.items[0].id } });
    expect(item.name).toBe(p.name); expect(item.unitPrice).toBe(10000);
    await expect(service.updateProduct(admin, p.id, { physicalStock: 1 })).rejects.toBeTruthy();
    await expect(service.createProduct(admin, { categoryId: c.id, name: "Bad photo", description: "Fixture", price: 1, physicalStock: 0, isActive: true, photoId: randomUUID() })).rejects.toMatchObject({ status: 422 });
  });
  it("stok di bawah reservasi ditolak dan dua edit versi sama tidak saling menimpa", async () => {
    const c = await category(), p = await product(c.id);
    await db.product.update({ where: { id: p.id }, data: { reservedStock: 4 } });
    const current = await service.adminProduct(admin, p.id);
    await expect(service.updateStock(admin, p.id, { physicalStock: 3, expectedUpdatedAt: current.updatedAt })).rejects.toMatchObject({ status: 409, code: "STOCK_RESERVED" });
    const results = await Promise.allSettled([6, 8].map(physicalStock => service.updateStock(admin, p.id, { physicalStock, expectedUpdatedAt: current.updatedAt })));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((results.find(result => result.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ status: 409, code: "RESOURCE_VERSION_CONFLICT" });
    const stored = await db.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(stored.physicalStock).toBeGreaterThanOrEqual(stored.reservedStock);
  });
  it("anonymous/pembeli ditolak pada operasi admin dan Origin melindungi mutation", async () => {
    const handler = (principal: Principal | null) => catalogHandlers(() => ({ service, appUrl: "https://shop.example.test", principal: async () => principal }));
    const request = (origin = "https://shop.example.test") => new Request("https://shop.example.test/api/admin/products", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" });
    expect((await handler(null).createProduct(request())).status).toBe(401);
    expect((await handler(buyer).createProduct(request())).status).toBe(403);
    expect((await handler(admin).createProduct(request("https://attacker.example.test"))).status).toBe(403);
    await expect(service.createCategory(buyer, { name: "Bad category", isActive: true })).rejects.toMatchObject({ status: 403 });
  });
  it("upload memakai key server dan metadata, foto pending privat dan aktif dapat dibaca publik", async () => {
    const uploaded = await photos.upload(admin, await image()); photoIds.push(uploaded.photoId);
    expect(uploaded.url).toBe(`/api/product-photos/${uploaded.photoId}`);
    const stored = await db.productPhoto.findUniqueOrThrow({ where: { id: uploaded.photoId } });
    expect(stored.key).toBe(`${uploaded.photoId}.webp`);
    expect(stored.key).not.toContain("untrusted");
    await expect(photos.read(uploaded.photoId)).rejects.toMatchObject({ status: 404 });
    await expect(photos.read(uploaded.photoId, buyer)).rejects.toMatchObject({ status: 404 });
    expect((await sharp(await photos.read(uploaded.photoId, admin)).metadata()).format).toBe("webp");
    const c = await category(), p = await product(c.id, { photoId: uploaded.photoId });
    expect((await service.publicProduct(p.id)).imageUrl).toBe(uploaded.url);
    expect(await photos.read(uploaded.photoId)).toBeInstanceOf(Buffer);
    await service.updateProduct(admin, p.id, { photoId: null });
    expect((await service.publicProduct(p.id)).imageUrl).toBeNull();
    await expect(photos.read(uploaded.photoId)).rejects.toMatchObject({ status: 404 });
  });
  it("gagal penyimpanan metadata membuang hanya file baru dan input berbahaya ditolak", async () => {
    const before = await readdir(directory).catch(() => []);
    await expect(photos.upload({ id: randomUUID(), role: "ADMIN" }, await image())).rejects.toBeTruthy();
    expect((await readdir(directory)).sort()).toEqual(before.sort());
    await expect(photos.upload(buyer, await image())).rejects.toMatchObject({ status: 403 });
    await expect(storage.read("../../.env.local")).rejects.toMatchObject({ status: 422 });
    await expect(photos.read("../../secret")).rejects.toBeTruthy();
  });
});
