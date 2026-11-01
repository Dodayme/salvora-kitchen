import { apiRequest, ApiClientError } from "@/lib/http/client";
import { decodeSubmittedReview, reviewPayload } from "./model";
type State = { phase: "editing" | "pending" | "needsReload" | "saved"; error?: unknown; fields: Partial<Record<"rating" | "comment", string>>; retryAt: number };
const initial: State = { phase: "editing", fields: {}, retryAt: 0 };
type Dependencies = { itemId: string; productId: string; request: typeof apiRequest; authorized: () => boolean; eligible: () => boolean; saved: () => void; now?: () => number };
/** One explicit submit; uncertain result or stale eligibility requires GET order, never replay. */
export function createReviewController({ itemId, productId, request, authorized, eligible, saved, now = Date.now }: Dependencies) {
  let state = initial, locked = false, disposed = false; const listeners = new Set<() => void>();
  const commit = (value: State) => { if (!disposed) { state = value; listeners.forEach(listener => listener()); } };
  async function submit(rating: string, comment: string) {
    if (locked || disposed || !authorized() || state.phase !== "editing" || now() < state.retryAt) return;
    if (!eligible()) { commit({ phase: "needsReload", fields: {}, retryAt: 0 }); return; }
    const parsed = reviewPayload(rating, comment);
    if (!parsed.success) { const fields: State["fields"] = {}; for (const issue of parsed.error.issues) fields[issue.path[0] === "rating" ? "rating" : "comment"] = issue.path[0] === "rating" ? "Pilih rating bulat 1–5." : "Komentar harus 10–1.000 karakter setelah dirapikan, tanpa karakter kontrol terlarang."; commit({ phase: "editing", fields, retryAt: 0 }); return; }
    locked = true; commit({ phase: "pending", fields: {}, retryAt: 0 });
    try {
      const { data } = await request(`/api/order-items/${itemId}/review`, { method: "POST", json: parsed.data, decode: decodeSubmittedReview });
      if (disposed || !authorized()) return;
      if (data.productId !== productId) throw new ApiClientError(201, "INVALID_RESPONSE", "Hasil ulasan perlu diperiksa kembali.", "protocol");
      commit({ phase: "saved", fields: {}, retryAt: 0 }); saved();
    } catch (error) {
      if (disposed || !authorized()) return;
      const known = error instanceof ApiClientError;
      const blocked = !known || error.kind !== "http" || [404, 409].includes(error.status) || error.status >= 500;
      const fields: State["fields"] = {};
      if (known && error.status === 422) for (const issue of error.fields) if (issue.path === "rating" || issue.path === "comment") fields[issue.path] = issue.path === "rating" ? "Pilih rating bulat 1–5." : "Periksa komentar (10–1.000 karakter setelah trim).";
      commit({ phase: blocked ? "needsReload" : "editing", error, fields, retryAt: now() + (known ? error.retryAfterSeconds ?? 0 : 0) * 1000 });
    } finally { locked = false; }
  }
  return { getSnapshot: () => state, getServerSnapshot: () => initial, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, submit, activate() { disposed = false; }, dispose() { disposed = true; } };
}
