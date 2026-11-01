import { PublicShell } from "@/components/layout/public-shell";
import { RequireRole } from "@/components/auth/require-role";
import { CheckoutScreen } from "@/components/checkout/checkout-screen";
export const metadata = { title: "Checkout | Salvora Kitchen" };
export default function CheckoutPage() { return <PublicShell><RequireRole role="BUYER"><CheckoutScreen /></RequireRole></PublicShell>; }
