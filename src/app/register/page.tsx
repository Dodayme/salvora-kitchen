import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { LoadingState } from "@/components/shared/data-state";
export const metadata = { title: "Daftar | Salvora Kitchen" };
export default function RegisterPage() { return <Suspense fallback={<div className="mx-auto max-w-xl p-6 py-16"><LoadingState label="Memuat halaman daftar…" /></div>}><AuthScreen mode="register" /></Suspense>; }
