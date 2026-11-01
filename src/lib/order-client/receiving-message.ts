import type { OrderStatus } from "@/lib/contracts/status";

export function receivingMessage(order: { status: OrderStatus; shipping: { mode: string; label: string } }) {
  if (order.shipping.mode !== "PICKUP") return order.shipping.label;
  const messages: Record<OrderStatus, string> = {
    AWAITING_PAYMENT: "Ambil sendiri di Salvora Kitchen — gratis. Selesaikan pembayaran terlebih dahulu.",
    PROCESSING: "Pesanan sedang disiapkan. Tunggu status Siap diambil sebelum datang.",
    READY_FOR_PICKUP: "Pesanan siap diambil di Salvora Kitchen. Konfirmasikan lokasi dan waktu pengambilan dengan toko.",
    COMPLETED: "Pesanan ambil sendiri sudah selesai. Terima kasih telah berbelanja di Salvora Kitchen.",
    EXPIRED: "Pesanan kedaluwarsa. Buat pesanan baru jika ingin memesan kembali.",
    NEEDS_ATTENTION: "Pesanan perlu penanganan. Hubungi toko sebelum datang mengambil pesanan.",
    SHIPPED: "Hubungi toko untuk memastikan status pengambilan pesanan.",
  };
  return messages[order.status];
}
