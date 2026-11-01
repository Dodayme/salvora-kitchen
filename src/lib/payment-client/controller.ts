import { apiRequest, ApiClientError } from "@/lib/http/client";
import { canRequestPayment, decodeInstruction, decodePaymentOrder, decodeReconciled, type PaymentOrder } from "./model";
export type SnapCallbacks = { onSuccess: () => void; onPending: () => void; onError: () => void; onClose: () => void; language: "id" };
export type SnapClient = { pay: (token: string, callbacks: SnapCallbacks) => void; hide: () => void };
type State = { phase: "initial" | "loading" | "ready" | "creating" | "popup" | "reconciling"; order?: PaymentOrder; error?: unknown; actionError?: unknown; notice?: string; retryAt: number; needsRead: boolean };
type Dependencies = { orderId: string; request: typeof apiRequest; authorized: () => boolean; sdk: () => SnapClient | undefined; remember: () => void; now?: () => number };
const initial: State = { phase: "initial", retryAt: 0, needsRead: true };
/** Read-only status refresh. No auto-payment, auto-reconciliation or gateway polling. */
export function createPaymentController({ orderId, request, authorized, sdk, remember, now = Date.now }: Dependencies) {
  let state = initial, locked = false, disposed = false, popup: SnapClient | undefined;
  let generation = 0, read: AbortController | undefined;
  const listeners = new Set<() => void>();
  const commit = (value: State) => { if (!disposed) { state = value; listeners.forEach(listener => listener()); } };
  const enabled = () => !disposed && authorized();
  function verified(value: PaymentOrder) { if (value.id !== orderId) throw new ApiClientError(200, "INVALID_RESPONSE", "Periksa data pesanan terbaru.", "protocol"); return value; }
  async function refresh() {
    if (!enabled() || locked || popup || now() < state.retryAt) return;
    locked = true; const current = ++generation, controller = new AbortController(); read = controller;
    commit({ ...state, phase: "loading", needsRead: true, error: undefined });
    try { const { data } = await request(`/api/orders/${orderId}`, { decode: decodePaymentOrder, signal: controller.signal }); if (enabled() && current === generation) commit({ ...state, phase: "ready", order: verified(data), error: data.status === "AWAITING_PAYMENT" ? state.actionError : undefined, needsRead: false }); }
    catch (error) { if (enabled() && current === generation) commit({ ...state, phase: "ready", error, needsRead: true, retryAt: now() + (error instanceof ApiClientError ? error.retryAfterSeconds ?? 0 : 0) * 1000 }); }
    finally { if (current === generation) { locked = false; read = undefined; } }
  }
  async function pay() {
    if (!enabled() || locked || popup || state.needsRead || !state.order || !canRequestPayment(state.order, now()) || now() < state.retryAt) return;
    const client = sdk();
    if (!client) { commit({ ...state, error: new ApiClientError(0, "SNAP_NOT_READY", "Snap belum siap. Siapkan atau muat ulang halaman pembayaran.", "protocol") }); return; }
    try { remember(); } catch { commit({ ...state, error: new ApiClientError(0, "PAYMENT_CONTEXT_UNAVAILABLE", "Penyimpanan tab belum tersedia. Instruksi pembayaran belum diminta.", "protocol") }); return; }
    locked = true; let shouldRead = false;
    commit({ ...state, phase: "creating", error: undefined, actionError: undefined, notice: undefined });
    try {
      const { data } = await request(`/api/orders/${orderId}/payments`, { method: "POST", json: {}, decode: decodeInstruction });
      if (!enabled()) return;
      if (data.orderId !== orderId || state.order && Date.parse(data.expiresAt) !== Date.parse(state.order.paymentDeadline)) throw new ApiClientError(200, "INVALID_RESPONSE", "Instruksi atau tenggat belum sesuai pesanan. Periksa status terbaru.", "protocol");
      if (!data.snapToken || Date.parse(data.expiresAt) <= now() || !state.order || Date.parse(state.order.paymentDeadline) <= now()) {
        commit({ ...state, phase: "ready", needsRead: true, notice: "Instruksi belum siap atau masa berlakunya perlu diperiksa. Belum ada konfirmasi pembayaran." }); shouldRead = true; return;
      }
      let returned = false;
      const finish = () => {
        if (returned || !enabled()) return; returned = true; popup = undefined;
        try { client.hide(); } catch { /* never print SDK errors or callback payloads */ }
        commit({ ...state, phase: "ready", needsRead: true, notice: "Kembali dari Snap. Penutupan atau pesan di popup belum menjadi bukti pembayaran; status dibaca dari server." });
        // Handles a synchronous SDK test callback too: the create lock releases first.
        void Promise.resolve().then(refresh);
      };
      popup = client; commit({ ...state, phase: "popup", notice: data.reused ? "Membuka kembali instruksi Sandbox yang masih aktif." : "Instruksi Sandbox siap. Status pembayaran tetap mengikuti verifikasi server." });
      client.pay(data.snapToken, { onSuccess: finish, onPending: finish, onError: finish, onClose: finish, language: "id" });
    } catch (error) {
      if (enabled()) { const opened = popup; popup = undefined; try { opened?.hide(); } catch { /* SDK failure cannot change payment status */ } commit({ ...state, phase: "ready", needsRead: true, error, actionError: error, notice: "Hasil permintaan perlu diperiksa. Jangan menganggap pembayaran gagal atau membuat percobaan pengganti sebelum status server dibaca.", retryAt: now() + (error instanceof ApiClientError ? error.retryAfterSeconds ?? 0 : 0) * 1000 }); shouldRead = true; }
    } finally { locked = false; if (shouldRead && enabled()) void refresh(); }
  }
  async function reconcile() {
    if (!enabled() || locked || popup || state.needsRead || !state.order?.canReconcile || now() < state.retryAt) return;
    locked = true; commit({ ...state, phase: "reconciling", error: undefined, actionError: undefined, notice: undefined });
    try { const { data } = await request(`/api/orders/${orderId}/payments/reconcile`, { method: "POST", json: {}, decode: decodeReconciled }); if (enabled()) commit({ phase: "ready", order: verified(data.order), needsRead: false, retryAt: 0, notice: "Pemeriksaan pembayaran selesai; status di bawah berasal dari server." }); }
    catch (error) { if (enabled()) commit({ ...state, phase: "ready", needsRead: true, error, actionError: error, retryAt: now() + (error instanceof ApiClientError ? error.retryAfterSeconds ?? 0 : 0) * 1000, notice: "Pemeriksaan belum dapat dipastikan. Reservasi mengikuti keputusan server." }); }
    finally { locked = false; }
  }
  return { getSnapshot: () => state, getServerSnapshot: () => initial, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, refresh, pay, reconcile,
    activate() { disposed = false; }, dispose() { disposed = true; generation++; read?.abort(); read = undefined; locked = false; const active = popup; popup = undefined; try { active?.hide(); } catch { /* no SDK payload logging */ } } };
}
