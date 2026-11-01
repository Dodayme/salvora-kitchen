"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useSession } from "./session-provider";
import { authDestination, authErrorMessage, authFieldIssues, safeReturnTo, validateAuthFields, type AuthField, type AuthFieldErrors, type AuthFields, type AuthMode } from "@/lib/auth-client/model";
import { ApiClientError } from "@/lib/http/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { ActionButton } from "@/components/shared/action-button";

const empty: AuthFields = { name: "", email: "", password: "", confirmPassword: "" };
export function AuthScreen({ mode }: { mode: AuthMode }) {
  const register = mode === "register", router = useRouter(), params = useSearchParams();
  const { status, user, error: sessionError, store } = useSession();
  const requested = params.getAll("returnTo").length === 1 ? safeReturnTo(params.get("returnTo")) : null;
  const [values, setValues] = useState(empty), [errors, setErrors] = useState<AuthFieldErrors>({});
  const [failure, setFailure] = useState<{ message: string; requestId?: string }>();
  const [pending, setPending] = useState(false), [showPassword, setShowPassword] = useState(false);
  const [deadline, setDeadline] = useState(0), [remaining, setRemaining] = useState(0);
  const lock = useRef(false), form = useRef<HTMLFormElement>(null), notice = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (failure || status === "error") notice.current?.focus(); }, [failure, status]);
  useEffect(() => {
    if (status === "authenticated" && user) { router.replace(authDestination(user, requested)); router.refresh(); }
  }, [status, user, requested, router]);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick(); const timer = window.setInterval(tick, 1000); return () => clearInterval(timer);
  }, [deadline]);
  const disabled = pending || status !== "anonymous" || remaining > 0;
  const update = (field: AuthField, value: string) => { setValues(previous => ({ ...previous, [field]: value })); setErrors(previous => ({ ...previous, [field]: undefined })); setFailure(undefined); };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || disabled) return;
    const invalid = validateAuthFields(mode, values); setErrors(invalid); setFailure(undefined);
    const first = Object.keys(invalid)[0];
    if (first) { (form.current?.elements.namedItem(first) as HTMLElement | null)?.focus(); return; }
    lock.current = true; setPending(true);
    const input: Record<string, string> = register ? { name: values.name.trim(), email: values.email.trim().toLowerCase(), password: values.password, confirmPassword: values.confirmPassword } : { email: values.email.trim().toLowerCase(), password: values.password };
    try { await store.authenticate(mode, input); }
    catch (error) {
      if (!mounted.current) return;
      setFailure({ message: authErrorMessage(error), requestId: error instanceof ApiClientError ? error.requestId : undefined });
      if (error instanceof ApiClientError) {
        setErrors(authFieldIssues(error.fields));
        if (error.retryAfterSeconds !== undefined) { setDeadline(Date.now() + error.retryAfterSeconds * 1000); setRemaining(error.retryAfterSeconds); }
      }
    } finally {
      lock.current = false;
      if (mounted.current) { setPending(false); setValues(previous => ({ ...previous, password: "", confirmPassword: "" })); }
    }
  }
  const other = `/${register ? "login" : "register"}${requested ? `?returnTo=${encodeURIComponent(requested)}` : ""}`;
  return <main id="main-content" className="flex min-h-dvh flex-col px-5 py-7 sm:px-8 sm:py-10">
    <div className="mx-auto w-full max-w-6xl"><Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><ArrowLeft aria-hidden="true" className="size-4" />Kembali ke beranda</Link></div>
    <div className="mx-auto my-auto grid w-full max-w-6xl overflow-hidden rounded-[28px] border bg-card shadow-soft lg:grid-cols-[1.2fr_1fr]">
      <section className="px-5 py-9 sm:px-12 sm:py-12 lg:px-16" aria-labelledby="auth-title">
        <p className="font-serif text-3xl font-bold text-primary">Salvora Kitchen</p>
        <h1 id="auth-title" className="mt-4 font-serif text-4xl leading-tight font-bold sm:text-5xl">{register ? "Buat akun Anda." : "Selamat datang!"}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{register ? "Daftar untuk mulai memesan jajanan favorit Anda." : "Masuk untuk melanjutkan pesanan Anda."}</p>
        <div className="mt-7 space-y-4">
          {status === "checking" && <p role="status" className="text-sm text-muted-foreground">{pending ? "Memproses dan memeriksa sesi Anda…" : "Memeriksa sesi Anda…"}</p>}
          {status === "authenticated" && <p role="status" className="text-sm">Berhasil masuk. Mengarahkan ke halaman Anda…</p>}
          {(failure || status === "error") && <div ref={notice} role="alert" tabIndex={-1} className="space-y-2 rounded-xl border border-destructive/30 bg-danger-surface p-4 text-sm leading-relaxed text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring"><p>{failure?.message ?? authErrorMessage(sessionError)}</p>{failure?.requestId && <p className="break-all text-xs">ID permintaan: {failure.requestId}</p>}{status === "error" && <Button variant="outline" onClick={() => { setFailure(undefined); void store.refresh(); }}>Periksa sesi</Button>}</div>}
          {remaining > 0 && <p role="status" className="text-sm text-muted-foreground">Coba lagi dalam {remaining} detik.</p>}
        </div>
        <form ref={form} noValidate onSubmit={submit} className="mt-5 space-y-5" aria-label={register ? "Formulir daftar" : "Formulir masuk"}>
          {register && <FormField id="auth-name" label="Nama lengkap" error={errors.name} required>{attributes => <Input {...attributes} name="name" autoComplete="name" maxLength={100} required value={values.name} onChange={event => update("name", event.target.value)} disabled={pending || status !== "anonymous"} placeholder="Masukkan nama lengkap Anda" />}</FormField>}
          <FormField id="auth-email" label="Email" error={errors.email} required>{attributes => <Input {...attributes} name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required value={values.email} onChange={event => update("email", event.target.value)} disabled={pending || status !== "anonymous"} placeholder="Masukkan email Anda" />}</FormField>
          <FormField id="auth-password" label="Kata sandi" error={errors.password} required hint={register ? "Minimal 8 karakter, maksimal 72 byte UTF-8. Kata sandi tidak dipangkas." : undefined}>{attributes => <div className="relative"><Input {...attributes} name="password" type={showPassword ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} maxLength={72} required value={values.password} onChange={event => update("password", event.target.value)} disabled={pending || status !== "anonymous"} placeholder="Masukkan kata sandi Anda" className="pr-14" /><Button variant="ghost" size="icon" aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={showPassword} disabled={pending || status !== "anonymous"} onClick={() => setShowPassword(value => !value)} className="absolute top-0 right-1 rounded-md">{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</Button></div>}</FormField>
          {register && <FormField id="auth-confirm" label="Konfirmasi kata sandi" error={errors.confirmPassword} required>{attributes => <Input {...attributes} name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" maxLength={72} required value={values.confirmPassword} onChange={event => update("confirmPassword", event.target.value)} disabled={pending || status !== "anonymous"} placeholder="Ulangi kata sandi Anda" />}</FormField>}
          <ActionButton type="submit" className="w-full" pending={pending} disabled={disabled}>{pending ? "Mohon tunggu…" : register ? "Daftar" : "Masuk"}</ActionButton>
        </form>
        <div className="mt-5 border-t pt-5 text-center text-sm"><span className="text-muted-foreground">{register ? "Sudah punya akun?" : "Belum punya akun?"} </span><Link href={other} className="inline-flex min-h-11 items-center rounded-sm px-1 font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{register ? "Masuk di sini" : "Daftar sekarang"}</Link></div>
      </section>
      <aside className="hidden flex-col justify-between bg-secondary p-12 lg:flex" aria-label="Tentang akun Salvora"><div><p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Dari dapur kami</p><p className="mt-7 font-serif text-5xl leading-tight font-bold">Jajanan lezat,<br />momen hangat.</p><p className="mt-6 max-w-xs text-sm leading-7 text-muted-foreground">Risol dan cookies untuk menemani momen Anda bersama orang tersayang.</p></div><div className="mt-16 rounded-2xl border border-foreground/15 bg-background p-6"><ShieldCheck aria-hidden="true" className="size-7 text-primary" /><h2 className="mt-4 font-serif text-2xl font-bold">Akun untuk pesanan Anda</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Kelola informasi dan akses pesanan melalui akun Anda sendiri.</p></div></aside>
    </div>
    <p className="mt-6 text-center text-xs text-muted-foreground">Salvora Kitchen · Jajanan lezat dari dapur kami.</p>
  </main>;
}
