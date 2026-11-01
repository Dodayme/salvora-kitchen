
import { expect, it } from "vitest";
import { addressInput, decodeAddress } from "../src/lib/buyer-client/model";
import { addressCreateSchema } from "../src/lib/buyer/validation";
import { pickupContactSchema } from "../src/lib/checkout/validation";
import { receivingMessage } from "../src/lib/order-client/receiving-message";

const schemas = [addressInput.pick({ phone: true }), addressCreateSchema.pick({ phone: true }), pickupContactSchema.pick({ phone: true })];
it.each(["1-----", "1234567", "1234567890123456", "abc08123456789", "----()"])("rejects unusable contact %s consistently", phone => {
  for (const schema of schemas) expect(schema.safeParse({ phone }).success).toBe(false);
});
it.each([["0812-3456-7890", "081234567890"], ["+62 (812) 3456-7890", "+6281234567890"], ["0771 123456", "0771123456"]])("normalizes contact %s consistently", (phone, normalized) => {
  for (const schema of schemas) expect(schema.parse({ phone })).toEqual({ phone: normalized });
});
it("shows pickup instructions for the current status without changing stored history", () => {
  const shipping = { mode: "PICKUP", label: "Tunggu status Siap diambil sebelum datang" };
  expect(receivingMessage({ status: "PROCESSING", shipping })).toContain("Tunggu");
  expect(receivingMessage({ status: "READY_FOR_PICKUP", shipping })).toContain("siap diambil");
  expect(receivingMessage({ status: "COMPLETED", shipping })).not.toContain("Tunggu");
  expect(receivingMessage({ status: "EXPIRED", shipping })).toContain("kedaluwarsa");
  expect(receivingMessage({ status: "NEEDS_ATTENTION", shipping })).toContain("Hubungi");
  expect(shipping.label).toContain("Tunggu");
});

it("keeps legacy addresses readable so their contact can be corrected", () => {
  const address = { id: "old-address", recipientName: "Pembeli", phone: "1-----", addressLine: "Jalan Contoh", city: "Tanjungpinang", province: "Kepulauan Riau", postalCode: null, notes: null };
  expect(decodeAddress(address).phone).toBe("1-----");
  expect(addressInput.safeParse(address).success).toBe(false);
});
