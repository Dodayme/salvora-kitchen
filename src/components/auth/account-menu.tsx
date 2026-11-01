"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, UserRound, ShieldCheck } from "lucide-react";
import { useSession } from "./session-provider";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { authErrorMessage } from "@/lib/auth-client/model";

export function AccountMenu({ onNavigate, hideAccountLink = false }: { onNavigate?: () => void; hideAccountLink?: boolean }) {
  const { status, user, store } = useSession();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string>();
  async function logout() {
    if (pending) return;
    setPending(true); setFailure(undefined);
    try { await store.logout(); onNavigate?.(); router.replace("/"); router.refresh(); }
    catch (error) { setFailure(authErrorMessage(error)); }
    finally { setPending(false); }
  }
  return <div className="flex flex-wrap items-center gap-2">
    {status === "checking" && <p role="status" className="px-3 text-sm text-muted-foreground">Memeriksa sesi…</p>}
    {status === "anonymous" && <><Button asChild variant="ghost"><Link href="/login" onClick={onNavigate}>Masuk</Link></Button><Button asChild><Link href="/register" onClick={onNavigate}>Daftar</Link></Button></>}
    {status === "authenticated" && user && <>{!hideAccountLink && <Button asChild variant="secondary"><Link href={user.role === "ADMIN" ? "/admin" : "/akun"} onClick={onNavigate}>{user.role === "ADMIN" ? <ShieldCheck aria-hidden="true" /> : <UserRound aria-hidden="true" />}{user.role === "ADMIN" ? "Area admin" : "Akun saya"}</Link></Button>}<ActionButton variant="ghost" pending={pending} onClick={logout}><LogOut aria-hidden="true" />Keluar</ActionButton></>}
    {status === "error" && <div className="space-y-2"><p role="alert" className="max-w-xs text-sm text-destructive">{failure ?? "Sesi belum terkonfirmasi. Periksa sebelum melanjutkan."}</p><Button variant="outline" onClick={() => void store.refresh()}>Periksa sesi</Button></div>}
  </div>;
}
