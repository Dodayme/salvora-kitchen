"use client";

import { useSession } from "./session-provider";
import { StatusBadge } from "@/components/shared/status-badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export function AccountSummary({ title }: { title?: string } = {}) {
  const { status, user } = useSession();
  if (status !== "authenticated" || !user) return null;
  return <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16"><StatusBadge label={user.role === "ADMIN" ? "Admin" : "Pembeli"} tone="info" /><h1 className="mt-5 font-serif text-4xl font-bold sm:text-5xl">{title ?? (user.role === "ADMIN" ? "Area administrasi" : "Akun saya")}</h1><p className="mt-4 break-words text-muted-foreground">Selamat datang, {user.name}.</p><dl className="mt-8 divide-y rounded-2xl border bg-card px-6 shadow-soft"><div className="space-y-2 py-5"><dt className="text-sm text-muted-foreground">Nama lengkap</dt><dd className="break-words font-medium">{user.name}</dd></div><div className="space-y-2 py-5"><dt className="text-sm text-muted-foreground">Email</dt><dd className="break-all font-medium">{user.email}</dd></div><div className="space-y-2 py-5"><dt className="text-sm text-muted-foreground">Peran akun</dt><dd className="font-medium">{user.role === "ADMIN" ? "Admin" : "Pembeli"}</dd></div></dl>{user.role === "BUYER" && <div className="mt-6 flex flex-wrap gap-3"><Button asChild variant="outline"><Link href="/pesanan">Pesanan saya</Link></Button><Button asChild variant="outline"><Link href="/alamat">Kelola alamat</Link></Button><Button asChild><Link href="/keranjang">Lihat keranjang</Link></Button></div>}</section>;
}
