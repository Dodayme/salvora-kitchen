"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { cartChanged } from "@/components/buyer/use-buyer-read";
import { useSession, useAccountRequest } from "@/components/auth/session-provider";
import { ActionButton } from "@/components/shared/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/lib/http/client";
import { canPurchase, decodeCart, validQuantity, type Product } from "@/lib/catalog-client/model";

export function AddToCart({ product, quantityControl = false, reload }: { product: Product; quantityControl?: boolean; reload: () => void }) {
  const { status, user, store } = useSession(), request = useAccountRequest();
  const [quantity, setQuantity] = useState("1"), [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ owner: string; message: string; uncertain?: boolean; conflict?: boolean; error?: boolean }>();
  const [cooldown, setCooldown] = useState(0), [deadline, setDeadline] = useState(0);
  const lock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!deadline) return; const tick = () => setCooldown(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); }, [deadline]);
  const current = user?.id === feedback?.owner ? feedback : undefined;
  const available = canPurchase(product), valid = validQuantity(quantity, product.availableStock);
  async function perform(checkOnly = false) {
    const principal = store.getSnapshot();
    if (lock.current || cooldown > 0 || principal.status !== "authenticated" || principal.user?.role !== "BUYER" || !checkOnly && (!available || !valid || current?.uncertain || current?.conflict)) return;
    const owner = principal.user.id; lock.current = true; setPending(true);
    try {
      const { data } = await request(checkOnly ? "/api/cart" : "/api/cart/items", { ...(checkOnly ? {} : { method: "POST" as const, json: { productId: product.id, quantity: Number(quantity) } }), decode: decodeCart });
      if (!mounted.current || store.getSnapshot().user?.id !== owner) return;
      cartChanged();
      const count = data.items.find(item => item.productId === product.id)?.quantity ?? 0;
      setFeedback({ owner, message: checkOnly ? `Jumlah di keranjang saat ini: ${count} unit. Tinjau jumlah ini sebelum menambah lagi.` : "Ditambahkan ke keranjang. Stok dan harga belum dikunci." });
    } catch (error) {
      if (!mounted.current || store.getSnapshot().user?.id !== owner) return;
      const known = error instanceof ApiClientError ? error : undefined;
      const uncertain = !known || ["network", "protocol"].includes(known.kind) || known.status >= 500;
      setFeedback({ owner, error: true, uncertain: checkOnly || uncertain, conflict: known?.status === 409, message: uncertain ? "Hasil penambahan belum pasti. Periksa jumlah keranjang sebelum menambah lagi." : known?.message ?? "Penambahan belum dapat diselesaikan." });
      if (known?.retryAfterSeconds) { setDeadline(Date.now() + known.retryAfterSeconds * 1000); setCooldown(known.retryAfterSeconds); }
    } finally { lock.current = false; if (mounted.current) setPending(false); }
  }
  return <div className="space-y-3">
    {quantityControl && available && <div className="max-w-40 space-y-2"><Label htmlFor={`quantity-${product.id}`}>Jumlah</Label><Input id={`quantity-${product.id}`} inputMode="numeric" value={quantity} disabled={pending} aria-invalid={!valid} aria-describedby={!valid ? `quantity-error-${product.id}` : undefined} onChange={event => setQuantity(event.target.value)} />{!valid && <p id={`quantity-error-${product.id}`} className="text-sm text-destructive">Masukkan jumlah bulat 1–{product.availableStock}.</p>}</div>}
    {!available ? <Button disabled className="w-full">Stok habis</Button> : status === "anonymous" ? <Button asChild className="w-full"><Link href={`/login?returnTo=${encodeURIComponent(`/menu/${product.id}`)}`}>Masuk untuk menambahkan</Link></Button> : status === "error" ? <Button variant="outline" className="w-full" onClick={() => void store.refresh()}>Periksa sesi untuk membeli</Button> : user?.role === "ADMIN" ? <><Button disabled className="w-full">Khusus akun pembeli</Button><p className="text-xs text-muted-foreground">Admin tidak dapat berbelanja dengan akun ini.</p></> : <ActionButton pending={pending} disabled={status !== "authenticated" || !valid || !!(current?.uncertain || current?.conflict) || cooldown > 0} className="w-full" onClick={() => void perform()}><ShoppingBag aria-hidden="true" />{status === "checking" ? "Memeriksa sesi…" : "Tambah ke keranjang"}</ActionButton>}
    {cooldown > 0 && <p role="status" className="text-sm text-muted-foreground">Tunggu {cooldown} detik sebelum mencoba lagi.</p>}
    {current && <div role={current.error ? "alert" : "status"} className={`space-y-2 text-sm leading-relaxed ${current.error ? "text-destructive" : "text-success"}`}><p>{current.message}</p>{current.uncertain && <Button variant="outline" disabled={pending || cooldown > 0} onClick={() => void perform(true)}>Periksa jumlah keranjang</Button>}{current.conflict && <Button variant="outline" onClick={reload}>Muat ulang produk</Button>}</div>}
  </div>;
}
