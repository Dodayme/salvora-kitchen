import { describe, expect, it, vi } from "vitest";
import { adminOrdersPath, decodeAdminOrder, decodeAdminOrders, decodeAdminPayments, emptyOrderFilter, fulfillmentCandidate, fulfillmentPayload, notePayload } from "../src/lib/admin-client/orders-model";
import { decodeBuyerOrder } from "../src/lib/order-client/model";
import { ApiClientError, type apiRequest } from "../src/lib/http/client";
import { createAdminAction } from "../src/lib/admin-client/action-controller";
const stamp = "2026-10-25T01:00:00.000Z";
const payment = { id: "p", status: "SUCCESS" as const, amount: 14000, currency: "IDR" as const, channel: "bank_transfer", createdAt: stamp, expiresAt: stamp, paidAt: stamp };
function raw() { return { id: "o", number: "N", createdAt: stamp, status: "PROCESSING" as const, paymentStatus: "SUCCESS" as const, paymentStatuses: ["FAILED", "SUCCESS"], channel: "bank_transfer", channels: ["credit_card", "bank_transfer"], total: 14000, currency: "IDR", paymentDeadline: stamp, itemCount: 1, itemSummary: [{ name: "Snapshot", quantity: 1 }], items: [{ id: "item", productId: "prod", name: "Snapshot", quantity: 1, unitPrice: 4000, lineSubtotal: 4000, canReview: false, reviewId: null }], address: { recipientName: "Fixture", phone: "0800000000", addressLine: "Snapshot", city: "Test", province: "Test", postalCode: null, notes: null }, subtotal: 4000, discount: 0, shippingFee: 10000, voucher: null, shipping: { mode: "MANUAL_DELIVERY", label: "Fixture" }, canPay: false, canReconcile: true, attentionReason: null, payments: [payment], history: [{ fromStatus: "PROCESSING", toStatus: "PROCESSING", actor: "ADMIN", actorUser: { id: "admin", name: "Admin fixture", email: "private" }, changedAt: stamp, note: "<script>private note</script>" }] }; }
describe("admin order data and privacy", () => {
  it("keeps private history for admin only and discards tokens/internal fields", () => {
    const value = { ...raw(), secret: "private", payments: [{ ...payment, snapToken: "private", midtransTransactionId: "private", providerOrderId: "private" }] };
    const admin = decodeAdminOrder(value, "o"); expect(admin.history[0].note).toBe("<script>private note</script>"); expect(admin.history[0].actorUser).toEqual({ name: "Admin fixture" });
    expect(admin).not.toHaveProperty("secret"); expect(admin.payments[0]).not.toHaveProperty("snapToken"); expect(admin.payments[0]).not.toHaveProperty("providerOrderId");
    expect(decodeBuyerOrder(value).history).toEqual([]);
  });
  it("requires matching detail ID, explicit history and valid statuses", () => { expect(() => decodeAdminOrder(raw(), "foreign")).toThrow(); expect(() => decodeAdminOrder({ ...raw(), history: undefined })).toThrow(); expect(() => decodeAdminOrder({ ...raw(), status: "ACTIVE" })).toThrow(); });
  it("whitelists buyer name and payment list fields, preserving all attempts", () => {
    expect(decodeAdminOrders([{ ...raw(), buyer: { id: "buyer", name: "Buyer", email: "private" } }])[0].buyer).toEqual({ name: "Buyer" });
    const rows = decodeAdminPayments([{ ...payment, orderId: "o", orderNumber: "N", snapToken: "private" }, { ...payment, id: "p2", status: "FAILED", orderId: "o", orderNumber: "N" }]); expect(rows).toHaveLength(2); expect(rows[0]).not.toHaveProperty("snapToken");
  });
});
describe("admin filters and date boundaries", () => {
  it("has no implicit period and uses exact fields for each list", () => {
    expect(adminOrdersPath("orders", 1, emptyOrderFilter)).toBe("/api/admin/orders?page=1&pageSize=10");
    const filter = { ...emptyOrderFilter, q: " F%_ ", status: "PROCESSING", paymentStatus: "FAILED", channel: " bank_transfer ", orderId: "o" };
    const order = new URL(adminOrdersPath("orders", 2, filter)!, "https://fixture.invalid"), payments = new URL(adminOrdersPath("payments", 1, filter)!, "https://fixture.invalid");
    expect(order.searchParams.get("q")).toBe("F%_"); expect(order.searchParams.get("status")).toBe("PROCESSING"); expect(order.searchParams.has("orderId")).toBe(false);
    expect(payments.searchParams.get("status")).toBe("FAILED"); expect(payments.searchParams.get("orderId")).toBe("o"); expect(payments.searchParams.has("paymentStatus")).toBe(false); expect(payments.searchParams.has("q")).toBe(false);
  });
  it("converts inclusive WIB date input to exclusive UTC bounds", () => { const path = adminOrdersPath("payments", 1, { ...emptyOrderFilter, fromDate: "2026-10-25", toDate: "2026-10-25" })!; const q = new URL(path, "https://fixture.invalid").searchParams; expect(q.get("from")).toBe("2026-10-24T17:00:00.000Z"); expect(q.get("to")).toBe("2026-10-25T17:00:00.000Z"); });
  it.each([{ fromDate: "2026-10-25" }, { fromDate: "2026-02-30", toDate: "2026-03-01" }, { fromDate: "2026-10-26", toDate: "2026-10-25" }, { channel: "bank transfer" }, { channel: "a".repeat(65) }, { q: "a".repeat(51) }, { q: "x\0" }, { status: "ACTIVE" }, { paymentStatus: "PAID" }])("rejects invalid order filter %#", patch => expect(adminOrdersPath("orders", 1, { ...emptyOrderFilter, ...patch })).toBeNull());
  it("rejects invalid IDs/pages and duplicate URL order ID surrogate", () => { expect(adminOrdersPath("payments", 1, { ...emptyOrderFilter, orderId: "../x" })).toBeNull(); expect(adminOrdersPath("orders", 0, emptyOrderFilter)).toBeNull(); expect(adminOrdersPath("orders", 1.5, emptyOrderFilter)).toBeNull(); });
});
describe("manual receipt and fulfillment payload", () => {
  it("sends only next transition with current expectedStatus", () => { expect(fulfillmentPayload("PROCESSING", "SHIPPED", "  delivery manual  ", true).data).toEqual({ status: "SHIPPED", expectedStatus: "PROCESSING", note: "delivery manual" }); expect(fulfillmentPayload("PROCESSING", "SHIPPED", "", false).data).toEqual({ status: "SHIPPED", expectedStatus: "PROCESSING" }); });
  it("requires explicit receipt confirmation plus trimmed note to complete", () => { expect(fulfillmentPayload("SHIPPED", "COMPLETED", "Confirmed", false).success).toBe(false); expect(fulfillmentPayload("SHIPPED", "COMPLETED", "  ", true).success).toBe(false); expect(fulfillmentPayload("SHIPPED", "COMPLETED", " Done ", true).data).toEqual({ status: "COMPLETED", expectedStatus: "SHIPPED", note: "Done", receiptConfirmed: true }); });
  it.each(["AWAITING_PAYMENT", "COMPLETED", "EXPIRED", "NEEDS_ATTENTION", "PROCESSING"] as const)("prevents jump/backward completion from %s", status => expect(fulfillmentPayload(status, "COMPLETED", "Confirmed", true).success).toBe(false));
  it("validates Unicode count/control characters and note-only whitelist", () => { expect(notePayload("😀".repeat(1000)).success).toBe(true); expect(notePayload("😀".repeat(1001)).success).toBe(false); expect(notePayload("x\0").success).toBe(false); expect(notePayload(" \n ").success).toBe(false); expect(notePayload(" line1\nline2 ").data).toEqual({ note: "line1\nline2" }); });
  it("offers only a candidate, hides obvious blocked statuses/attempts", () => { const order = decodeAdminOrder(raw()); expect(fulfillmentCandidate(order)).toBe("SHIPPED"); expect(fulfillmentCandidate({ ...order, status: "SHIPPED" })).toBe("COMPLETED"); expect(fulfillmentCandidate({ ...order, status: "NEEDS_ATTENTION" })).toBeNull(); expect(fulfillmentCandidate({ ...order, paymentStatus: null })).toBeNull(); expect(fulfillmentCandidate({ ...order, payments: [payment, payment] })).toBeNull(); for (const status of ["CREATED", "PENDING", "UNCONFIRMED", "REFUNDED", "PARTIALLY_REFUNDED", "REVERSED"] as const) expect(fulfillmentCandidate({ ...order, payments: [payment, { ...payment, status, id: "other" }] })).toBeNull(); });
});
describe("order action recovery", () => {
  it.each(["ORDER_STATUS_CONFLICT", "ORDER_TRANSITION_INVALID", "ORDER_PAYMENT_NOT_FULFILLABLE"])("requires review on %s without a second mutation", async code => { const action = createAdminAction({ request: vi.fn() as unknown as typeof apiRequest, authorized: () => true }), operation = vi.fn(async () => { throw new ApiClientError(409, code, ""); }); await action.run(operation, vi.fn()); await action.run(operation, vi.fn()); expect(operation).toHaveBeenCalledOnce(); expect(action.getSnapshot().phase).toBe("needsReload"); });
  it("does not retry note POST after an uncertain committed response", async () => { let notes = 0; const action = createAdminAction({ request: vi.fn() as unknown as typeof apiRequest, authorized: () => true }); const operation = vi.fn(async () => { notes++; throw new ApiClientError(0, "NETWORK_ERROR", "", "network"); }); await action.run(operation, vi.fn()); action.reset(); await action.run(operation, vi.fn()); expect(notes).toBe(1); expect(action.getSnapshot().phase).toBe("needsReload"); });
});
