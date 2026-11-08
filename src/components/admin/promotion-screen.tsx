"use client";

import Image from "next/image";
import { z } from "zod";
import { useState } from "react";

import { useAccountRequest } from "@/components/auth/session-provider";

import { decodePromotions, promotionView } from "@/lib/promotions/model";

import { useAdminRead } from "./catalog-hooks";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { ErrorState, LoadingState } from "@/components/shared/data-state";

import { formatRupiah, formatTimestamp } from "@/lib/format";

const decodeOne = (value: unknown) => promotionView.parse(value);

export function PromotionScreen() {

  const request = useAccountRequest(), list = useAdminRead("/api/admin/promotions", decodePromotions);

  const [selected, setSelected] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState<unknown>(), [message, setMessage] = useState("");

  async function replaceImage(id: string, file: File) {
    setPending(true); setError(undefined); setMessage("");
    try {
      const form = new FormData(); form.set("file", file);
      const uploaded = await request("/api/admin/product-photos", { method: "POST", form, decode: value => z.object({ photoId: z.uuid() }).parse(value) });
      await request("/api/admin/promotions", { method: "PATCH", json: { id, photoId: uploaded.data.photoId }, decode: decodeOne });
      list.reload(); setMessage("Gambar promosi diperbarui.");
    } catch (err) { setError(err); } finally { setPending(false); }
  }
  async function toggle(id: string, isActive: boolean) {

    setPending(true); setError(undefined); setMessage("");

    try { await request("/api/admin/promotions", { method: "PATCH", json: { id, isActive }, decode: decodeOne }); list.reload(); setMessage("Status promosi diperbarui."); }

    catch (err) { setError(err); } finally { setPending(false); }

  }

  return <div className="mx-auto max-w-5xl space-y-7 px-5 py-9 sm:px-8">

    <h1 className="font-serif text-4xl font-bold">Promosi event</h1>

    <p>Diskon otomatis bisa dipakai berulang selama event. Checkout memilih potongan terbesar dari event atau voucher pembeli baru, tanpa penumpukan. Ongkir tidak didiskon.</p>

    <form className="space-y-5 rounded-2xl border bg-card p-6" onSubmit={async event => {

      event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);

      setPending(true); setError(undefined); setMessage("");

      try {

        const image = data.get("image");
        let photoId: string | null = null;
        if (image instanceof File && image.size) {
          const upload = new FormData(); upload.set("file", image);
          const result = await request("/api/admin/product-photos", { method: "POST", form: upload, decode: value => z.object({ photoId: z.uuid() }).parse(value) });
          photoId = result.data.photoId;
        }
        await request("/api/admin/promotions", { method: "POST", decode: decodeOne, json: {

          photoId, name: data.get("name"), percentage: Number(data.get("percentage")), maxDiscount: Number(data.get("cap")),

          startsAt: new Date(`${data.get("start")}:00+07:00`).toISOString(), endsAt: new Date(`${data.get("end")}:00+07:00`).toISOString(),

          audience: selected ? "SELECTED" : "ALL", emails: selected ? String(data.get("emails")).split(/[\s,;]+/).filter(Boolean) : [],

        } }); form.reset(); setSelected(false); list.reload(); setMessage("Promosi berhasil ditambahkan.");

      } catch (err) { setError(err); } finally { setPending(false); }

    }}>

      <h2 className="font-serif text-2xl font-bold">Tambah diskon event</h2>

      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">

        <label className="space-y-2 sm:col-span-2">Gambar banner (opsional)<Input name="image" type="file" accept="image/jpeg,image/png,image/webp" /><span className="text-sm text-muted-foreground">JPEG, PNG, atau WebP, maksimal 2 MB. Gambar ditampilkan kepada penerima diskon selama event aktif.</span></label>
        <label className="space-y-2 sm:col-span-2">Nama event<Input name="name" required minLength={2} maxLength={100} placeholder="Promo akhir tahun" /></label>

        <label className="space-y-2">Diskon (%)<Input name="percentage" type="number" required min={1} max={99} step={1} /></label>

        <label className="space-y-2">Maksimal potongan (Rp)<Input name="cap" type="number" required min={1} max={2147483647} step={1} /></label>

        <label className="space-y-2">Mulai (WIB)<Input name="start" type="datetime-local" required /></label>

        <label className="space-y-2">Berakhir (WIB)<Input name="end" type="datetime-local" required /></label>

        <label className="space-y-2 sm:col-span-2">Penerima<select className="block min-h-11 w-full rounded-md border bg-background px-3" value={selected ? "SELECTED" : "ALL"} onChange={event => setSelected(event.target.value === "SELECTED")}><option value="ALL">Semua pengguna</option><option value="SELECTED">Pengguna tertentu</option></select></label>

        {selected && <label className="space-y-2 sm:col-span-2">Email pengguna<textarea name="emails" required className="block min-h-24 w-full rounded-md border bg-background p-3" placeholder="Pisahkan email dengan koma atau baris baru" /><span className="text-sm text-muted-foreground">Maksimal 200 email akun pembeli yang sudah terdaftar.</span></label>}

      </fieldset>

      <Button disabled={pending} type="submit">{pending ? "Menyimpan…" : "Tambah promosi"}</Button>

    </form>

    {error !== undefined && <ErrorState error={error} />}{message && <p role="status">{message}</p>}

    <h2 className="font-serif text-2xl font-bold">Daftar event</h2>

    {list.state.status === "loading" ? <LoadingState /> : list.state.status === "error" ? <ErrorState error={list.state.error} retry={list.reload} /> : <div className="space-y-4">{!list.state.result.data.length && <p>Belum ada event. Tambahkan promosi pertama di atas.</p>}{list.state.result.data.map(p => <article key={p.id} className="space-y-3 rounded-2xl border bg-card p-5">{p.photoId && <Image src={`/api/product-photos/${p.photoId}`} alt={p.name} width={960} height={400} unoptimized className="max-h-64 w-full rounded-xl object-contain" />}<h3 className="text-xl font-semibold">{p.name}</h3><label className="block space-y-2 text-sm">Tambah / ganti gambar banner<Input type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={event => { const file = event.target.files?.[0]; if (file) void replaceImage(p.id, file); event.target.value = ""; }} /></label><p>{p.percentage}% · maksimal {formatRupiah(p.maxDiscount)}</p><p>{formatTimestamp(p.startsAt)} – {formatTimestamp(p.endsAt)} WIB</p><p>{p.recipientIds.length ? `${p.recipientIds.length} pengguna terpilih` : "Semua pengguna"} · {p.isActive ? "Diaktifkan sesuai jadwal" : "Nonaktif"}</p><Button variant="outline" disabled={pending} onClick={() => void toggle(p.id, !p.isActive)}>{p.isActive ? "Nonaktifkan" : "Aktifkan"}</Button></article>)}</div>}

  </div>;

}

