"use client";
import { Inbox, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiClientError } from "@/lib/http/client";

export function EmptyState({ title = "Belum ada data", description = "Data akan tampil di sini setelah tersedia." }: { title?: string; description?: string }) {
  return <div role="status" className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-10 text-center"><Inbox aria-hidden="true" className="size-7 text-primary" /><h3 className="font-serif text-2xl">{title}</h3><p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p></div>;
}
export function ErrorState({ error, retry, title = "Data belum dapat dimuat" }: { error?: unknown; retry?: () => void; title?: string }) {
  const known = error instanceof ApiClientError ? error : undefined;
  return <div role="alert" className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-card px-6 py-10 text-center"><AlertCircle aria-hidden="true" className="size-7 text-destructive" /><h3 className="font-serif text-2xl">{title}</h3><p className="max-w-lg text-sm leading-relaxed text-muted-foreground">{known?.message ?? "Periksa koneksi Anda dan coba kembali nanti."}</p>{known?.retryAfterSeconds !== undefined && <p className="text-sm text-muted-foreground">Tunggu {known.retryAfterSeconds} detik sebelum mencoba lagi.</p>}{known?.requestId && <p className="max-w-full break-all text-xs text-muted-foreground">ID permintaan: {known.requestId}</p>}{retry && <Button variant="outline" onClick={retry}>Coba lagi</Button>}</div>;
}
export function LoadingState({ label = "Memuat data…" }: { label?: string }) {
  return <div role="status" aria-busy="true" className="space-y-3 rounded-2xl border bg-card p-6"><span className="sr-only">{label}</span><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="mt-6 h-11 w-32 rounded-full" /></div>;
}
