import { PublicShell } from "@/components/layout/public-shell";
import { RequireRole } from "@/components/auth/require-role";
import { OrderListScreen } from "@/components/orders/order-screens";
export const metadata = { title: "Pesanan saya | Salvora Kitchen" };
export default function OrdersPage() { return <PublicShell><RequireRole role="BUYER"><OrderListScreen /></RequireRole></PublicShell>; }
