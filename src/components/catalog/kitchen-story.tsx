import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChefHat, ShoppingBag, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

// Set src and alt when the owner has chosen the section photograph.
const storyPhoto: { src: string | null; alt: string } = { src: null, alt: "" };

export function KitchenStory() {
  return <>
    <section id="tentang" aria-labelledby="kitchen-story-heading" className="relative isolate overflow-hidden bg-[#ffb52e] py-14 sm:py-20 lg:py-24">
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 -right-24 -z-10 size-[28rem] rounded-full border-[60px] border-white/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-44 -left-24 -z-10 size-[30rem] rounded-full bg-brand/20" />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-12">
        <div className="relative mx-auto w-full max-w-lg">
          <div aria-hidden="true" className="absolute inset-0 translate-x-2 translate-y-3 rotate-2 rounded-[2rem] bg-foreground/10 sm:translate-x-3" />
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-white/40 bg-[#ffe3a0] shadow-soft">
            {storyPhoto.src ? <Image src={storyPhoto.src} alt={storyPhoto.alt} fill sizes="(min-width: 1024px) 480px, (min-width: 640px) 512px, 90vw" className="object-cover" /> : <div className="flex h-full flex-col items-center justify-center gap-5 p-8 text-center">
              <span className="flex size-24 items-center justify-center rounded-full border border-foreground/10 bg-white/35 sm:size-28"><ChefHat aria-hidden="true" className="size-12 stroke-[1.25] sm:size-14" /></span>
              <div><p className="text-xs font-semibold tracking-[0.2em] uppercase">Dari dapur kami</p><p className="mt-2 font-serif text-4xl font-bold sm:text-5xl">Salvora Kitchen</p><p className="mt-3 text-sm text-foreground/75">Foto pilihan kami segera hadir.</p></div>
            </div>}
          </div>
        </div>
        <div className="max-w-xl text-foreground">
          <p className="inline-flex rounded-full border border-foreground/15 px-4 py-2 text-xs font-semibold tracking-[0.12em] uppercase">Kenal lebih dekat</p>
          <h2 id="kitchen-story-heading" className="mt-5 font-serif text-4xl leading-[1.1] font-bold sm:text-5xl lg:text-6xl">Dari dapur kami,<br />untuk momen hangat Anda.</h2>
          <p className="mt-5 max-w-md text-sm leading-7 sm:text-base sm:leading-8">Ada cerita di setiap momen bersama. Dari risol gurih hingga cookies favorit, temukan camilan untuk teman ngobrol, suguhan tamu, atau waktu santai bersama orang tersayang.</p>
          <Button asChild size="lg" className="mt-7 shadow-soft"><Link href="/menu">Temukan camilan favorit<ArrowRight aria-hidden="true" /></Link></Button>
          <p className="mt-5 text-xs leading-relaxed text-foreground/75">Pesan online, lalu pilih diantar atau ambil sendiri.</p>
        </div>
      </div>
    </section>
    <section aria-label="Cara menerima pesanan" className="border-b bg-secondary/60">
      <div className="mx-auto grid max-w-6xl gap-7 px-5 py-9 sm:grid-cols-2 sm:gap-10 sm:px-8 lg:px-12">
        <div className="flex items-start gap-4"><span className="rounded-2xl bg-background p-3 text-primary"><Truck aria-hidden="true" className="size-6" /></span><div><h3 className="font-semibold">Kami antar ke alamat Anda</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Khusus Kota Tanjungpinang, Kepulauan Riau. Ongkir Rp10.000 per pesanan.</p></div></div>
        <div className="flex items-start gap-4"><span className="rounded-2xl bg-background p-3 text-primary"><ShoppingBag aria-hidden="true" className="size-6" /></span><div><h3 className="font-semibold">Atau, ambil sendiri</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Tanpa ongkir. Tunggu status Siap diambil sebelum datang ke toko.</p></div></div>
      </div>
    </section>
  </>;
}
