import { Suspense } from "react";
import { StoreCatalog } from "@/components/catalog/storefront";
import { LoadingState } from "@/components/shared/data-state";
export const metadata = { title: "Menu | Salvora Kitchen" };
export default function MenuPage() { return <Suspense fallback={<div className="mx-auto max-w-7xl p-6"><LoadingState label="Memuat katalog…" /></div>}><StoreCatalog /></Suspense>; }
