"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useSession } from "@/components/auth/session-provider";
import { createPaymentReturn } from "@/lib/payment-client/return-context";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/data-state";
import { PaymentScreen } from "./payment-screen";
const initial: { status: "initial" | "missing" | "invalid" | "ready"; orderId?: string } = { status: "initial" };
function RecoverOrder({ ownerId }: { ownerId: string }) {
  const [reader] = useState(() => {
    let snapshot = initial; const listeners = new Set<() => void>();
    return { getSnapshot: () => snapshot, getServerSnapshot: () => initial, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, hydrate() { try { const orderId = createPaymentReturn(() => window.sessionStorage).load(ownerId); snapshot = orderId ? { status: "ready", orderId } : { status: "missing" }; } catch { snapshot = { status: "invalid" }; } listeners.forEach(listener => listener()); } };
  });
  const value = useSyncExternalStore(reader.subscribe, reader.getSnapshot, reader.getServerSnapshot);
  useEffect(() => { reader.hydrate(); }, [reader]);
  if (value.status === "initial") return <div className="mx-auto max-w-xl p-5"><LoadingState label="Memeriksa konteks tab…" /></div>;
  return value.status === "ready" && value.orderId ? <PaymentScreen orderId={value.orderId} /> : <p className="mx-auto max-w-xl p-5 text-sm">{value.status === "invalid" ? "Konteks tab tidak dapat dibaca." : "Referensi pesanan tidak tersedia pada tab ini."} Buka kembali halaman pembayaran dari pesanan Anda. Parameter redirect tidak digunakan untuk memilih atau melunaskan pesanan.</p>;
}
export function FinishContent() {
  const { status, user, revision, store } = useSession();
  if (status === "checking") return <div className="mx-auto max-w-xl p-5"><LoadingState label="Memeriksa sesi…" /></div>;
  if (status === "error") return <div className="mx-auto max-w-xl p-5"><Button variant="outline" onClick={() => void store.refresh()}>Periksa sesi</Button></div>;
  if (status === "anonymous") return <div className="mx-auto max-w-xl p-5"><Button asChild><Link href="/login?returnTo=%2Fpayment%2Ffinish">Masuk untuk memeriksa pesanan</Link></Button></div>;
  if (user?.role !== "BUYER") return <p className="mx-auto max-w-xl p-5">Pembayaran pembeli tidak tersedia pada akun admin.</p>;
  return <RecoverOrder key={`${user.id}:${revision}`} ownerId={user.id} />;
}
