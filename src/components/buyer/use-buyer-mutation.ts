"use client";
import { useEffect, useRef, useState } from "react";
import { useAccountRequest, useSession } from "@/components/auth/session-provider";
import { ApiClientError } from "@/lib/http/client";
import { mutationRecovery } from "@/lib/buyer-client/model";
/** No retry/replay. Uncertain writes require a fresh read and an explicit new decision. */
export function useBuyerMutation() {
  const request = useAccountRequest(), { store } = useSession();
  const lock = useRef(false), alive = useRef(true);
  const [pending, setPending] = useState(false), [error, setError] = useState<unknown>();
  const [blocked, setBlocked] = useState(false), [wait, setWait] = useState(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (!wait) return; const timer = setTimeout(() => setWait(value => Math.max(0, value - 1)), 1000); return () => clearTimeout(timer); }, [wait]);
  async function run(operation: (client: typeof request) => Promise<unknown>, success: () => void) {
    const principal = store.getSnapshot();
    if (lock.current || blocked || wait > 0 || principal.status !== "authenticated" || principal.user?.role !== "BUYER") return;
    const owner = principal.user.id;
    lock.current = true; setPending(true); setError(undefined);
    try { await operation(request); if (alive.current && store.getSnapshot().user?.id === owner) success(); }
    catch (failure) {
      if (alive.current && store.getSnapshot().user?.id === owner) {
        setError(failure); setBlocked(mutationRecovery(failure) !== "retry");
        if (failure instanceof ApiClientError) setWait(failure.retryAfterSeconds ?? 0);
      }
    } finally { lock.current = false; if (alive.current) setPending(false); }
  }
  return { run, pending, error, blocked, wait, disabled: pending || blocked || wait > 0 };
}
