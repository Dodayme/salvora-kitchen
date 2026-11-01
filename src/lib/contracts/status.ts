export const orderStatuses = ["AWAITING_PAYMENT", "PROCESSING", "SHIPPED", "READY_FOR_PICKUP", "COMPLETED", "EXPIRED", "NEEDS_ATTENTION"] as const;
export const paymentStatuses = ["CREATED", "PENDING", "UNCONFIRMED", "SUCCESS", "FAILED", "CANCELLED", "EXPIRED", "REFUNDED", "PARTIALLY_REFUNDED", "REVERSED"] as const;
export type OrderStatus = typeof orderStatuses[number];
export type PaymentStatus = typeof paymentStatuses[number];
export const orderStatusLabels: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "Menunggu Pembayaran", PROCESSING: "Diproses", SHIPPED: "Sedang diantar", READY_FOR_PICKUP: "Siap diambil", COMPLETED: "Selesai", EXPIRED: "Kedaluwarsa", NEEDS_ATTENTION: "Perlu Penanganan",
};
export const paymentStatusLabels: Record<PaymentStatus, string> = {
  CREATED: "Dibuat", PENDING: "Menunggu", UNCONFIRMED: "Belum Terkonfirmasi", SUCCESS: "Sukses", FAILED: "Gagal", CANCELLED: "Dibatalkan", EXPIRED: "Kedaluwarsa", REFUNDED: "Refund", PARTIALLY_REFUNDED: "Refund Sebagian", REVERSED: "Reversal",
};
