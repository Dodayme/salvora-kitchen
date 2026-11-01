import { describe, expect, it } from "vitest";
import { addressCreateSchema, addressPatchSchema, cartAddSchema, quantitySchema } from "../src/lib/buyer/validation";

const address = { recipientName: "Pembeli", phone: "+62 812-0000-0000", addressLine: "Jalan Contoh 1", city: "Bandung", province: "Jawa Barat" };
describe("Validasi alamat dan keranjang", () => {
  it("alamat minimal tidak mewajibkan kode pos/wilayah yang belum diputuskan", () => {
    expect(addressCreateSchema.parse(address)).toEqual({ ...address, phone: "+6281200000000" });
    expect(addressCreateSchema.safeParse({ ...address, postalCode: null, notes: null }).success).toBe(true);
  });
  it("menolak field kepemilikan, alamat kosong dan PATCH kosong", () => {
    for (const extra of [{ userId: "foreign" }, { recipientName: " " }, { phone: "abcdef" }, { phone: "------" }, { notes: "x".repeat(1001) }, { addressLine: "\u0000" }]) expect(addressCreateSchema.safeParse({ ...address, ...extra }).success).toBe(false);
    expect(addressPatchSchema.safeParse({}).success).toBe(false);
  });
  it("jumlah integer positif, bukan string; harga/owner tidak diterima", () => {
    for (const quantity of [0, -1, 0.5, "2", 2147483648, null]) expect(quantitySchema.safeParse({ quantity }).success).toBe(false);
    for (const extra of [{ unitPrice: 1 }, { userId: "foreign" }, { cartId: "foreign" }]) expect(cartAddSchema.safeParse({ productId: "product", quantity: 1, ...extra }).success).toBe(false);
  });
});
