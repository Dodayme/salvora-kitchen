"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { UserView } from "@/lib/contracts/user";
import { roleHome, safeReturnTo } from "@/lib/auth-client/model";
import { useSession } from "./session-provider";
import { LoadingState, ErrorState } from "@/components/shared/data-state";
import { Button } from "@/components/ui/button";

/** UI gate only. API/server authorization remains mandatory for every protected resource. */
export function RequireRole({ role, children }: { role: UserView["role"]; children: ReactNode }) {
  const { status, user, error, revision, store } = useSession();
  const pathname = usePathname(), router = useRouter();
  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?returnTo=${encodeURIComponent(safeReturnTo(pathname) ?? "/")}`);
  }, [status, pathname, router]);
  if (status === "checking" || status === "anonymous") return <div className="mx-auto max-w-xl px-5 py-16"><LoadingState label={status === "anonymous" ? "Mengalihkan ke halaman masuk…" : "Memeriksa sesi…"} /></div>;
  if (status === "error") return <div className="mx-auto max-w-xl px-5 py-16"><ErrorState title="Sesi belum dapat diperiksa" error={error} retry={() => void store.refresh()} /></div>;
  if (!user || user.role !== role) return <div className="mx-auto max-w-xl space-y-6 px-5 py-16 text-center"><p className="text-sm font-semibold text-primary">Akses terbatas · 403</p><h1 className="font-serif text-4xl font-bold">Halaman ini untuk {role === "ADMIN" ? "admin" : "pembeli"}.</h1><p className="text-muted-foreground">Gunakan halaman yang sesuai dengan peran akun Anda.</p><Button asChild><Link href={user ? roleHome(user.role) : "/"}>Kembali ke halaman saya</Link></Button></div>;
  // Remount private feature state when identity changes or the session is invalidated.
  return <div key={`${user.id}:${revision}`}>{children}</div>;
}
