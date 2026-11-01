import { apiRequest, ApiClientError } from "@/lib/http/client";
import { dashboardPath, dashboardRange, decodeDashboard, todayWib, type Dashboard, type DashboardRange } from "./dashboard-model";
type State = { phase: "initial" | "loading" | "ready" | "error"; range?: DashboardRange; report?: Dashboard; error?: unknown; invalid?: string };
const initial: State = { phase: "initial" };
type Dependencies = { request: typeof apiRequest; authorized: () => boolean; now?: () => Date };
export function createDashboardController({ request, authorized, now = () => new Date() }: Dependencies) {
  let state = initial, generation = 0, disposed = false, active: AbortController | undefined; const listeners = new Set<() => void>();
  const commit = (value: State) => { if (!disposed) { state = value; listeners.forEach(listener => listener()); } };
  async function apply(fromDate: string, toDate: string) {
    if (disposed || !authorized()) return;
    const range = dashboardRange(fromDate, toDate);
    if (!range) { commit({ ...state, invalid: "Isi kedua tanggal yang valid; tanggal awal tidak boleh setelah tanggal akhir. Periode yang ditampilkan belum diubah." }); return; }
    const current = ++generation; active?.abort(); const controller = new AbortController(); active = controller;
    commit({ phase: "loading", range });
    try {
      const { data } = await request(dashboardPath(range), { decode: decodeDashboard, signal: controller.signal });
      if (disposed || !authorized() || current !== generation) return;
      if (Date.parse(data.period.from) !== Date.parse(range.from) || Date.parse(data.period.to) !== Date.parse(range.to)) throw new ApiClientError(200, "INVALID_RESPONSE", "Periode respons belum sesuai pilihan. Muat ulang dashboard.", "protocol");
      commit({ phase: "ready", range, report: data });
    } catch (error) { if (!disposed && authorized() && current === generation) commit({ phase: "error", range, error }); }
    finally { if (current === generation) active = undefined; }
  }
  function refresh() { if (state.range) return apply(state.range.fromDate, state.range.toDate); }
  return { getSnapshot: () => state, getServerSnapshot: () => initial, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, apply, refresh,
    initialize() { if (state.range) return refresh(); const today = todayWib(now()); return apply(today, today); },
    activate() { disposed = false; }, dispose() { disposed = true; generation++; active?.abort(); active = undefined; } };
}
