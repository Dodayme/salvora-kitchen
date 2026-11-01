import { PublicShell } from "@/components/layout/public-shell";
import { RequireRole } from "@/components/auth/require-role";
import { AddressScreen } from "@/components/buyer/address-screen";
export const metadata = { title: "Alamat saya | Salvora Kitchen" };
export default function AddressPage() { return <PublicShell><RequireRole role="BUYER"><AddressScreen /></RequireRole></PublicShell>; }
