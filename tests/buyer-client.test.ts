import { describe, expect, it } from "vitest";
import { addressPayload, decodeAddress, decodeAddresses, decodeNull, decodeVoucher, emptyAddress, mutationRecovery, voucherCopy } from "../src/lib/buyer-client/model";
import { ApiClientError } from "../src/lib/http/client";
const draft = { ...emptyAddress, recipientName: "  Pembeli test  ", phone: "+62 812-3456", addressLine: "Jalan fixture", city: "Tanjungpinang", province: "Kepulauan Riau" };
describe("buyer browser boundary", () => {
  it("trims text and normalizes phone separators while preserving the prefix, sends null to clear optional fields", () => {
    const parsed = addressPayload(draft); expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toMatchObject({ recipientName: "Pembeli test", phone: "+628123456", postalCode: null, notes: null });
  });
  it.each(["recipientName", "phone", "addressLine", "city", "province"])("requires %s", field => expect(addressPayload({ ...draft, [field]: " " }).success).toBe(false));
  it.each(["abc123", "123", "62+123456", "123456\u0000"])("rejects invalid phone %s", phone => expect(addressPayload({ ...draft, phone }).success).toBe(false));
  it("rejects oversized optional text", () => expect(addressPayload({ ...draft, notes: "x".repeat(1001) }).success).toBe(false));
  it("whitelists address output, stripping ownership/private fields", () => {
    const row = { ...draft, id: "fixture-id", postalCode: null, notes: null, userId: "private" };
    expect(decodeAddress(row)).not.toHaveProperty("userId"); expect(decodeAddresses([row])).toHaveLength(1);
  });
  it("does not invent successful deletion for malformed response", () => { expect(decodeNull(null)).toBeNull(); expect(() => decodeNull({})).toThrow(); });
  it.each(["AVAILABLE", "RESERVED", "USED"] as const)("decodes persisted voucher state %s without deriving eligibility", status => {
    const result = decodeVoucher({ voucher: { id: "voucher", type: "NEW_BUYER", percentage: 20, maxDiscount: 100000, status, reservedOrderId: null, usedAt: null, userId: "private" } });
    expect(result.voucher?.status).toBe(status); expect(result.voucher).not.toHaveProperty("userId"); expect(voucherCopy[status].text.length).toBeGreaterThan(10);
  });
  it("preserves missing voucher, rejects unrecognized policy", () => {
    expect(decodeVoucher({ voucher: null }).voucher).toBeNull();
    expect(() => decodeVoucher({ voucher: { id: "v", type: "GENERAL_PROMO", percentage: 30 } })).toThrow();
  });
  it.each([new Error("private"), new ApiClientError(0, "NETWORK_ERROR", "", "network"), new ApiClientError(200, "INVALID_RESPONSE", "", "protocol"), new ApiClientError(503, "UNAVAILABLE", "")])("blocks automatic replay of uncertain mutations", error => expect(mutationRecovery(error)).toBe("uncertain"));
  it.each([404, 409])("requires fresh read after %i", status => expect(mutationRecovery(new ApiClientError(status, "CHANGED", ""))).toBe("refresh"));
  it.each([401, 403, 422, 429])("allows explicit retry policy for definitive HTTP %i", status => expect(mutationRecovery(new ApiClientError(status, "REJECTED", ""))).toBe("retry"));
});
