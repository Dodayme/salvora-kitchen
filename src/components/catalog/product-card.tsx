import Link from "next/link";
import { Star } from "lucide-react";
import { ProductPhoto } from "./product-photo";
import { AddToCart } from "./add-to-cart";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatRupiah } from "@/lib/format";
import type { Product } from "@/lib/catalog-client/model";
export function RatingText({ average, count }: { average: number | null; count: number }) {
  return <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Star aria-hidden="true" className="size-4 shrink-0 text-primary" />{average === null ? "Belum ada rating" : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(average)} dari 5 · ${count} ulasan`}</span>;
}
export function ProductCard({ product, reload }: { product: Product; reload: () => void }) {
  return <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl bg-secondary shadow-soft"><Link href={`/menu/${product.id}`} tabIndex={-1} aria-hidden="true"><ProductPhoto url={product.imageUrl} name={product.name} /></Link><div className="flex flex-1 flex-col gap-4 p-5 sm:p-6"><div className="flex flex-wrap gap-2">{product.isDemo && <StatusBadge label="Data demo" />}{product.availability === "OUT_OF_STOCK" && <StatusBadge label="Stok habis" tone="warning" />}</div><div><p className="mb-1 text-xs font-medium text-primary">{product.category.name}</p><h3 className="break-words text-lg font-semibold leading-snug"><Link href={`/menu/${product.id}`} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{product.name}</Link></h3><p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{product.description}</p></div><RatingText average={product.averageRating} count={product.reviewCount} /><p className="text-xl font-bold text-primary">{formatRupiah(product.price)}</p><div className="mt-auto"><AddToCart product={product} reload={reload} /></div></div></article>;
}
