import { PublicShell } from "@/components/layout/public-shell";
import { RequireRole } from "@/components/auth/require-role";
import { AccountSummary } from "@/components/auth/account-summary";
export const metadata = { title: "Akun saya | Salvora Kitchen" };
export default function AccountPage() { return <PublicShell><RequireRole role="BUYER"><AccountSummary /></RequireRole></PublicShell>; }
