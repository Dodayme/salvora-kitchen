import { apiRequest, ApiClientError, type ApiMeta } from "@/lib/http/client";
import { decodeReviews, type Review } from "./model";
import { readWithStartupRetry } from "@/lib/http/startup-read";

type State = { reviews: Review[]; visible: number; total: number; summary?: ApiMeta["ratingSummary"]; loading: boolean; error?: unknown; hasMore: boolean };
const initial: State = { reviews: [], visible: 2, total: 0, loading: true, hasMore: false };
export function createReviewFeed(id: string, request = apiRequest) {
  let state = initial, rows: Review[] = [], page = 0, totalPages = 1, busy = false, active = false, abort: AbortController | undefined;
  const listeners = new Set<() => void>();
  const commit = (next: State) => { if (active) { state = next; listeners.forEach(listener => listener()); } };
  async function load(target: number) {
    if (!active || busy) return;
    busy = true;
    const current = new AbortController(); abort = current;
    commit({ ...state, loading: true, error: undefined });
    try {
      let total = state.total, summary = state.summary, restarts = 0;
      // Keep a fixed server page size so expanding 2 -> 7 -> 12 never skips rows.
      while (rows.length < target && page < totalPages) {
        const next = page + 1;
        const result = await readWithStartupRetry(() => request(`/api/products/${id}/reviews?page=${next}&pageSize=5`, { signal: current.signal, decode: decodeReviews }), current.signal);
        if (!active || current.signal.aborted) return;
        const pagination = result.meta.pagination;
        if (!pagination || !result.meta.ratingSummary || pagination.page !== next) throw new ApiClientError(200, "INVALID_RESPONSE", "Informasi ulasan belum lengkap. Silakan coba lagi.", "protocol");
        // Offset pages shift when reviews are added/deleted. Re-read from the start
        // rather than merging incompatible pages and losing the newest reviews.
        if (page > 0 && pagination.total !== total) {
          rows = []; page = 0; totalPages = 1;
          if (++restarts > 2) throw new ApiClientError(409, "REVIEWS_CHANGED", "Ulasan sedang diperbarui. Silakan coba lagi.", "protocol");
          continue;
        }
        const known = new Set(rows.map(row => row.id));
        rows = [...rows, ...result.data.filter(row => !known.has(row.id))];
        page = next; totalPages = pagination.totalPages; total = pagination.total; summary = result.meta.ratingSummary;
      }
      commit({ reviews: rows.slice(0, target), visible: target, total, summary, loading: false, hasMore: rows.length > target || page < totalPages });
    } catch (error) {
      if (!current.signal.aborted) commit({ ...state, loading: false, error });
    } finally { if (abort === current) busy = false; }
  }
  return {
    getSnapshot: () => state, getServerSnapshot: () => initial,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate() { active = true; },
    initial() { return load(2); },
    more() { if (state.hasMore) return load(state.visible + 5); },
    retry() { return load(state.summary ? state.visible + 5 : 2); },
    dispose() { active = false; abort?.abort(); busy = false; },
  };
}
