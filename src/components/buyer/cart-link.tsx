"use client";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useSession } from "@/components/auth/session-provider";
import { decodeCart } from "@/lib/catalog-client/model";
import { useBuyerRead } from "./use-buyer-read";
export function CartLink({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  const { user, status } = useSession();
  const { state } = useBuyerRead("/api/cart", decodeCart);
  if (status !== "authenticated" || user?.role !== "BUYER") return null;
  const count = state.status === "ready" ? state.result.data.items.reduce((sum, item) => sum + item.quantity, 0) : null;
  return <Link href="/keranjang" onClick={onNavigate} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Keranjang${count === null ? ", jumlah belum tersedia" : `, ${count} unit`}`}><ShoppingBag aria-hidden="true" className="size-5" /><span className={compact ? "sr-only" : undefined}>Keranjang</span><span aria-hidden="true" className="rounded-full bg-secondary px-2">{count ?? "—"}</span></Link>;
}
