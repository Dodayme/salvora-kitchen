import { PublicShell } from "@/components/layout/public-shell";
import { RequireRole } from "@/components/auth/require-role";
import { CartScreen } from "@/components/buyer/cart-screen";
export const metadata = { title: "Keranjang | Salvora Kitchen" };
export default function CartPage() { return <PublicShell><RequireRole role="BUYER"><CartScreen /></RequireRole></PublicShell>; }
