"use client";
import { useEffect, useState } from "react";
import { useAccountRequest, useSession } from "@/components/auth/session-provider";
import { ApiClientError, type ApiResult } from "@/lib/http/client";
type State<T> = { key: string; scope: string; status: "ready"; result: ApiResult<T> } | { key: string; scope: string; status: "error"; error: unknown; previous?: ApiResult<T> };
export const cartChanged = () => { window.dispatchEvent(new Event("salvora-cart-changed")); if ("BroadcastChannel" in window) { const channel = new BroadcastChannel("salvora-cart"); channel.postMessage("changed"); channel.close(); } };
export function useBuyerRead<T>(path: string, decode: (value: unknown) => T, paging = false) {
  const { user, status, revision: sessionRevision } = useSession(), request = useAccountRequest();
  const [revision, setRevision] = useState(0), [state, setState] = useState<State<T>>();
  const enabled = status === "authenticated" && user?.role === "BUYER";
  const scope = `${enabled ? user.id : "none"}:${sessionRevision}:${path}`;
  const key = `${scope}:${revision}`;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController(); let active = true;
    void request(path, { decode, signal: controller.signal }).then(result => {
      if (paging && !result.meta.pagination) throw new ApiClientError(200, "INVALID_RESPONSE", "Pagination belum tersedia. Muat ulang daftar.", "protocol");
      if (active) setState({ key, scope, status: "ready", result });
    }).catch(error => { if (active) setState(previous => ({ key, scope, status: "error", error, previous: previous?.scope === scope ? previous.status === "ready" ? previous.result : previous.previous : undefined })); });
    return () => { active = false; controller.abort(); };
  }, [enabled, key, scope, path, decode, paging, request]);
  useEffect(() => {
    if (path !== "/api/cart") return;
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("salvora-cart-changed", refresh);
    const channel = "BroadcastChannel" in window ? new BroadcastChannel("salvora-cart") : undefined;
    if (channel) channel.onmessage = event => { if (event.data === "changed") refresh(); };
    return () => { window.removeEventListener("salvora-cart-changed", refresh); channel?.close(); };
  }, [path]);
  return { state: enabled && state?.key === key ? state : { status: "loading" as const }, reload: () => setRevision(value => value + 1) };
}
