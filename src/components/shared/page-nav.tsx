"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
export function PageNav({ page, totalPages, onPageChange, pending = false }: { page: number; totalPages: number; onPageChange: (page: number) => void; pending?: boolean }) {
  return <nav aria-label="Halaman data" className="flex flex-wrap items-center justify-between gap-3">
    <p aria-live="polite" className="text-sm text-muted-foreground">{totalPages === 0 ? "Belum ada hasil" : page > totalPages ? "Halaman ini sudah tidak memiliki hasil" : `Halaman ${page} dari ${totalPages}`}</p>
    <div className="flex gap-2"><Button type="button" variant="outline" disabled={pending || page <= 1 || totalPages === 0} onClick={() => onPageChange(page - 1)} aria-label="Halaman sebelumnya"><ChevronLeft aria-hidden="true" />Sebelumnya</Button><Button type="button" variant="outline" disabled={pending || page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Halaman berikutnya">Berikutnya<ChevronRight aria-hidden="true" /></Button></div>
  </nav>;
}
