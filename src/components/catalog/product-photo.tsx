"use client";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";
import { safeProductImage } from "@/lib/catalog-client/model";
export function ProductPhoto({ url, name, compact = false }: { url: string | null; name: string; compact?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null), source = safeProductImage(url);
  return <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">{source && source !== failed ? <Image src={source} alt={`Foto ${name}`} fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" referrerPolicy="no-referrer" onError={() => setFailed(source)} /> : <div role="img" aria-label={`Foto ${name} belum tersedia`} className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center text-muted-foreground"><ImageOff aria-hidden="true" className="size-8 shrink-0" /><span className={compact ? "sr-only" : "text-sm"}>{source ? "Foto belum dapat dimuat" : "Foto produk belum tersedia"}</span></div>}</div>;
}
