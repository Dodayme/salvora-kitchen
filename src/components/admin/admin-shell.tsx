"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CreditCard, LayoutDashboard, Menu, Package, ShoppingBag, Tags, Ticket, UserRound } from "lucide-react";
import { useSession } from "@/components/auth/session-provider";
import { AccountMenu } from "@/components/auth/account-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
const items = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, available: true },
  { label: "Produk", href: "/admin/produk", icon: Package, available: true },
  { label: "Kategori", href: "/admin/kategori", icon: Tags, available: true },
  { label: "Pesanan", href: "/admin/pesanan", icon: ShoppingBag, available: true },
  { label: "Pembayaran", href: "/admin/pembayaran", icon: CreditCard, available: true },
  { label: "Promosi Event", href: "/admin/promosi", icon: Ticket, available: true },
  { label: "Voucher Pembeli Baru", href: "/admin/voucher", icon: Ticket, available: true },
  { label: "Akun Saya", href: "/admin/akun", icon: UserRound, available: true },
];
function AdminNav({ close }: { close?: () => void }) {
  const pathname = usePathname();
  return <nav aria-label="Navigasi admin" className="space-y-2">{items.map(item => { const Icon = item.icon; const active = pathname === item.href || item.href !== "/admin" && pathname.startsWith(`${item.href}/`); return item.available ? <Link key={item.href} href={item.href} onClick={close} aria-current={active ? "page" : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring ${active ? "bg-brand/20 text-foreground shadow-soft" : "hover:bg-secondary"}`}><Icon aria-hidden="true" className="size-5 shrink-0" />{item.label}</Link> : <div key={item.href} aria-disabled="true" className="flex min-h-12 items-start gap-3 rounded-xl px-4 py-3 text-sm text-muted-foreground"><Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" /><span>{item.label}<span className="mt-1 block text-xs font-normal">Belum tersedia</span></span></div>; })}</nav>;
}
export function AdminShell({ children }: { children: ReactNode }) {
  const { user } = useSession(), [open, setOpen] = useState(false);
  return <div className="flex min-h-dvh bg-secondary/70"><a href="#admin-main" className="sr-only z-[60] rounded-full bg-primary px-5 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Lewati ke konten admin</a><aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r bg-background p-5 lg:flex"><Link href="/admin" className="mb-8 rounded-lg font-serif text-3xl font-bold text-primary focus-visible:outline-2 focus-visible:outline-ring">Salvora Kitchen<span className="mt-1 block font-sans text-xs font-normal text-muted-foreground">Administrasi toko</span></Link><AdminNav /><div className="mt-auto border-t pt-5"><AccountMenu hideAccountLink /></div></aside><div className="min-w-0 flex-1"><header className="flex min-h-20 items-center justify-between gap-4 border-b bg-background px-5 sm:px-8"><div className="flex min-w-0 items-center gap-3"><Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="outline" size="icon" className="lg:hidden" aria-label="Buka navigasi admin"><Menu aria-hidden="true" /></Button></SheetTrigger><SheetContent side="left" className="overflow-y-auto"><SheetHeader className="pt-12"><SheetTitle className="font-serif text-3xl">Salvora Kitchen</SheetTitle><SheetDescription>Administrasi toko</SheetDescription></SheetHeader><div className="space-y-6 px-4"><AdminNav close={() => setOpen(false)} /><div className="border-t pt-5"><AccountMenu hideAccountLink onNavigate={() => setOpen(false)} /></div></div></SheetContent></Sheet><p className="font-serif text-2xl font-bold lg:hidden">Salvora Kitchen</p><p className="hidden text-sm text-muted-foreground lg:block">Administrasi Salvora Kitchen</p></div><Link href="/admin/akun" className="flex min-h-11 min-w-0 items-center gap-2 rounded-full border border-brand/40 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"><UserRound aria-hidden="true" className="size-5 shrink-0" /><span className="max-w-24 truncate sm:max-w-48">{user?.name ?? "Admin"}</span></Link></header><main id="admin-main" tabIndex={-1} className="outline-none">{children}</main></div></div>;
}
