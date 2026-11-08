"use client";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Tag } from "lucide-react";
import { decodeCategories, decodeProducts, catalogQuery, catalogHref } from "@/lib/catalog-client/model";
import { usePublicRead } from "./use-public-read";
import { ProductCard } from "./product-card";
import { Button } from "@/components/ui/button";
import { PageNav } from "@/components/shared/page-nav";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/data-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { PublicShell } from "@/components/layout/public-shell";

import { EventPromotions } from "./event-promotions";
import { KitchenStory } from "./kitchen-story";

const wrap = "mx-auto max-w-7xl px-5 sm:px-8 lg:px-12";
export function StoreHero({ menu = false }: { menu?: boolean }) {
  return <section className="relative bg-foreground text-white"><Image src="/images/salvora-hero.png" alt="Risol dan cookies di atas meja kayu" width={1440} height={552} sizes="100vw" preload className="h-auto w-full" /><div className="px-5 py-9 sm:px-8 md:absolute md:inset-y-0 md:flex md:w-[52%] md:flex-col md:justify-center md:py-6 lg:pl-16 xl:pl-20"><h1 className="max-w-xl font-serif text-4xl leading-tight font-bold lg:text-5xl xl:text-[64px]">{menu ? "Menu Kami" : <>Jajanan Lezat dari <span className="text-brand">Dapur Kami</span></>}</h1><p className="mt-4 max-w-md text-sm leading-relaxed lg:text-lg">{menu ? "Temukan pilihan camilan untuk menemani hari Anda." : "Dari risol hingga cookies, temukan camilan untuk menemani momen hangat Anda."}</p>{!menu && <div className="mt-6"><Button asChild size="lg"><Link href="/menu">Lihat menu<ArrowRight aria-hidden="true" /></Link></Button></div>}</div></section>;
}
function FeaturedCategories() {
  const { state, reload } = usePublicRead("/api/categories?page=1&pageSize=4", decodeCategories, true);
  return <section className={`${wrap} py-12 sm:py-16`} aria-labelledby="categories-heading"><p className="text-sm font-semibold text-primary">Menu pilihan</p><div className="mt-3 flex flex-wrap items-center justify-between gap-5"><h2 id="categories-heading" className="font-serif text-4xl font-bold sm:text-5xl">Beragam Camilan Favorit Kami</h2><Button asChild variant="outline"><Link href="/menu">Semua menu<ArrowRight aria-hidden="true" /></Link></Button></div><div className="mt-8">{state.status === "loading" ? <LoadingState label="Memuat kategori…" /> : state.status === "error" ? <ErrorState error={state.error} retry={reload} /> : !state.result.data.length ? <EmptyState title="Kategori belum tersedia" /> : <div className="grid gap-5 sm:grid-cols-2">{state.result.data.map(category => <Link key={category.id} href={catalogHref(1, category.id)} className="group min-w-0 rounded-2xl border bg-secondary p-6 shadow-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-8"><div className="flex flex-wrap items-center gap-3"><h3 className="max-w-full font-serif text-3xl font-bold [overflow-wrap:anywhere]">{category.name}</h3>{category.isDemo && <StatusBadge label="Data demo" />}</div><p className="mt-3 text-sm text-muted-foreground">{category.productCount} produk aktif</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 group-hover:underline">Lihat menu<ArrowRight aria-hidden="true" className="size-4" /></span></Link>)}</div>}</div></section>;
}
function FeaturedProducts() {
  const { state, reload } = usePublicRead("/api/products?page=1&pageSize=4", decodeProducts, true);
  return <section className="bg-secondary/50 py-12 sm:py-16"><div className={wrap}><p className="text-sm font-semibold text-primary">Pilihan kami</p><div className="mt-3 flex flex-wrap items-center justify-between gap-5"><h2 className="font-serif text-4xl font-bold sm:text-5xl">Camilan untuk Momen Anda</h2><Button asChild variant="outline"><Link href="/menu">Lihat semua produk<ArrowRight aria-hidden="true" /></Link></Button></div><div className="mt-8">{state.status === "loading" ? <LoadingState label="Memuat produk…" /> : state.status === "error" ? <ErrorState error={state.error} retry={reload} /> : !state.result.data.length ? <EmptyState title="Produk belum tersedia" /> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{state.result.data.map(product => <ProductCard key={product.id} product={product} reload={reload} />)}</div>}</div></div></section>;
}
export function StoreHome() {
  return <PublicShell><StoreHero /><EventPromotions /><section className={`${wrap} py-8`} aria-label="Ketentuan voucher pembeli baru"><div className="flex flex-col gap-5 rounded-2xl bg-brand px-6 py-7 text-brand-foreground sm:flex-row sm:items-center sm:justify-between sm:px-9"><div><p className="flex items-center gap-2 text-sm font-semibold"><Tag aria-hidden="true" className="size-4" />Voucher pembeli baru</p><h2 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">Diskon 20%, maksimal Rp100.000</h2><p className="mt-2 text-sm leading-relaxed">Sekali pakai untuk pembeli baru yang memenuhi syarat. Diskon tidak termasuk ongkir.</p></div><Button asChild variant="secondary"><Link href="/menu">Pilih camilan<ArrowRight aria-hidden="true" /></Link></Button></div></section><FeaturedCategories /><FeaturedProducts /><KitchenStory /></PublicShell>;
}
function CatalogCategories({ selected }: { selected?: string }) {
  const [page, setPage] = useState(1);
  const { state, reload } = usePublicRead(`/api/categories?page=${page}&pageSize=8`, decodeCategories, true);
  return <section aria-label="Filter kategori" className="space-y-4"><div className="flex flex-wrap gap-3"><Button asChild variant={!selected ? "default" : "outline"}><Link href="/menu" scroll={false} aria-current={!selected ? "page" : undefined}>Semua</Link></Button>{state.status === "ready" && state.result.data.map(category => <Button key={category.id} asChild className="h-auto min-h-11 max-w-full whitespace-normal text-left" variant={selected === category.id ? "default" : "outline"}><Link href={catalogHref(1, category.id)} scroll={false} aria-current={selected === category.id ? "page" : undefined}><span className="min-w-0 [overflow-wrap:anywhere]">{category.name}{category.isDemo && <span className="ml-1 text-xs">(demo)</span>}</span></Link></Button>)}</div>{state.status === "loading" ? <p role="status" className="text-sm text-muted-foreground">Memuat kategori…</p> : state.status === "error" ? <ErrorState title="Kategori belum dapat dimuat" error={state.error} retry={reload} /> : state.result.meta.pagination!.totalPages > 1 && <div className="flex flex-wrap gap-3"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Kategori sebelumnya</Button><Button variant="ghost" disabled={page >= state.result.meta.pagination!.totalPages} onClick={() => setPage(value => value + 1)}>Kategori berikutnya</Button></div>}</section>;
}
function CatalogResults({ page, categoryId }: { page: number; categoryId?: string }) {
  const router = useRouter();
  const query = new URLSearchParams({ page: String(page), pageSize: "9", ...(categoryId ? { categoryId } : {}) });
  const { state, reload } = usePublicRead(`/api/products?${query}`, decodeProducts, true);
  return <section aria-labelledby="product-list-heading" className="mt-9 space-y-8"><h2 id="product-list-heading" className="sr-only">Daftar produk</h2>{state.status === "loading" ? <LoadingState label="Memuat daftar produk…" /> : state.status === "error" ? <ErrorState error={state.error} retry={reload} /> : <><p role="status" className="text-sm text-muted-foreground">{state.result.meta.pagination!.total} produk{categoryId ? " pada kategori terpilih" : " tersedia di katalog"}.</p>{state.result.data.length ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{state.result.data.map(product => <ProductCard key={product.id} product={product} reload={reload} />)}</div> : <EmptyState title="Tidak ada produk pada halaman ini" description="Coba kategori lain atau kembali ke halaman pertama." />}{(page > 1 || state.result.meta.pagination!.totalPages > 1) && <PageNav page={page} totalPages={state.result.meta.pagination!.totalPages} onPageChange={value => router.push(catalogHref(value, categoryId), { scroll: false })} />}{page > 1 && !state.result.data.length && <Button asChild variant="outline"><Link href={catalogHref(1, categoryId)}>Kembali ke halaman pertama</Link></Button>}</>}</section>;
}
export function StoreCatalog() {
  const params = useSearchParams(), query = catalogQuery(new URLSearchParams(params));
  return <PublicShell><StoreHero menu /><EventPromotions /><div className={`${wrap} py-10 sm:py-14`}>{!query ? <div className="space-y-5"><ErrorState title="Filter katalog tidak valid" /><Button asChild><Link href="/menu">Reset filter</Link></Button></div> : <><CatalogCategories selected={query.categoryId} /><CatalogResults {...query} /></>}</div></PublicShell>;
}
