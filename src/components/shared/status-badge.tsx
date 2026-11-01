import { Badge } from "@/components/ui/badge";
import { orderStatusLabels, paymentStatusLabels, type OrderStatus, type PaymentStatus } from "@/lib/contracts/status";
import { cn } from "@/lib/utils";
const tones = { neutral: "bg-muted text-foreground", success: "bg-success-surface text-success", warning: "bg-warning-surface text-warning", info: "bg-info-surface text-info", danger: "bg-danger-surface text-destructive" };
export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: keyof typeof tones }) { return <Badge variant="outline" className={cn("border-transparent px-3 py-1 leading-relaxed", tones[tone])}>{label}</Badge>; }
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone = status === "COMPLETED" ? "success" : status === "NEEDS_ATTENTION" ? "danger" : status === "AWAITING_PAYMENT" ? "warning" : ["PROCESSING", "SHIPPED", "READY_FOR_PICKUP"].includes(status) ? "info" : "neutral";
  return <StatusBadge tone={tone} label={orderStatusLabels[status]} />;
}
export function PaymentStatusBadge({ status }: { status: PaymentStatus | null }) {
  const tone = status === "SUCCESS" ? "success" : ["FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "REVERSED"].includes(status ?? "") ? "danger" : ["CREATED", "PENDING", "UNCONFIRMED"].includes(status ?? "") ? "warning" : "neutral";
  return <StatusBadge tone={tone} label={status ? paymentStatusLabels[status] : "Belum ada pembayaran"} />;
}
