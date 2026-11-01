import { describe, expect, it } from "vitest";
import sharp from "sharp";
import path from "node:path";
import { availability, categoryCreateSchema, productCreateSchema, productPatchSchema, queryParameters, publicProductQuerySchema, stockSchema, MAX_PHOTO_BYTES } from "../src/lib/catalog/validation";
import { boundedPhotoFile, normalizePhoto } from "../src/lib/catalog/photo-input";
import { photoDirectory } from "../src/lib/catalog/photo-storage";

const data = { categoryId: "cat-1", name: "Risol", description: "Deskripsi produk", price: 5000, physicalStock: 10, isActive: true };
describe("Katalog dan input foto", () => {
  it("status stok dihitung setelah reservasi dan terpisah dari aktif produk", () => {
    expect(availability(5, 5)).toBe("OUT_OF_STOCK");
    expect(availability(10, 9)).toBe("LOW");
    expect(availability(10, 5)).toBe("LOW");
    expect(availability(10, 4)).toBe("AVAILABLE");
  });
  it("menolak harga/stok invalid, payload kosong dan pengubahan field internal", () => {
    for (const extra of [{ price: 0 }, { price: 1.5 }, { price: 2147483648 }, { physicalStock: -1 }, { reservedStock: 2 }, { imageUrl: "/arbitrary" }, { photoKey: "../secret" }, { isDemo: false }]) expect(productCreateSchema.safeParse({ ...data, ...extra }).success).toBe(false);
    expect(productPatchSchema.safeParse({}).success).toBe(false);
    expect(productPatchSchema.safeParse({ physicalStock: 20 }).success).toBe(false);
    expect(categoryCreateSchema.safeParse({ name: " ", isActive: true }).success).toBe(false);
    expect(stockSchema.safeParse({ physicalStock: 1, expectedUpdatedAt: "invalid" }).success).toBe(false);
  });
  it("query publik tidak membuka pencarian lanjutan/filter internal dan menolak duplikat", () => {
    expect(publicProductQuerySchema.parse(queryParameters("http://localhost/api/products?pageSize=5"))).toEqual({ page: 1, pageSize: 5 });
    expect(() => queryParameters("http://localhost/?page=1&page=2")).toThrow();
    for (const input of [{ q: "risol" }, { isActive: "false" }, { pageSize: "101" }, { page: "1e2" }]) expect(publicProductQuerySchema.safeParse(input).success).toBe(false);
  });
  it("tiga format asli didecode dan dinormalisasi ke WebP tanpa mempercayai nama file", async () => {
    for (const format of ["jpeg", "png", "webp"] as const) {
      const buffer = await sharp({ create: { width: 3, height: 4, channels: 3, background: "orange" } }).toFormat(format).toBuffer();
      const photo = await normalizePhoto(new File([new Uint8Array(buffer)], "../../payload.php", { type: `image/${format}` }));
      expect((await sharp(photo.buffer).metadata()).format).toBe("webp");
      expect(photo.width).toBe(3);
      expect(photo.height).toBe(4);
    }
  });
  it("MIME palsu, SVG, byte korup, file kosong dan >2 MB ditolak", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
    for (const file of [new File([new Uint8Array(png)], "fake.jpg", { type: "image/jpeg" }), new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }), new File(["broken image"], "x.png", { type: "image/png" })]) await expect(normalizePhoto(file)).rejects.toMatchObject({ code: "INVALID_PHOTO" });
    await expect(normalizePhoto(new File([], "x.png", { type: "image/png" }))).rejects.toMatchObject({ status: 413 });
    await expect(normalizePhoto(new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "x.png", { type: "image/png" }))).rejects.toMatchObject({ status: 413 });
  });
  it("multipart menerima tepat satu file, menolak field/path tambahan dan membatasi byte aktual", async () => {
    const form = new FormData();
    form.append("file", new File(["fixture"], "x.png", { type: "image/png" }));
    expect((await boundedPhotoFile(new Request("http://localhost", { method: "POST", body: form }))).name).toBe("x.png");
    form.append("path", "../secret");
    await expect(boundedPhotoFile(new Request("http://localhost", { method: "POST", body: form }))).rejects.toMatchObject({ status: 422 });
    await expect(boundedPhotoFile(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=x" }, body: new Uint8Array(MAX_PHOTO_BYTES + 65537) }))).rejects.toMatchObject({ status: 413 });
  });
  it("penyimpanan produksi tidak fallback ke filesystem sementara/public", () => {
    expect(() => photoDirectory({ NODE_ENV: "production" })).toThrow();
    expect(() => photoDirectory({ NODE_ENV: "production", PRODUCT_PHOTO_STORAGE_DIR: path.resolve("public/images"), PRODUCT_PHOTO_STORAGE_PERSISTENT: "true" })).toThrow();
    expect(photoDirectory({ NODE_ENV: "test" })).toContain("product-photos-test");
  });
});
