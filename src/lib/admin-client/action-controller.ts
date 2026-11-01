import { apiRequest, ApiClientError, type ApiResult } from "@/lib/http/client";
type State = { phase: "editing" | "pending" | "needsReload" | "saved"; error?: unknown; retryAt: number };
const initial: State = { phase: "editing", retryAt: 0 };
export function createModalControls(close: () => void) {
  let locked = false;
  return { close: () => { if (!locked) close(); }, canStart: () => !locked, pending: (value: boolean) => { locked = value; } };
}
export function createAdminAction({ request, authorized, canStart = () => true, pending = () => {}, now = Date.now }: { request: typeof apiRequest; authorized: () => boolean; canStart?: () => boolean; pending?: (value: boolean) => void; now?: () => number }) {
  let state = initial, locked = false, disposed = false; const listeners = new Set<() => void>();
  const commit = (value: State) => { if (!disposed) { state = value; listeners.forEach(listener => listener()); } };
  async function run<T>(operation: (client: typeof apiRequest) => Promise<ApiResult<T>>, done: (data: T) => void) {
    if (locked || disposed || !authorized() || !canStart() || state.phase !== "editing" || now() < state.retryAt) return;
    locked = true; pending(true); commit({ phase: "pending", retryAt: 0 }); let result: ApiResult<T> | undefined;
    try { result = await operation(request); if (!disposed && authorized()) commit({ phase: "saved", retryAt: 0 }); }
    catch (error) {
      if (!disposed && authorized()) {
        const known = error instanceof ApiClientError;
        const blocked = !known || error.kind !== "http" || error.status >= 500 || error.status === 404 || error.status === 409 && error.code !== "RESOURCE_EXISTS";
        commit({ phase: blocked ? "needsReload" : "editing", error, retryAt: now() + (known ? error.retryAfterSeconds ?? 0 : 0) * 1000 });
      }
    } finally { locked = false; if (!disposed) pending(false); }
    if (result && !disposed && authorized()) done(result.data);
  }
  return { getSnapshot: () => state, getServerSnapshot: () => initial, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, run,
    reset() { if (!locked && !disposed && state.phase !== "needsReload") commit({ phase: "editing", retryAt: state.retryAt }); }, activate() { disposed = false; }, dispose() { disposed = true; } };
}
