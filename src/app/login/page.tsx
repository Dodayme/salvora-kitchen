import { Suspense } from "react";
import { AuthScreen } from "@/components/auth/auth-screen";
import { LoadingState } from "@/components/shared/data-state";
export const metadata = { title: "Masuk | Salvora Kitchen" };
export default function LoginPage() { return <Suspense fallback={<div className="mx-auto max-w-xl p-6 py-16"><LoadingState label="Memuat halaman masuk…" /></div>}><AuthScreen mode="login" /></Suspense>; }
