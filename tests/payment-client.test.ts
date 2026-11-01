import { describe, expect, it, vi } from "vitest";
import { createPaymentController, type SnapCallbacks } from "../src/lib/payment-client/controller";
import { canRequestPayment, decodeInstruction, decodePaymentOrder, remainingPaymentTime } from "../src/lib/payment-client/model";
import { createPaymentReturn } from "../src/lib/payment-client/return-context";
import { clearCheckoutRecovery } from "../src/lib/checkout-client/recovery";
import { ApiClientError, type apiRequest } from "../src/lib/http/client";
import { safeReturnTo } from "../src/lib/auth-client/model";
const time = Date.parse("2026-10-25T10:00:00Z"), token = "b3c8c0d7-5ddf-4ada-93e2-e81d9bd904c4";
const order = decodePaymentOrder({ id: "order", number: "SK-fixture", createdAt: "2026-10-25T09:30:00Z", paymentDeadline: "2026-10-25T10:30:00Z", status: "AWAITING_PAYMENT", address: { recipientName: "Fixture", phone: "0800000000", addressLine: "Fiktif", city: "Tanjungpinang", province: "Kepulauan Riau", postalCode: null, notes: null }, items: [{ id: "item", productId: "product", name: "Risol", unitPrice: 5000, quantity: 1, lineSubtotal: 5000 }], subtotal: 5000, discount: 1000, shippingFee: 10000, total: 14000, currency: "IDR", voucher: { id: "voucher", discount: 1000 }, shipping: { mode: "MANUAL_DELIVERY", label: "Delivery manual" }, paymentStatus: null, paymentStatuses: [], payments: [], canPay: true, canReconcile: false, attentionReason: null });
const instruction = { orderId: "order", paymentId: "payment", providerOrderId: "SV-fixture", status: "PENDING", snapToken: token, redirectUrl: `https://app.sandbox.midtrans.com/snap/v2/vtweb/${token}`, expiresAt: order.paymentDeadline, reused: false };
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function setup() {
  let currentTime = time, allowed = true, sdkAvailable = true;
  const request = vi.fn(async () => ({ data: order, meta: { requestId: "r" } }));
  const sdk = { pay: vi.fn((token: string, callbacks: SnapCallbacks) => { void token; void callbacks; }), hide: vi.fn() }, remember = vi.fn();
  const controller = createPaymentController({ orderId: "order", request: request as unknown as typeof apiRequest, authorized: () => allowed, sdk: () => sdkAvailable ? sdk : undefined, remember, now: () => currentTime });
  const response = (data: unknown) => request.mockResolvedValueOnce({ data: data as typeof order, meta: { requestId: "r" } });
  return { controller, request, sdk, remember, response, advance: (ms: number) => { currentTime += ms; }, disallow: () => { allowed = false; }, noSdk: () => { sdkAvailable = false; } };
}
describe("payment UI controller: local status is authoritative", () => {
  it("only reads GET on initial refresh; never creates or reconciles automatically", async () => {
    const s = setup(); expect(s.request).not.toHaveBeenCalled(); await s.controller.refresh(); expect(s.request.mock.calls).toHaveLength(1); expect(s.controller.getSnapshot().order?.status).toBe("AWAITING_PAYMENT"); expect(s.sdk.pay).not.toHaveBeenCalled();
  });
  it.each([false, true])("opens new/reused ready instruction only after explicit pay (%s)", async reused => {
    const s = setup(); await s.controller.refresh(); s.response(decodeInstruction({ ...instruction, reused })); await s.controller.pay(); expect(s.remember).toHaveBeenCalledOnce(); expect(s.sdk.pay).toHaveBeenCalledOnce(); expect(s.controller.getSnapshot().phase).toBe("popup"); expect(s.controller.getSnapshot().order?.paymentStatus).toBeNull();
  });
  it.each(["onSuccess", "onPending", "onError", "onClose"] as const)("%s discards callback payload and only reads local order", async callback => {
    const s = setup(); await s.controller.refresh(); s.response(decodeInstruction(instruction)); await s.controller.pay(); const callbacks = s.sdk.pay.mock.calls[0][1]; callbacks[callback](); callbacks.onClose(); await settle();
    expect(s.sdk.hide).toHaveBeenCalledOnce(); expect(s.request).toHaveBeenCalledTimes(3); expect(s.controller.getSnapshot().order?.status).toBe("AWAITING_PAYMENT"); expect(s.controller.getSnapshot().order?.paymentStatus).toBeNull(); expect(s.controller.getSnapshot().phase).toBe("ready");
  });
  it("handles SDK callbacks fired synchronously without losing the read lock", async () => {
    const s = setup(); await s.controller.refresh(); s.response(decodeInstruction(instruction)); s.sdk.pay.mockImplementation((_token, callback) => callback.onClose()); await s.controller.pay(); await settle(); expect(s.request).toHaveBeenCalledTimes(3); expect(s.controller.getSnapshot().phase).toBe("ready");
  });
  it.each(["CREATED", "UNCONFIRMED"])("handles tokenless 202-style %s without a popup or replacement POST", async status => {
    const s = setup(); await s.controller.refresh(); s.response(decodeInstruction({ ...instruction, status, snapToken: null, redirectUrl: null })); s.response({ ...order, canPay: false, canReconcile: true, paymentStatus: status, paymentStatuses: [status] }); await s.controller.pay(); await settle(); await s.controller.pay(); expect(s.request).toHaveBeenCalledTimes(3); expect(s.sdk.pay).not.toHaveBeenCalled();
  });
  it("locks double clicks and blocks another creation while popup is open", async () => {
    const s = setup(); await s.controller.refresh(); let release!: (value: { data: typeof order; meta: { requestId: string } }) => void;
    s.request.mockImplementationOnce(() => new Promise(resolve => { release = resolve; })); const pending = s.controller.pay(); await s.controller.pay(); release({ data: decodeInstruction(instruction) as unknown as typeof order, meta: { requestId: "r" } }); await pending; await s.controller.pay(); expect(s.request).toHaveBeenCalledTimes(2);
  });
  it.each([new ApiClientError(0, "NETWORK_ERROR", "", "network"), new ApiClientError(200, "INVALID_RESPONSE", "", "protocol"), new ApiClientError(503, "UNAVAILABLE", ""), new ApiClientError(409, "PAYMENT_RECONCILIATION_REQUIRED", "")])("uncertain/error response triggers GET and never an automatic retry", async error => {
    const s = setup(); await s.controller.refresh(); s.request.mockRejectedValueOnce(error); s.response({ ...order, canPay: false, canReconcile: true, paymentStatus: "UNCONFIRMED", paymentStatuses: ["UNCONFIRMED"] }); await s.controller.pay(); await settle(); await s.controller.pay(); expect(s.request).toHaveBeenCalledTimes(3); expect(s.sdk.pay).not.toHaveBeenCalled();
  });
  it("does not create instructions without SDK or durable return context", async () => {
    const s = setup(); await s.controller.refresh(); s.noSdk(); await s.controller.pay(); expect(s.request).toHaveBeenCalledTimes(1);
    const next = setup(); await next.controller.refresh(); next.remember.mockImplementation(() => { throw Error("storage"); }); await next.controller.pay(); expect(next.request).toHaveBeenCalledTimes(1);
  });
  it("does not use instructions for another order or after deadline", async () => {
    const s = setup(); await s.controller.refresh(); s.response(decodeInstruction({ ...instruction, orderId: "foreign" })); await s.controller.pay(); await settle(); expect(s.sdk.pay).not.toHaveBeenCalled();
    const late = setup(); await late.controller.refresh(); late.advance(1800000); await late.controller.pay(); expect(late.request).toHaveBeenCalledTimes(1);
  });
  it("rejects a mismatched deadline and a throwing SDK without claiming payment failure", async () => {
    const s = setup(); await s.controller.refresh(); s.response(decodeInstruction({ ...instruction, expiresAt: "2026-10-25T11:00:00Z" })); await s.controller.pay(); await settle(); expect(s.sdk.pay).not.toHaveBeenCalled(); expect(s.controller.getSnapshot().order?.status).toBe("AWAITING_PAYMENT");
    const throwing = setup(); await throwing.controller.refresh(); throwing.response(decodeInstruction(instruction)); throwing.sdk.pay.mockImplementation(() => { throw Error("SDK failed"); }); await throwing.controller.pay(); await settle(); expect(throwing.sdk.hide).toHaveBeenCalledOnce(); expect(throwing.controller.getSnapshot().order?.paymentStatus).toBeNull();
  });
  it("only reconciles when server permits, respects 429 Retry-After and never auto-reconciles", async () => {
    const s = setup(); await s.controller.refresh(); await s.controller.reconcile(); expect(s.request).toHaveBeenCalledTimes(1); s.response({ ...order, canReconcile: true }); await s.controller.refresh(); s.request.mockRejectedValueOnce(new ApiClientError(429, "RATE_LIMITED", "", "http", undefined, [], 30)); await s.controller.reconcile(); await s.controller.reconcile(); await s.controller.refresh(); expect(s.request).toHaveBeenCalledTimes(3); s.advance(30000); s.response({ ...order, canReconcile: true }); await s.controller.refresh(); s.response({ order: { ...order, status: "PROCESSING", paymentStatus: "SUCCESS", paymentStatuses: ["SUCCESS"], canPay: false }, reconciledAt: "2026-10-25T10:01:00Z" }); await s.controller.reconcile(); expect(s.controller.getSnapshot().order?.paymentStatus).toBe("SUCCESS");
  });
  it("retains unconfirmed state after reconciliation 503 without fake release/success", async () => {
    const s = setup(); s.response({ ...order, canReconcile: true, canPay: false }); await s.controller.refresh(); s.request.mockRejectedValueOnce(new ApiClientError(503, "PAYMENT_RECONCILIATION_UNCONFIRMED", "", "http", undefined, [], 30)); await s.controller.reconcile(); expect(s.controller.getSnapshot().needsRead).toBe(true); expect(s.controller.getSnapshot().order?.status).toBe("AWAITING_PAYMENT");
  });
  it("ignores late callbacks after disposal/logout and hides open SDK", async () => {
    const s = setup(); await s.controller.refresh(); s.response(decodeInstruction(instruction)); await s.controller.pay(); const callback = s.sdk.pay.mock.calls[0][1]; s.disallow(); s.controller.dispose(); callback.onSuccess(); await settle(); expect(s.request).toHaveBeenCalledTimes(2); expect(s.sdk.hide).toHaveBeenCalledOnce();
  });
  it.each(["SUCCESS", "REFUNDED", "PARTIALLY_REFUNDED", "REVERSED", "CREATED", "UNCONFIRMED"] as const)("cannot start a new attempt for %s even with inconsistent canPay hint", status => expect(canRequestPayment({ ...order, paymentStatuses: [status] }, time)).toBe(false));
  it("countdown zero does not derive released/success state", () => expect(remainingPaymentTime(order.paymentDeadline, time + 1800000)).toEqual({ seconds: 0, label: "0:00" }));
});
describe("Sandbox boundary and safe return context", () => {
  it.each([`https://app.midtrans.com/snap/v2/vtweb/${token}`, `https://evil.test/snap/v2/vtweb/${token}`, `https://app.sandbox.midtrans.com/snap/v2/vtweb/${token}?x=1`, `https://user@app.sandbox.midtrans.com/snap/v2/vtweb/${token}`, `https://app.sandbox.midtrans.com/snap/v2/vtweb/${token}#token`])("rejects unsafe/wrong-environment instruction URL", redirectUrl => expect(() => decodeInstruction({ ...instruction, redirectUrl })).toThrow());
  it("strips token, provider reference and private fields from displayed order", () => {
    const value = decodePaymentOrder({ ...order, inputHash: "private", snapToken: token, payments: [{ id: "pay", status: "PENDING", amount: 14000, currency: "IDR", channel: null, createdAt: order.createdAt, expiresAt: order.paymentDeadline, paidAt: null, snapToken: token, providerOrderId: "private" }] }); expect(value).not.toHaveProperty("snapToken"); expect(value.payments[0]).not.toHaveProperty("providerOrderId");
  });
  it("persists only version/owner/order, isolates owner and clears on auth invalidation", () => {
    const values = new Map<string, string>(), storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } }, context = createPaymentReturn(() => storage);
    context.save("buyer", "order"); expect(Object.keys(JSON.parse([...values.values()][0])).sort()).toEqual(["orderId", "ownerId", "version"]); expect(context.load("other")).toBeNull(); expect(values.size).toBe(0); context.save("buyer", "order"); vi.stubGlobal("window", { sessionStorage: storage }); try { clearCheckoutRecovery(); expect(values.size).toBe(0); } finally { vi.unstubAllGlobals(); }
  });
  it("allows internal payment routes without propagating provider queries/tokens", () => { expect(safeReturnTo("/pembayaran/order", "BUYER")).toBe("/pembayaran/order"); expect(safeReturnTo("/pembayaran/order", "ADMIN")).toBeNull(); expect(safeReturnTo("/payment/finish")).toBe("/payment/finish"); expect(safeReturnTo("/payment/finish?transaction_status=settlement")).toBeNull(); });
});
