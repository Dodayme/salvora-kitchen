"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { createSessionStore, type SessionStore } from "@/lib/auth-client/session-store";
import { apiRequest } from "@/lib/http/client";
import { clearCheckoutRecovery } from "@/lib/checkout-client/recovery";

const SessionContext = createContext<SessionStore | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createSessionStore(apiRequest));
  const pathname = usePathname();
  useEffect(() => { void store.refresh(); return store.cancel; }, [pathname, store]);
  useEffect(() => {
    // Only a constant invalidation signal crosses tabs. No account, credential or token storage.
    let broadcast: BroadcastChannel | undefined;
    if ("BroadcastChannel" in window) {
      broadcast = new BroadcastChannel("salvora-session");
      broadcast.onmessage = event => { if (event.data === "changing" || event.data === "changed") { clearCheckoutRecovery(); store.suspend(); if (event.data === "changed" && document.visibilityState === "visible") void store.refresh(); } };
    }
    store.setNotifier(event => { clearCheckoutRecovery(); broadcast?.postMessage(event); });
    const unsubscribe = store.subscribe(() => { if (store.getSnapshot().status === "anonymous") clearCheckoutRecovery(); });
    const check = () => { if (document.visibilityState === "visible") void store.refresh(); };
    // Returning focus to an already-visible tab must not discard an unchanged account's draft.
    // Cross-tab identity changes still suspend immediately; routine visibility checks preserve drafts.
    const focusCheck = () => { if (document.visibilityState === "visible") void store.refresh(true); };
    const visibility = () => { if (document.visibilityState === "visible") void store.refresh(true); };
    window.addEventListener("focus", focusCheck); window.addEventListener("pageshow", check); document.addEventListener("visibilitychange", visibility);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void store.refresh(true); }, 60_000);
    return () => { unsubscribe(); clearInterval(timer); window.removeEventListener("focus", focusCheck); window.removeEventListener("pageshow", check); document.removeEventListener("visibilitychange", visibility); store.setNotifier(() => {}); broadcast?.close(); };
  }, [store]);
  return <SessionContext.Provider value={store}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const store = useContext(SessionContext);
  if (!store) throw Error("SessionProvider is required");
  const session = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ...session, store };
}
/** Private feature requests must use this hook so 401 clears account state immediately. */
export function useAccountRequest() {
  const { store } = useSession();
  return store.accountRequest;
}
