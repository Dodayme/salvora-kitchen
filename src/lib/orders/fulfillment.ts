import { ApiError } from "../api/errors";
import type { FulfillmentInput } from "./validation";

type FulfillmentOrder = {
  status: string; shippingMode?: string; total: number; currency: string; paymentDeadline: Date;
  application: { paymentId: string; payment: { id: string; status: string; paidAt: Date | null; midtransTransactionId: string | null; amount: number; currency: string } } | null;
  payments: Array<{ id: string; status: string }>;
  items: Array<{ reservation: { status: string } | null }>;
};
export function assertFulfillment(order: FulfillmentOrder, input: FulfillmentInput, completionEnabled: boolean) {
  if (order.status !== input.expectedStatus) throw new ApiError(409, "ORDER_STATUS_CONFLICT", "Status pesanan sudah berubah. Muat ulang detail pesanan.");
  const readyStatus = order.shippingMode === "PICKUP" ? "READY_FOR_PICKUP" : "SHIPPED";
  if (!(order.status === "PROCESSING" && input.status === readyStatus || order.status === readyStatus && input.status === "COMPLETED")) throw new ApiError(409, "ORDER_TRANSITION_INVALID", "Perubahan status pesanan tidak diizinkan.");
  const applied = order.application?.payment;
  if (!applied || applied.id !== order.application?.paymentId || applied.status !== "SUCCESS" || !applied.paidAt || applied.paidAt > order.paymentDeadline || !applied.midtransTransactionId || applied.amount !== order.total || applied.currency !== order.currency || !order.items.length || order.items.some(i => i.reservation?.status !== "CONSUMED") || order.payments.some(p => p.id !== applied.id && ["CREATED", "PENDING", "UNCONFIRMED", "SUCCESS", "REFUNDED", "PARTIALLY_REFUNDED", "REVERSED"].includes(p.status))) throw new ApiError(409, "ORDER_PAYMENT_NOT_FULFILLABLE", "Pembayaran atau penerapan pesanan perlu diperiksa sebelum pemenuhan.");
  if (input.status === "COMPLETED") {
    if (!completionEnabled) throw new ApiError(409, "RECEIPT_POLICY_PENDING", "Aturan konfirmasi penerimaan belum ditetapkan.");
    if (input.receiptConfirmed !== true || !input.note) throw new ApiError(422, "RECEIPT_CONFIRMATION_REQUIRED", "Konfirmasi penerimaan dan catatan admin diperlukan.");
  } else if (input.receiptConfirmed !== undefined) throw new ApiError(422, "RECEIPT_CONFIRMATION_INVALID", "Konfirmasi penerimaan hanya digunakan saat menyelesaikan pesanan.");
}
