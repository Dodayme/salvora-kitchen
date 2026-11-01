import type { UserView } from "@/lib/contracts/user";
import { apiRequest, ApiClientError, isRequestAborted, type ApiRequestOptions } from "@/lib/http/client";
import { decodeSession, type AuthMode } from "./model";

export type SessionSnapshot = { status: "checking" | "anonymous" | "authenticated" | "error"; user: UserView | null; revision: number; error?: unknown };
const initial: SessionSnapshot = { status: "checking", user: null, revision: 0 };
export function createSessionStore(request = apiRequest, notifyChanged: (event: "changing" | "changed") => void = () => {}) {
  let snapshot = initial, generation = 0, read: AbortController | undefined, mutating = false;
  const listeners = new Set<() => void>();
  const commit = (status: SessionSnapshot["status"], user: UserView | null = null, error?: unknown) => {
    const changed = snapshot.user?.id !== user?.id || snapshot.user?.role !== user?.role || status === "error";
    snapshot = { status, user, error, revision: snapshot.revision + (changed ? 1 : 0) };
    for (const listener of listeners) listener();
  };
  const cancel = () => { generation++; read?.abort(); read = undefined; };
  async function refresh(background = false) {
    if (mutating) return;
    cancel(); const current = generation, controller = new AbortController(); read = controller;
    if (!background) commit("checking"); // Foreground identity changes hide previous account data.
    try {
      const { data } = await request("/api/auth/session", { signal: controller.signal, decode: decodeSession });
      if (current !== generation || controller.signal.aborted) return;
      commit(data.user ? "authenticated" : "anonymous", data.user);
      return data.user;
    } catch (error) {
      if (current !== generation || isRequestAborted(error)) return;
      if (error instanceof ApiClientError && error.status === 401) commit("anonymous"); else commit("error", null, error);
    } finally { if (current === generation) read = undefined; }
  }
  async function authenticate(mode: AuthMode, input: Record<string, string>) {
    if (mutating) throw new ApiClientError(0, "AUTH_PENDING", "Tunggu permintaan sebelumnya selesai.");
    mutating = true; cancel(); commit("checking"); notifyChanged("changing");
    try {
      await request(`/api/auth/${mode}`, { method: "POST", json: input, decode: decodeSession });
      // Confirm the browser's cookie, rather than treating a JSON user as a persisted session.
      const { data } = await request("/api/auth/session", { decode: decodeSession });
      if (!data.user) throw new ApiClientError(0, "SESSION_NOT_CONFIRMED", "Sesi belum terkonfirmasi. Periksa pengaturan cookie dan coba periksa sesi.", "protocol");
      commit("authenticated", data.user); notifyChanged("changed"); return data.user;
    } catch (error) {
      const rejected = error instanceof ApiClientError && error.kind === "http" && [401, 403, 409, 422, 429].includes(error.status);
      commit(rejected ? "anonymous" : "error", null, rejected ? undefined : error); notifyChanged("changed"); throw error;
    } finally { mutating = false; }
  }
  async function logout() {
    if (mutating) throw new ApiClientError(0, "AUTH_PENDING", "Tunggu permintaan sebelumnya selesai.");
    mutating = true; cancel(); commit("checking"); notifyChanged("changing");
    try {
      await request("/api/auth/logout", { method: "POST", json: {}, decode: value => { if (value !== null) throw Error("Invalid logout DTO"); return null; } });
      commit("anonymous"); notifyChanged("changed");
    } catch (error) { commit("error", null, error); notifyChanged("changed"); throw error; }
    finally { mutating = false; }
  }
  function expire() { cancel(); commit("anonymous"); notifyChanged("changed"); }
  async function accountRequest<T>(path: string, options?: ApiRequestOptions<T>) {
    try { return await request<T>(path, options); }
    catch (error) {
      if (error instanceof ApiClientError && error.status === 401) expire();
      if (error instanceof ApiClientError && error.status === 403) void refresh();
      throw error;
    }
  }
  return {
    getSnapshot: () => snapshot,
    setNotifier(notify: typeof notifyChanged) { notifyChanged = notify; },
    getServerSnapshot: () => initial,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh, authenticate, logout, cancel, accountRequest,
    suspend() { cancel(); commit("checking"); },
    expire,
  };
}
export type SessionStore = ReturnType<typeof createSessionStore>;
