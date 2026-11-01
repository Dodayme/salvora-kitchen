"use client";
import Link from "next/link";
import { useState } from "react";
import { decodeCart, validQuantity } from "@/lib/catalog-client/model";
import { decodeNull, decodeVoucher, voucherCopy } from "@/lib/buyer-client/model";
import { formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/data-state";
import { ProductPhoto } from "@/components/catalog/product-photo";
import { cartChanged, useBuyerRead } from "./use-buyer-read";
import { useBuyerMutation } from "./use-buyer-mutation";
import { ApiClientError } from "@/lib/http/client";
type CartItem = ReturnType<typeof decodeCart>["items"][number];
function OverflowRemoval({ item }: { item: CartItem }) {
  const [confirm, setConfirm] = useState(false), mutation = useBuyerMutation();
  return <div className="space-y-3 rounded-xl border p-4"><p className="break-words">{item.name} (data pembacaan sebelumnya)</p><Button variant="outline" disabled={mutation.disabled} onClick={() => setConfirm(true)}>Hapus item untuk memulihkan batas total</Button>{confirm && <div className="space-y-2"><p>Hapus item ini dari keranjang?</p><ActionButton pending={mutation.pending} disabled={mutation.disabled} variant="destructive" onClick={() => void mutation.run(client => client(`/api/cart/items/${item.id}`, { method: "DELETE", json: {}, decode: decodeNull }), cartChanged)}>Ya, hapus item</ActionButton><Button variant="ghost" disabled={mutation.pending} onClick={() => setConfirm(false)}>Batal</Button></div>}{!!mutation.error && <ErrorState error={mutation.error} retry={mutation.wait ? undefined : cartChanged} />}</div>;
}
function CartRow({ item, reload }: { item: CartItem; reload: () => void }) {
  const [quantity, setQuantity] = useState(String(item.quantity)), [confirm, setConfirm] = useState(false);
  const mutation = useBuyerMutation();
  const valid = validQuantity(quantity, item.availableStock);
  function update(remove = false) {
    if (!remove && !valid) return;
    void mutation.run(client => remove ? client(`/api/cart/items/${item.id}`, { method: "DELETE", json: {}, decode: decodeNull }) : client(`/api/cart/items/${item.id}`, { method: "PATCH", json: { quantity: Number(quantity) }, decode: decodeCart }), cartChanged);
  }
  return <article className="min-w-0 space-y-4 rounded-2xl border bg-card p-5">
    <div className="flex gap-4"><div className="w-24 shrink-0"><ProductPhoto compact url={item.imageUrl} name={item.name} /></div><div className="min-w-0 space-y-1"><h2 className="break-words font-serif text-2xl font-bold">{item.name}</h2><p>{formatRupiah(item.unitPrice)} / unit</p><p className="text-sm text-muted-foreground">Stok tersedia: {item.availableStock}</p></div></div>
    {!item.isAvailable && <p role="status" className="text-sm text-destructive">Item tidak tersedia atau jumlah melebihi stok. Tinjau jumlah atau hapus item.</p>}
    <div className="flex flex-wrap items-end gap-3"><div className="w-28 space-y-2"><Label htmlFor={`cart-${item.id}`}>Jumlah</Label><Input id={`cart-${item.id}`} inputMode="numeric" value={quantity} disabled={mutation.disabled} aria-invalid={!valid} aria-describedby={!valid ? `error-${item.id}` : undefined} onChange={event => setQuantity(event.target.value)} /></div><ActionButton pending={mutation.pending} disabled={mutation.disabled || !valid || quantity === String(item.quantity)} onClick={() => update()}>Simpan jumlah</ActionButton><Button variant="ghost" disabled={mutation.disabled} onClick={() => setConfirm(true)}>Hapus</Button></div>
    {!valid && <p id={`error-${item.id}`} className="text-sm text-destructive">{item.availableStock ? `Masukkan jumlah bulat 1–${item.availableStock}.` : "Stok habis. Item dapat dihapus."}</p>}
    {confirm && <div role="group" aria-label={`Konfirmasi hapus ${item.name}`} className="space-y-2 rounded-xl bg-secondary p-4"><p>Hapus item ini dari keranjang?</p><div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={mutation.disabled} onClick={() => update(true)}>Ya, hapus item</Button><Button variant="outline" disabled={mutation.pending} onClick={() => setConfirm(false)}>Batal</Button></div></div>}
    <p className="text-right font-semibold">Subtotal item: {formatRupiah(item.lineSubtotal)}</p>
    {!!mutation.error && <><ErrorState error={mutation.error} />{mutation.blocked && <p className="text-sm">Hasil perlu diperiksa. Muat ulang keranjang sebelum mengulangi perubahan.</p>}<Button variant="outline" disabled={mutation.pending || mutation.wait > 0} onClick={reload}>Periksa keranjang terbaru</Button></>}
    {mutation.wait > 0 && <p role="status">Tunggu {mutation.wait} detik.</p>}
  </article>;
}
function VoucherPanel() {
  const { state, reload } = useBuyerRead("/api/me/voucher", decodeVoucher);
  return <section id="voucher" className="space-y-4 rounded-2xl border bg-secondary p-6"><h2 className="font-serif text-3xl font-bold">Voucher pembeli baru</h2><p className="text-sm leading-relaxed">Diskon 20%, maksimal Rp100.000, sekali pakai. Berlaku pada subtotal barang, tidak termasuk ongkir.</p>{state.status === "loading" ? <LoadingState /> : state.status === "error" ? <ErrorState error={state.error} retry={reload} /> : state.result.data.voucher ? <div className="space-y-2"><p className="font-semibold">{voucherCopy[state.result.data.voucher.status].title}</p><p className="text-sm leading-relaxed">{voucherCopy[state.result.data.voucher.status].text}</p><Button variant="outline" onClick={reload}>Perbarui status voucher</Button></div> : <p className="text-sm">Tidak ada voucher pada akun ini.</p>}</section>;
}
export function CartScreen() {
  const { state } = useBuyerRead("/api/cart", decodeCart);
  const reload = cartChanged;
  return <div className="mx-auto max-w-7xl space-y-8 px-5 py-12 sm:px-8 lg:px-12"><div className="flex flex-wrap items-center justify-between gap-4"><h1 className="font-serif text-4xl font-bold sm:text-5xl">Keranjang Anda</h1><Button asChild variant="outline"><Link href="/menu">Tambah menu</Link></Button></div><p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Harga dan stok mengikuti data terbaru server. Keranjang belum mengunci stok atau diskon. Total akhir diperiksa melalui quote saat checkout.</p><div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]"><section className="min-w-0 space-y-4" aria-label="Isi keranjang">{state.status === "loading" ? <LoadingState /> : state.status === "error" ? <><ErrorState error={state.error} retry={reload} />{state.error instanceof ApiClientError && state.error.code === "CART_TOTAL_LIMIT" && <><p className="text-sm">Total belum dapat ditampilkan. Hapus item yang diketahui dari pembacaan sebelumnya. Jika daftar belum pernah dimuat, hubungi admin untuk memeriksa harga produk.</p>{state.previous?.data.items.map(item => <OverflowRemoval key={`${state.key}:${item.id}`} item={item} />)}</>}</> : !state.result.data.items.length ? <EmptyState title="Keranjang masih kosong" description="Pilih jajanan dari menu untuk mulai mengisi keranjang." /> : <><div className="space-y-4" key={state.key}>{state.result.data.items.map(item => <CartRow key={item.id} item={item} reload={reload} />)}</div><div className="flex flex-wrap justify-between gap-3 rounded-2xl bg-secondary p-6"><p>Subtotal barang terkini</p><strong>{formatRupiah(state.result.data.subtotal)}</strong></div><Button variant="outline" onClick={reload}>Perbarui harga dan stok</Button></>}</section><aside className="space-y-6"><VoucherPanel /><section className="space-y-4 rounded-2xl border bg-card p-6"><h2 className="font-serif text-3xl font-bold">Cara menerima pesanan</h2><p className="text-sm leading-relaxed">Pilih diantar di Kota Tanjungpinang dengan ongkir Rp10.000 atau ambil sendiri di Salvora Kitchen secara gratis. Alamat hanya diperlukan untuk diantar. Tentukan pilihan saat checkout.</p><Button asChild variant="outline"><Link href="/alamat">Kelola alamat</Link></Button>{state.status === "ready" && state.result.data.items.length > 0 && <Button asChild><Link href="/checkout">Lanjut ke checkout</Link></Button>}</section></aside></div></div>;
}
