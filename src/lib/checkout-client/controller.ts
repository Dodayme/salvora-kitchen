import { apiRequest, ApiClientError } from "@/lib/http/client";
import { decodeCheckoutOrder, decodeQuote, quoteExpired, type CheckoutOrder, type CheckoutRecovery, type Quote } from "./model";
import type { createCheckoutJournal } from "./recovery";
type State = { phase: "initial" | "select" | "quoting" | "review" | "sending" | "uncertain" | "blocked" | "done"; quote?: Quote; order?: CheckoutOrder; pending?: CheckoutRecovery; error?: unknown; retryAt: number };
type Dependencies = { ownerId: string; request: typeof apiRequest; journal: ReturnType<typeof createCheckoutJournal>; key: () => string; authorized: () => boolean; now?: () => number; completed: () => void };
const initial: State = { phase: "initial", retryAt: 0 };
const noCommit = new Set(["CHECKOUT_CHANGED", "QUOTE_EXPIRED", "INSUFFICIENT_STOCK", "PRODUCT_UNAVAILABLE", "CART_EMPTY", "NOT_FOUND", "DELIVERY_UNAVAILABLE"]);
/** Explicit actions only. Retries always reuse the persisted body/key, even after quote expiry. */
export function createCheckoutController({ ownerId, request, journal, key, authorized, now = Date.now, completed }: Dependencies) {
  let state = initial, busy = false, disposed = false;
  const listeners = new Set<() => void>();
  const commit = (next: State) => { if (!disposed) { state = next; listeners.forEach(listener => listener()); } };
  const storageFailure = () => new ApiClientError(0, "CHECKOUT_STORAGE_UNAVAILABLE", "Pemulihan tab belum dapat disimpan atau dibaca. Aktifkan penyimpanan tab dan muat ulang. Konfirmasi baru belum dikirim.", "protocol");
  function hydrate() {
    if (state.phase !== "initial" || disposed) return;
    try {
      const pending = journal.load(ownerId);
      // A known order belongs to the previous checkout. Only an unknown POST
      // result must block a new purchase and replay its original key.
      if (pending?.orderId) {
        journal.clear();
        commit({ phase: "select", retryAt: 0 });
      } else commit({ phase: pending ? "uncertain" : "select", pending: pending ?? undefined, retryAt: 0 });
    }
    catch { commit({ phase: "blocked", error: storageFailure(), retryAt: 0 }); }
  }
  async function quote(addressId: string, contact?: { recipientName: string; phone: string }) {
    if (busy || disposed || !authorized() || state.pending || !["select", "review"].includes(state.phase) || now() < state.retryAt) return;
    busy = true; commit({ phase: "quoting", retryAt: 0 });
    try { const result = await request("/api/checkout/quote", { method: "POST", json: contact ? { shippingMode: "PICKUP", contact } : { addressId }, decode: decodeQuote }); if (authorized()) commit({ phase: "review", quote: result.data, retryAt: 0 }); }
    catch (error) { if (authorized()) commit({ phase: "select", error, retryAt: now() + (error instanceof ApiClientError ? error.retryAfterSeconds ?? 0 : 0) * 1000 }); }
    finally { busy = false; }
  }
  async function send(pending: CheckoutRecovery, snapshot?: Quote) {
    busy = true; commit({ phase: "sending", pending, quote: snapshot, retryAt: 0 });
    try {
      // Completed record reads fresh local order state; pending record replays exactly one input.
      const result = await request(pending.orderId ? `/api/orders/${pending.orderId}` : "/api/orders", {
        ...(pending.orderId ? {} : { method: "POST" as const, json: { quoteId: pending.quoteId }, headers: { "Idempotency-Key": pending.key } }), decode: decodeCheckoutOrder,
      });
      if (disposed || !authorized()) return;
      const recovered = { ...pending, orderId: result.data.id };
      // Earlier pending record is already durable. A failed completion update remains safe to replay.
      try { journal.save(recovered); } catch { /* keep the original pending record */ }
      commit({ phase: "done", order: result.data, pending: recovered, retryAt: 0 }); completed();
    } catch (error) {
      if (disposed || !authorized()) return;
      const known = error instanceof ApiClientError ? error : undefined;
      if (!pending.orderId && known?.kind === "http" && [404, 409, 422].includes(known.status) && noCommit.has(known.code)) {
        try { journal.clear(); commit({ phase: "select", error, retryAt: 0 }); }
        catch { commit({ phase: "blocked", pending, error: storageFailure(), retryAt: 0 }); }
      } else commit({ phase: known?.code === "IDEMPOTENCY_CONFLICT" || known?.code === "QUOTE_ALREADY_USED" ? "blocked" : "uncertain", pending, error, retryAt: now() + (known?.retryAfterSeconds ?? 0) * 1000 });
    } finally { busy = false; }
  }
  async function confirm(accepted: boolean) {
    if (busy || disposed || !authorized() || state.phase !== "review" || !state.quote || !accepted || quoteExpired(state.quote, now())) return;
    const snapshot = state.quote;
    try {
      const pending: CheckoutRecovery = { version: 1, ownerId, quoteId: snapshot.quoteId, key: key() };
      journal.save(pending); // Before the first POST; storage failure must not send a mutation.
      await send(pending, snapshot);
    } catch { commit({ phase: "blocked", error: storageFailure(), retryAt: 0 }); }
  }
  async function recover() {
    if (busy || disposed || !authorized() || state.phase !== "uncertain" || !state.pending || now() < state.retryAt) return;
    await send(state.pending);
  }
  function startNew() {
    if (busy || disposed || !authorized() || state.phase !== "done") return;
    try { journal.clear(); commit({ phase: "select", retryAt: 0 }); }
    catch { commit({ ...state, error: storageFailure() }); }
  }
  return { getSnapshot: () => state, getServerSnapshot: () => initial, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, hydrate, quote, confirm, recover, startNew,
    activate() { disposed = false; }, dispose() { disposed = true; } };
}
