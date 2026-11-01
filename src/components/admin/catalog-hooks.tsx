"use client";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAccountRequest, useSession } from "@/components/auth/session-provider";
import { ApiClientError, type ApiResult } from "@/lib/http/client";
import { createAdminAction, createModalControls } from "@/lib/admin-client/action-controller";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/shared/data-state";
import { Button } from "@/components/ui/button";
type State<T> = { key: string; status: "ready"; result: ApiResult<T> } | { key: string; status: "error"; error: unknown };
export function useAdminRead<T>(path: string | null, decode: (value: unknown) => T, paging = false) {
  const { user, status, revision } = useSession(), request = useAccountRequest();
  const [reloadId, setReloadId] = useState(0), [state, setState] = useState<State<T>>();
  const enabled = status === "authenticated" && user?.role === "ADMIN" && path !== null, key = `${enabled ? user!.id : "none"}:${revision}:${path}:${reloadId}`;
  useEffect(() => {
    if (!enabled || !path) return; const controller = new AbortController(); let active = true;
    void request(path, { decode, signal: controller.signal }).then(result => { if (paging && !result.meta.pagination) throw new ApiClientError(200, "INVALID_RESPONSE", "Pagination belum tersedia. Muat ulang.", "protocol"); if (active) setState({ key, status: "ready", result }); }).catch(error => { if (active) setState({ key, status: "error", error }); });
    return () => { active = false; controller.abort(); };
  }, [enabled, key, path, decode, paging, request]);
  return { state: enabled && state?.key === key ? state : { status: "loading" as const }, reload: () => setReloadId(value => value + 1) };
}
export type ModalControls = { close: () => void; canStart: () => boolean; pending: (value: boolean) => void };
export function CatalogModal({ title, description, close, children }: { title: string; description: string; close: () => void; children: (controls: ModalControls) => ReactNode }) {
  const [controls] = useState(() => createModalControls(close));
  return <Dialog open onOpenChange={open => { if (!open) controls.close(); }}><DialogContent className="sm:max-w-3xl" onPointerDownOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (!controls.canStart()) event.preventDefault(); }}><DialogHeader><DialogTitle className="font-serif text-3xl">{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{children(controls)}</DialogContent></Dialog>;
}
export function useAdminAction(controls: ModalControls) {
  const { user, store } = useSession(), request = useAccountRequest();
  const [controller] = useState(() => createAdminAction({ request, authorized: () => { const value = store.getSnapshot(); return value.status === "authenticated" && value.user?.id === user!.id && value.user.role === "ADMIN"; }, canStart: controls.canStart, pending: controls.pending }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot), [clock, setClock] = useState(Date.now);
  useEffect(() => { controller.activate(); return controller.dispose; }, [controller]);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const wait = Math.max(0, Math.ceil((state.retryAt - clock) / 1000));
  return { ...state, controller, wait, disabled: state.phase !== "editing" || wait > 0, run: controller.run };
}
export function ActionFeedback({ action, reload }: { action: ReturnType<typeof useAdminAction>; reload?: () => void }) {
  return <>{!!action.error && <ErrorState error={action.error} />}{action.wait > 0 && <p role="status" className="text-sm">Tunggu {action.wait} detik.</p>}{action.phase === "needsReload" && <div role="alert" className="space-y-3 text-sm"><p>Data berubah atau hasil tindakan belum pasti. Periksa data terbaru sebelum mengulangi; tindakan sebelumnya mungkin sudah tersimpan.</p>{reload && <Button type="button" variant="outline" disabled={action.wait > 0} onClick={reload}>Periksa data terbaru</Button>}</div>}</>;
}
