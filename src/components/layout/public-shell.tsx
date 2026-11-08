"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AccountMenu } from "@/components/auth/account-menu";
import { CartLink } from "@/components/buyer/cart-link";
import { StoreFooter } from "./store-footer";

type NavigationItem = { href: string; label: string };
const home: NavigationItem[] = [{ href: "/", label: "Beranda" }, { href: "/menu", label: "Menu" }, { href: "/#tentang", label: "Tentang kami" }];
const linkStyle = "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

/** Accept only navigation for implemented pages. */
export function PublicShell({ children, navigation = home }: { children: ReactNode; navigation?: NavigationItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let previous = Math.max(0, window.scrollY);
    const onScroll = () => {
      const current = Math.max(0, window.scrollY);
      if (current <= 24) {
        setHidden(false);
        previous = current;
      } else if (Math.abs(current - previous) >= 8) {
        setHidden(current < previous);
        previous = current;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <div className="flex min-h-dvh flex-col">
    <a href="#main-content" className="sr-only z-[60] rounded-full bg-primary px-5 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Lewati ke konten utama</a>
    <header className={`sticky top-0 z-40 border-b bg-background shadow-sm transition-transform duration-200 motion-reduce:transition-none focus-within:translate-y-0 ${hidden && !open ? "-translate-y-full" : "translate-y-0"}`}>
      <div className="mx-auto flex min-h-24 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="Salvora Kitchen, beranda" className="min-w-0 rounded-sm font-serif text-2xl font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:text-4xl">Salvora<span className="text-primary"> Kitchen</span></Link>
        <div className="hidden items-center gap-3 lg:flex"><nav aria-label="Navigasi utama" className="flex items-center gap-2">{navigation.map(item => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={`${linkStyle} ${pathname === item.href ? "bg-secondary text-primary" : ""}`}>{item.label}</Link>)}</nav><CartLink /><AccountMenu /></div>
        <div className="flex shrink-0 items-center gap-2 lg:hidden"><CartLink compact />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild><Button variant="outline" size="icon" className="lg:hidden" aria-label="Buka menu navigasi"><Menu aria-hidden="true" /></Button></SheetTrigger>
          <SheetContent className="overflow-y-auto">
            <SheetHeader className="pt-16"><SheetTitle className="font-serif text-3xl">Salvora Kitchen</SheetTitle><SheetDescription>Menu navigasi toko.</SheetDescription></SheetHeader>
            <nav aria-label="Navigasi ponsel" className="flex flex-col gap-2 px-4">{navigation.map(item => <SheetClose key={item.href} asChild><Link href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={linkStyle}>{item.label}</Link></SheetClose>)}</nav>
            <div className="border-t px-4 pt-5"><CartLink onNavigate={() => setOpen(false)} /><AccountMenu onNavigate={() => setOpen(false)} /></div>
          </SheetContent>
        </Sheet>
        </div>
      </div>
    </header>
    <main id="main-content" tabIndex={-1} className="flex-1 outline-none">{children}</main>
    <StoreFooter />
  </div>;
}
