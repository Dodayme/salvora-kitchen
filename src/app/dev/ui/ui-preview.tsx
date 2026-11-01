"use client";

import { useState, type ReactNode } from "react";
import { Check, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField } from "@/components/shared/form-field";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/data-state";
import { OrderStatusBadge, PaymentStatusBadge, StatusBadge } from "@/components/shared/status-badge";
import { PageNav } from "@/components/shared/page-nav";
import { ApiClientError } from "@/lib/http/client";
import { formatRupiah, formatTimestamp } from "@/lib/format";

function Panel({ title, description, children, className = "" }: { title: string; description: string; children: ReactNode; className?: string }) {
  return <section className={`space-y-6 rounded-2xl border bg-card p-5 shadow-soft sm:p-8 ${className}`}><div><h2 className="font-serif text-3xl font-bold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>{children}</section>;
}
const sampleRows = ["AWAITING_PAYMENT", "PROCESSING", "COMPLETED"] as const;

export function UiPreview() {
  const [invalid, setInvalid] = useState(false);
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(false);
  return <PublicShell><div className="mx-auto max-w-7xl space-y-8 px-5 py-10 sm:px-8 sm:py-16 lg:px-12">
    <div className="max-w-3xl space-y-5"><StatusBadge label="Pratinjau development · FE-01" tone="info" /><h1 className="font-serif text-5xl leading-[1.05] font-bold sm:text-[64px]">Dari dapur, dengan<br className="hidden sm:block" /> sentuhan hangat.</h1><p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">Komponen berikut memakai data contoh tanpa permintaan API bisnis atau pembayaran. Menu akun pada header mengikuti sesi aktif.</p></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Warna & tipografi" description="Abhaya Libre untuk judul, Poppins untuk isi. Warna utama mengikuti audit desain.">
        <div className="grid grid-cols-3 gap-3">{[{ name: "Krem", color: "bg-background", code: "#FFF6EF" }, { name: "Oranye", color: "bg-brand", code: "#FF7A00" }, { name: "Cokelat", color: "bg-foreground", code: "#4E342E" }].map(swatch => <div key={swatch.name} className="overflow-hidden rounded-xl border"><div className={`h-20 ${swatch.color}`} /><div className="space-y-1 p-3"><p className="text-sm font-medium">{swatch.name}</p><p className="text-[11px] text-muted-foreground">{swatch.code}</p></div></div>)}</div>
        <p className="text-sm leading-relaxed text-muted-foreground">Teks tombol memakai pasangan warna dengan kontras yang jelas. Oranye terang menjadi aksen merek.</p>
      </Panel>
      <Panel title="Tindakan" description="Tombol utama, sekunder, nonaktif, dan keadaan sedang diproses.">
        <div className="flex flex-wrap gap-3"><Button onClick={() => toast.success("Contoh berhasil", { description: "Hanya pratinjau lokal. Tidak ada data tersimpan." })}>Tampilkan toast<ArrowUpRight aria-hidden="true" /></Button><Button variant="secondary" onClick={() => setPending(value => !value)}>Ubah pending</Button><Button variant="outline" disabled>Nonaktif</Button><ActionButton pending={pending} onClick={() => toast.info("Aksi contoh")}>{pending ? "Memproses contoh…" : "Aksi contoh"}</ActionButton></div>
        <div className="flex flex-wrap gap-3">
          <Dialog><DialogTrigger asChild><Button variant="outline">Buka dialog</Button></DialogTrigger><DialogContent><DialogHeader className="pr-8"><DialogTitle>Informasi contoh</DialogTitle><DialogDescription>Dialog menjaga fokus di dalamnya. Tekan Escape atau Tutup untuk kembali ke tombol pembuka.</DialogDescription></DialogHeader><p className="text-sm leading-relaxed">Tidak ada perubahan data dari dialog ini.</p><DialogFooter><DialogClose asChild><Button>Tutup dialog</Button></DialogClose></DialogFooter></DialogContent></Dialog>
          <AlertDialog><AlertDialogTrigger asChild><Button variant="outline">Contoh konfirmasi</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Konfirmasi tindakan contoh?</AlertDialogTitle><AlertDialogDescription>Pratinjau ini hanya menampilkan toast lokal. Tidak ada transaksi atau data yang diubah.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => toast.info("Konfirmasi contoh diterima")}>Ya, lihat contoh</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
      </Panel>
      <Panel title="Formulir yang jelas" description="Label, petunjuk, validasi, dan fokus keyboard yang terhubung ke kontrol.">
        <form noValidate className="space-y-5" onSubmit={event => { event.preventDefault(); setInvalid(true); }}>
          <FormField label="Nama contoh" hint="Isian ini hanya untuk melihat keadaan error." error={invalid ? "Lengkapi nama contoh terlebih dahulu." : undefined} required>{attributes => <Input {...attributes} required placeholder="Misalnya, Dapur Salvora" />}</FormField>
          <FormField label="Kategori contoh">{attributes => <Select defaultValue="risol"><SelectTrigger {...attributes} className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="risol">Risol</SelectItem><SelectItem value="cookies">Cookies</SelectItem></SelectContent></Select>}</FormField>
          <FormField label="Catatan contoh" hint="Teks ditampilkan sebagai teks biasa.">{attributes => <Textarea {...attributes} placeholder="Tulis catatan contoh…" />}</FormField>
          <div className="flex items-start gap-3"><Checkbox id="preview-check" /><Label htmlFor="preview-check" className="leading-relaxed">Aktifkan pilihan contoh</Label></div>
          <div className="flex flex-wrap gap-3"><Button type="submit">Lihat validasi</Button><Button variant="ghost" onClick={() => setInvalid(false)}>Bersihkan error</Button></div>
        </form>
      </Panel>
      <Panel title="Status & format" description="Status pesanan dan pembayaran ditampilkan terpisah. Nilai kosong tetap kosong.">
        <div className="space-y-5"><div className="flex flex-wrap gap-2"><OrderStatusBadge status="AWAITING_PAYMENT" /><OrderStatusBadge status="COMPLETED" /><OrderStatusBadge status="NEEDS_ATTENTION" /></div><div className="flex flex-wrap gap-2"><PaymentStatusBadge status="UNCONFIRMED" /><PaymentStatusBadge status="SUCCESS" /><PaymentStatusBadge status={null} /></div></div>
        <dl className="divide-y rounded-xl bg-background px-4 text-sm">{[["Nominal contoh", formatRupiah(14000)], ["Nominal nol", formatRupiah(0)], ["Nominal belum tersedia", formatRupiah(null)], ["Waktu contoh (WIB)", formatTimestamp("2026-10-24T03:00:00Z")]].map(([name, value]) => <div key={name} className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-muted-foreground">{name}</dt><dd className="font-medium">{value}</dd></div>)}</dl>
      </Panel>
      <Panel title="Tabel & halaman" description="Data contoh untuk memeriksa tabel sempit dan batas tombol pagination." className="min-w-0 lg:col-span-2">
        <Table><TableCaption>Seluruh baris berikut adalah contoh tampilan.</TableCaption><TableHeader><TableRow><TableHead>Referensi contoh</TableHead><TableHead>Status pesanan</TableHead><TableHead className="text-right">Nominal contoh</TableHead></TableRow></TableHeader><TableBody>{sampleRows.map((status, index) => <TableRow key={status}><TableCell className="font-medium">CONTOH-{page}-{index + 1}</TableCell><TableCell><OrderStatusBadge status={status} /></TableCell><TableCell className="text-right">{formatRupiah(14000 + index * 1000)}</TableCell></TableRow>)}</TableBody></Table>
        <PageNav page={page} totalPages={3} onPageChange={setPage} />
      </Panel>
    </div>
    <section className="space-y-5"><div><h2 className="font-serif text-3xl font-bold">Saat data belum tersedia</h2><p className="mt-2 text-sm text-muted-foreground">Contoh loading, kosong, dan gagal. Tombol coba lagi hanya memunculkan pemberitahuan lokal.</p></div><div className="grid items-start gap-5 md:grid-cols-3"><LoadingState /><EmptyState title="Belum ada item" description="Item yang tersedia akan tampil di sini." /><ErrorState error={new ApiClientError(503, "EXAMPLE_UNAVAILABLE", "Layanan contoh belum tersedia.", "http", "preview-request-001")} retry={() => toast.info("Percobaan contoh", { description: "Tidak ada permintaan jaringan dikirim." })} /></div></section>
    <div className="flex items-start gap-3 rounded-2xl bg-secondary p-5 text-sm leading-relaxed"><Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /><p>Pratinjau komponen dasar. Integrasi akun, katalog, keranjang, dan checkout dikerjakan pada task FE berikutnya.</p></div>
  </div></PublicShell>;
}
