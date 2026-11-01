import { describe, expect, it } from "vitest";
import { deliveryPolicy, PAYMENT_EXPIRY_MINUTES, QUOTE_TTL_MINUTES } from "../src/lib/checkout/policy";
import { idempotencyKeySchema, orderInputSchema, quoteInputSchema } from "../src/lib/checkout/validation";

describe("Kebijakan dan input checkout", () => {
  it("ongkir tetap per pesanan hanya untuk kota/provinsi yang dilayani", () => {
    for (const city of ["Tanjungpinang", " TANJUNG PINANG ", "Kota Tanjungpinang", "Kota  Tanjung Pinang"]) expect(deliveryPolicy({ city, province: "Kepulauan Riau" }).fee).toBe(10000);
    for (const address of [{ city: "Batam", province: "Kepulauan Riau" }, { city: "Tanjungpinang", province: "Riau" }, { city: "Kabupaten Tanjungpinang", province: "Kepulauan Riau" }]) expect(() => deliveryPolicy(address)).toThrow();
    expect(PAYMENT_EXPIRY_MINUTES).toBe(60); expect(QUOTE_TTL_MINUTES).toBe(5);
  });
  it("hanya menerima referensi server dan key idempotensi terbatas", () => {
    expect(quoteInputSchema.safeParse({ addressId: "address", total: 1 }).success).toBe(false);
    expect(orderInputSchema.safeParse({ quoteId: "quote", voucherId: "foreign" }).success).toBe(false);
    for (const key of [null, "short", "a".repeat(129), "unsafe key 123456789"]) expect(idempotencyKeySchema.safeParse(key).success).toBe(false);
    expect(idempotencyKeySchema.safeParse("test-key-123456789").success).toBe(true);
  });
});

describe("Pilihan penerimaan checkout", () => {
  it("ambil sendiri cukup kontak, tanpa alamat dan tanpa biaya dari browser", () => {
    expect(quoteInputSchema.safeParse({ shippingMode: "PICKUP", contact: { recipientName: "Dodi", phone: "081234567890" } }).success).toBe(true);
    for (const value of [ { shippingMode: "PICKUP" }, { shippingMode: "PICKUP", contact: { recipientName: "Dodi", phone: "abc" } }, { shippingMode: "MANUAL_DELIVERY" }, { shippingMode: "PICKUP", contact: { recipientName: "Dodi", phone: "081234567890" }, shippingFee: 0 } ]) expect(quoteInputSchema.safeParse(value).success).toBe(false);
  });
});
