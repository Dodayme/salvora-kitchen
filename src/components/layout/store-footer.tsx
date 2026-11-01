import Link from "next/link";
import { ArrowRight, MapPin, ShoppingBag, Truck } from "lucide-react";

const footerLink = "inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-primary hover:underline underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

export function StoreFooter() {
  return <footer className="border-t bg-card" aria-label="Informasi Salvora Kitchen">
    <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:grid-cols-2 sm:px-8 sm:py-16 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1.2fr] lg:gap-12 lg:px-12">
      <div>
        <Link href="/" className="inline-block rounded-sm font-serif text-3xl font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Salvora<span className="text-primary"> Kitchen</span></Link>
        <p className="mt-4 max-w-xs text-sm leading-7 text-muted-foreground">Camilan untuk teman cerita, suguhan istimewa, dan momen hangat bersama orang tersayang.</p>
        <p className="mt-5 flex items-center gap-2 text-xs font-medium"><MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" />Tanjungpinang, Kepulauan Riau</p>
      </div>
      <nav aria-label="Jelajahi toko">
        <h2 className="mb-3 font-semibold">Jelajahi</h2>
        <ul>{[{ href: "/", label: "Beranda" }, { href: "/menu", label: "Menu kami" }, { href: "/#tentang", label: "Tentang kami" }].map(item => <li key={item.href}><Link href={item.href} className={footerLink}>{item.label}</Link></li>)}</ul>
      </nav>
      <nav aria-label="Belanja dan pesanan">
        <h2 className="mb-3 font-semibold">Belanja Anda</h2>
        <ul>{[{ href: "/keranjang", label: "Keranjang" }, { href: "/pesanan", label: "Pesanan saya" }, { href: "/alamat", label: "Alamat saya" }, { href: "/akun", label: "Akun saya" }].map(item => <li key={item.href}><Link href={item.href} className={footerLink}>{item.label}</Link></li>)}</ul>
      </nav>
      <div>
        <h2 className="mb-5 font-semibold">Pesan sesuai cara Anda</h2>
        <div className="space-y-5">
          <div className="flex items-start gap-3"><Truck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="text-sm font-medium">Diantar ke rumah</p><p className="mt-1 text-xs leading-6 text-muted-foreground">Kota Tanjungpinang · Rp10.000 per pesanan.</p></div></div>
          <div className="flex items-start gap-3"><ShoppingBag aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="text-sm font-medium">Ambil sendiri, gratis</p><p className="mt-1 text-xs leading-6 text-muted-foreground">Datang setelah pesanan berstatus Siap diambil.</p></div></div>
        </div>
        <Link href="/menu" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-secondary px-5 text-sm font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Pilih camilan<ArrowRight aria-hidden="true" className="size-4" /></Link>
      </div>
    </div>
    <div className="border-t bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs leading-6 text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><p>© {new Date().getFullYear()} Salvora Kitchen.</p><p>Dari dapur kami, untuk momen hangat Anda.</p></div>
    </div>
  </footer>;
}
