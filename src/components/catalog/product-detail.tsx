"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowLeft } from "lucide-react";
import { decodeProduct } from "@/lib/catalog-client/model";
import { ApiClientError } from "@/lib/http/client";
import { formatRupiah, formatTimestamp } from "@/lib/format";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/data-state";
import { createReviewFeed } from "@/lib/catalog-client/review-feed";
import { usePublicRead } from "./use-public-read";
import { ProductPhoto } from "./product-photo";
import { RatingText } from "./product-card";
import { AddToCart } from "./add-to-cart";
function ProductReviews({ id }: { id: string }) {
  const [feed] = useState(() => createReviewFeed(id));
  const state = useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getServerSnapshot);
  useEffect(() => { feed.activate(); void feed.initial(); return feed.dispose; }, [feed]);
  return <section id="ulasan" aria-labelledby="reviews-heading" className="mt-14 border-t pt-10"><h2 id="reviews-heading" className="font-serif text-3xl font-bold sm:text-4xl">Ulasan pembeli</h2><div className="mt-6 space-y-6">
    {state.summary && <RatingText average={state.summary.averageRating} count={state.summary.reviewCount} />}
    {state.reviews.length > 0 && <ul className="space-y-4">{state.reviews.map(review => <li key={review.id} className="space-y-3 rounded-2xl border bg-card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><p className="break-words font-semibold">{review.author.displayName}</p><time dateTime={review.createdAt} className="text-xs text-muted-foreground">{formatTimestamp(review.createdAt)} WIB</time></div><p className="text-sm text-primary" aria-label={`Rating ${review.rating} dari 5`}>{review.rating} dari 5</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{review.comment}</p></li>)}</ul>}
    {state.loading && <LoadingState label="Memuat ulasan…" />}
    {!!state.error && <ErrorState title="Ulasan belum dapat dimuat" error={state.error} retry={() => void feed.retry()} />}
    {!state.loading && !state.error && state.reviews.length === 0 && <EmptyState title="Belum ada ulasan" description="Ulasan tampil setelah pembeli mengulas item pesanan yang sudah Selesai." />}
    {state.reviews.length > 0 && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">Menampilkan {state.reviews.length} dari {state.total} ulasan.</p>}
    {state.hasMore && !state.error && <Button variant="outline" disabled={state.loading} onClick={() => void feed.more()}>{state.loading ? "Memuat…" : "Lihat ulasan lainnya"}</Button>}
  </div></section>;
}
export function ProductDetail({ id }: { id: string }) {
  const { state, reload } = usePublicRead(`/api/products/${id}`, decodeProduct);
  const unavailable = state.status === "error" && state.error instanceof ApiClientError && state.error.status === 404;
  return <PublicShell><div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12"><Link href="/menu" className="mb-8 inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><ArrowLeft aria-hidden="true" className="size-4" />Kembali ke menu</Link>{state.status === "loading" ? <LoadingState label="Memuat detail produk…" /> : state.status === "error" ? <div className="space-y-5"><ErrorState title={unavailable ? "Produk tidak tersedia" : "Detail produk belum dapat dimuat"} error={state.error} retry={unavailable ? undefined : reload} /><Button asChild variant="outline"><Link href="/menu">Lihat produk lainnya</Link></Button></div> : <><div className="grid gap-8 lg:grid-cols-2 lg:gap-12"><div className="overflow-hidden rounded-2xl"><ProductPhoto url={state.result.data.imageUrl} name={state.result.data.name} /></div><div className="space-y-5"><div className="flex flex-wrap gap-2"><StatusBadge label={state.result.data.category.name} />{state.result.data.isDemo && <StatusBadge label="Data demo" tone="info" />}</div><h1 className="break-words font-serif text-4xl leading-tight font-bold sm:text-5xl">{state.result.data.name}</h1><RatingText average={state.result.data.averageRating} count={state.result.data.reviewCount} /><p className="text-3xl font-bold text-primary">{formatRupiah(state.result.data.price)}</p><p className="whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">{state.result.data.description}</p><p className="text-sm font-medium">{state.result.data.availableStock === 0 ? "Stok habis" : `Stok tersedia: ${state.result.data.availableStock} unit`}</p><div className="border-t pt-5"><AddToCart product={state.result.data} quantityControl reload={reload} /></div><p className="text-xs leading-relaxed text-muted-foreground">Ketersediaan dapat berubah. Harga dan stok final diperiksa kembali saat checkout.</p></div></div><ProductReviews key={id} id={id} /></>}</div></PublicShell>;
}
