"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useBuyerRead } from "@/components/buyer/use-buyer-read";
import { formatRupiah, formatTimestamp } from "@/lib/format";
export const decodeEventPromotions = (value: unknown) => z.array(z.object({ id: z.string(), name: z.string(), percentage: z.number(), maxDiscount: z.number(), endsAt: z.string(), photoId: z.string().nullable() })).parse(value);
export function EventPromotions() {
 const { state, reload } = useBuyerRead("/api/me/promotions", decodeEventPromotions);
 const [now, setNow] = useState(Date.now);
 useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
 useEffect(() => { const refresh = () => reload(); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, [reload]);
 if (state.status !== "ready") return null;
 const promotions = state.result.data.filter(p => Date.parse(p.endsAt) > now);
 if (!promotions.length) return null;
 return <section aria-label="Banner promo diskon" className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-12"><div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-3">{promotions.map(p => <article key={p.id} className="relative isolate min-w-0 shrink-0 basis-full snap-center overflow-hidden rounded-3xl bg-[#432719] text-white shadow-lg">
 {p.photoId && <Image src={`/api/product-photos/${p.photoId}`} alt={`Banner ${p.name}`} fill unoptimized sizes="100vw" className="-z-20 object-cover" />}
 <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/60 to-black/10" />
 <div className="max-w-2xl space-y-4 px-7 py-10 sm:px-12 sm:py-14"><p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200">Promo spesial untuk Anda</p><h2 className="font-serif text-3xl font-bold sm:text-4xl">{p.name}</h2><p className="text-5xl font-extrabold tracking-tight sm:text-7xl">Diskon {p.percentage}%</p><p className="text-lg">Hemat hingga {formatRupiah(p.maxDiscount)}</p><Link href="/menu" className="inline-flex min-h-12 items-center rounded-full bg-white px-7 font-bold text-[#432719] transition-colors hover:bg-amber-100">Belanja sekarang</Link><p className="text-xs leading-relaxed text-white/80">Berlaku sampai {formatTimestamp(p.endsAt)} WIB. Bisa digunakan berulang. Diskon terbaik otomatis diterapkan saat checkout.</p></div>
 </article>)}</div>{promotions.length > 1 && <p className="mt-2 text-center text-sm text-muted-foreground">Geser untuk melihat {promotions.length} promo yang tersedia</p>}</section>;
}
