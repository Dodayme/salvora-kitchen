import { describe, expect, it, vi } from "vitest";
import { createCheckoutController } from "../src/lib/checkout-client/controller";
import { createCheckoutJournal, CHECKOUT_RECOVERY_KEY } from "../src/lib/checkout-client/recovery";
import { decodeQuote, decodeCheckoutOrder, type Quote } from "../src/lib/checkout-client/model";
import { ApiClientError, type apiRequest } from "../src/lib/http/client";
const address = { recipientName: "Fixture", phone: "0800000000", addressLine: "Fiktif", city: "Tanjungpinang", province: "Kepulauan Riau", postalCode: null, notes: null };
const totals = { address, subtotal: 10000, discount: 2000, shippingFee: 10000, total: 18000, currency: "IDR" as const, voucher: { id: "v", discount: 2000 }, shipping: { mode: "MANUAL_DELIVERY" as const, label: "Delivery manual" } };
const quote: Quote = { ...totals, quoteId: "quote-1", expiresAt: "2026-10-25T10:05:00Z", items: [{ cartItemId: "cart-item", productId: "product", name: "Risol", unitPrice: 10000, quantity: 1, lineSubtotal: 10000 }], warnings: [] };
const order = { ...totals, id: "order-1", number: "SK-fixture", status: "AWAITING_PAYMENT", createdAt: "2026-10-25T10:00:00Z", paymentDeadline: "2026-10-25T11:00:00Z", items: [{ ...quote.items[0], id: "item-1" }] };
function setup() {
  const values = new Map<string, string>(), storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const journal = createCheckoutJournal(() => storage);
  let time = Date.parse("2026-10-25T10:00:00Z"), allowed = true;
  const request = vi.fn(async (path: string) => ({ data: path === "/api/checkout/quote" ? quote : decodeCheckoutOrder(order), meta: { requestId: "req" } }));
  const key = vi.fn(() => "key-1234567890-abcdef"), completed = vi.fn();
  const create = () => createCheckoutController({ ownerId: "buyer", request: request as unknown as typeof apiRequest, journal, key, now: () => time, authorized: () => allowed, completed });
  const controller = create(); controller.hydrate();
  return { values, storage, journal, request, controller, create, key, completed, advance: (ms: number) => { time += ms; }, disallow: () => { allowed = false; } };
}
describe("checkout confirmation and recovery", () => {
  it("never submits from hydrate or quote; requires explicit acceptance", async () => {
    const s = setup(); await s.controller.quote("address"); await s.controller.confirm(false);
    expect(s.request).toHaveBeenCalledTimes(1); expect(s.controller.getSnapshot().phase).toBe("review"); expect(s.values.size).toBe(0);
  });
  it("saves minimal context before POST, strips address/amount/token from recovery", async () => {
    const s = setup(); await s.controller.quote("address");
    s.request.mockImplementationOnce(async () => { const saved = s.journal.load("buyer")!; expect(saved.quoteId).toBe(quote.quoteId); expect(Object.keys(saved).sort()).toEqual(["key", "ownerId", "quoteId", "version"]); return { data: decodeCheckoutOrder(order), meta: { requestId: "r" } }; });
    await s.controller.confirm(true); expect(s.controller.getSnapshot().phase).toBe("done"); expect(s.completed).toHaveBeenCalledOnce();
  });
  it("retries a lost response after reload/expiry with exactly the same body and key", async () => {
    const s = setup(); await s.controller.quote("address"); s.request.mockRejectedValueOnce(new ApiClientError(0, "NETWORK_ERROR", "", "network")); await s.controller.confirm(true);
    expect(s.controller.getSnapshot().phase).toBe("uncertain"); const first = s.request.mock.calls.at(-1);
    s.advance(900000); const next = s.create(); next.hydrate(); expect(next.getSnapshot().quote).toBeUndefined(); expect(s.request).toHaveBeenCalledTimes(2);
    await next.recover(); expect(s.request.mock.calls.at(-1)).toEqual(first); expect(s.key).toHaveBeenCalledOnce(); expect(next.getSnapshot().phase).toBe("done");
  });
  it("locks concurrent confirms and cannot replace quote while result uncertain", async () => {
    const s = setup(); await s.controller.quote("address"); let reject!: (reason: unknown) => void;
    s.request.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; })); const pending = s.controller.confirm(true); await s.controller.confirm(true);
    expect(s.request).toHaveBeenCalledTimes(2); reject(new Error("lost")); await pending; await s.controller.quote("other"); s.controller.startNew(); expect(s.request).toHaveBeenCalledTimes(2); expect(s.controller.getSnapshot().phase).toBe("uncertain");
  });
  it.each(["CHECKOUT_CHANGED", "QUOTE_EXPIRED", "INSUFFICIENT_STOCK", "PRODUCT_UNAVAILABLE", "CART_EMPTY", "NOT_FOUND", "DELIVERY_UNAVAILABLE"])("requires a fresh explicit quote after %s", async code => {
    const s = setup(); await s.controller.quote("address"); s.request.mockRejectedValueOnce(new ApiClientError(409, code, "changed")); await s.controller.confirm(true);
    expect(s.controller.getSnapshot().phase).toBe("select"); expect(s.controller.getSnapshot().quote).toBeUndefined(); expect(s.values.size).toBe(0); expect(s.request).toHaveBeenCalledTimes(2);
    await s.controller.quote("address"); expect(s.controller.getSnapshot().phase).toBe("review");
  });
  it.each(["IDEMPOTENCY_CONFLICT", "QUOTE_ALREADY_USED"])("preserves reference and blocks replacement on %s", async code => {
    const s = setup(); await s.controller.quote("address"); s.request.mockRejectedValueOnce(new ApiClientError(409, code, "")); await s.controller.confirm(true); await s.controller.quote("address");
    expect(s.controller.getSnapshot().phase).toBe("blocked"); expect(s.journal.load("buyer")).not.toBeNull(); expect(s.request).toHaveBeenCalledTimes(2);
  });
  it("does not send when tab storage fails", async () => {
    const s = setup(); await s.controller.quote("address"); s.storage.setItem = () => { throw Error("unavailable"); }; await s.controller.confirm(true); expect(s.request).toHaveBeenCalledTimes(1); expect(s.controller.getSnapshot().phase).toBe("blocked");
  });
  it("does not submit stale quote, but allows replay of a pending reference", async () => {
    const s = setup(); await s.controller.quote("address"); s.advance(300000); await s.controller.confirm(true); expect(s.request).toHaveBeenCalledTimes(1);
  });
  it("honors 429 cooldown without a timer-triggered POST", async () => {
    const s = setup(); await s.controller.quote("address"); s.request.mockRejectedValueOnce(new ApiClientError(429, "RATE_LIMITED", "", "http", undefined, [], 30)); await s.controller.confirm(true); await s.controller.recover(); expect(s.request).toHaveBeenCalledTimes(2); s.advance(30000); await s.controller.recover(); expect(s.request).toHaveBeenCalledTimes(3);
  });
  it("a new visit after a confirmed checkout starts selection instead of reopening the old order", async () => {
    const s = setup(); await s.controller.quote("address"); await s.controller.confirm(true);
    expect(s.journal.load("buyer")?.orderId).toBe("order-1");
    const next = s.create(); next.hydrate(); await next.recover();
    expect(next.getSnapshot()).toEqual({ phase: "select", retryAt: 0 });
    expect(s.journal.load("buyer")).toBeNull();
    expect(s.request).toHaveBeenCalledTimes(2);
    await next.quote("address");
    expect(next.getSnapshot().phase).toBe("review");
    expect(next.getSnapshot().order).toBeUndefined();
    s.key.mockReturnValueOnce("new-key-1234567890-abcdef");
    s.request.mockImplementationOnce(async () => ({ data: decodeCheckoutOrder({ ...order, id: "order-2" }), meta: { requestId: "new" } }));
    await next.confirm(true);
    expect(next.getSnapshot().order?.id).toBe("order-2");
    expect(next.getSnapshot().order?.status).toBe("AWAITING_PAYMENT");
    expect(s.key).toHaveBeenCalledTimes(2);
  });
  it("does not read a completed old order from a legacy confirmed journal", async () => {
    const s = setup();
    s.journal.save({ version: 1, ownerId: "buyer", quoteId: "old-quote", key: "old-key-1234567890", orderId: "completed-order" });
    const next = s.create(); next.hydrate();
    expect(next.getSnapshot().phase).toBe("select");
    expect(s.request).not.toHaveBeenCalled();
  });
  it("does not leak completed data or rewrite journal after disposal", async () => {
    const s = setup(); await s.controller.quote("address"); let resolve!: (value: { data: ReturnType<typeof decodeCheckoutOrder>; meta: { requestId: string } }) => void;
    s.request.mockImplementationOnce(() => new Promise(done => { resolve = done; })); const pending = s.controller.confirm(true); s.controller.dispose(); s.disallow(); s.journal.clear(); resolve({ data: decodeCheckoutOrder(order), meta: { requestId: "r" } }); await pending; expect(s.values.size).toBe(0); expect(s.completed).not.toHaveBeenCalled();
  });
  it("blocks unauthorized actions", async () => { const s = setup(); s.disallow(); await s.controller.quote("a"); expect(s.request).not.toHaveBeenCalled(); });
  it("isolates account ownership and rejects corrupt/extended recovery", () => {
    const s = setup(); s.journal.save({ version: 1, ownerId: "other", quoteId: "q", key: "key-1234567890-abcdef" }); expect(s.journal.load("buyer")).toBeNull(); expect(s.values.size).toBe(0);
    s.values.set(CHECKOUT_RECOVERY_KEY, JSON.stringify({ version: 1, ownerId: "buyer", quoteId: "q", key: "key-1234567890-abcdef", token: "private" })); const next = s.create(); next.hydrate(); expect(next.getSnapshot().phase).toBe("blocked"); expect(s.values.size).toBe(1);
  });
  it("strips non-public order fields and rejects incompatible DTOs", () => {
    expect(decodeCheckoutOrder({ ...order, inputHash: "private", idempotencyKey: "private", payments: [{ snapToken: "secret" }] })).not.toHaveProperty("payments"); expect(decodeQuote({ ...quote, internalSnapshot: "private" })).not.toHaveProperty("internalSnapshot"); expect(() => decodeQuote({ ...quote, total: null })).toThrow();
  });
});
