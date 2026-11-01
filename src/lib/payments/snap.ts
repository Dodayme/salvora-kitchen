import { z } from "zod";
import { ApiError } from "../api/errors";
import { PAYMENT_EXPIRY_MINUTES } from "../checkout/policy";

export const SNAP_SANDBOX_URL = "https://app.sandbox.midtrans.com/snap/v1/transactions";
export const MIN_SNAP_WINDOW_MS = 60000;
export type SnapInput = {
  providerOrderId: string; orderId: string; total: number; subtotal: number; discount: number; shippingFee: number;
  createdAt: Date; deadline: Date; requestedAt: Date; recipientName: string; phone: string;
  items: Array<{ productId: string; name: string; unitPrice: number; quantity: number }>;
};
export type SnapResult = { token: string; redirectUrl: string };
export interface SnapGateway { create(input: SnapInput): Promise<SnapResult> }
export class SnapFailure extends Error {
  constructor(public readonly reason: "SNAP_AUTH_REJECTED" | "SNAP_INVALID_AMOUNT" | "SNAP_UNCONFIRMED", public readonly definitive = false) { super(reason); }
}
export function validSnapResult(input: unknown): SnapResult {
  const parsed = z.object({ token: z.uuid(), redirectUrl: z.url() }).parse(input);
  const url = new URL(parsed.redirectUrl);
  if (url.origin !== "https://app.sandbox.midtrans.com" || url.username || url.password || url.search || url.hash || !/^\/snap\/v\d+\/(redirection|vtweb)\/[a-f0-9-]{36}$/.test(url.pathname) || !url.pathname.endsWith(`/${parsed.token}`)) throw new SnapFailure("SNAP_UNCONFIRMED");
  return parsed;
}
export function buildSnapPayload(input: SnapInput, appUrl: string) {
  const url = new URL(appUrl);
  const local = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((!local && url.protocol !== "https:") || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new ApiError(503, "ENV_NOT_CONFIGURED", "URL aplikasi untuk pembayaran belum valid.");
  if (input.deadline.getTime() - input.createdAt.getTime() !== PAYMENT_EXPIRY_MINUTES * 60000 || input.deadline.getTime() - input.requestedAt.getTime() < MIN_SNAP_WINDOW_MS) throw new ApiError(409, "PAYMENT_WINDOW_TOO_SHORT", "Waktu pembayaran yang tersisa tidak cukup untuk membuat instruksi baru.");
  const amount = z.number().int().min(0).max(2147483647);
  amount.positive().parse(input.total); amount.positive().parse(input.subtotal); amount.parse(input.discount); amount.parse(input.shippingFee);
  z.string().min(1).max(50).regex(/^[A-Za-z0-9_.~-]+$/).parse(input.providerOrderId);
  const itemDetails = input.items.map((item, index) => ({ id: `item-${index + 1}`, name: Array.from(item.name.replace(/[|\u0000-\u001f]/g, " ")).slice(0, 50).join(""), price: amount.positive().parse(item.unitPrice), quantity: amount.positive().parse(item.quantity) }));
  const subtotal = itemDetails.reduce((sum, item) => sum + BigInt(item.price) * BigInt(item.quantity), 0n);
  if (!itemDetails.length || subtotal !== BigInt(input.subtotal) || BigInt(input.total) !== subtotal - BigInt(input.discount) + BigInt(input.shippingFee)) throw new ApiError(409, "PAYMENT_AMOUNT_MISMATCH", "Rincian pembayaran tidak cocok dengan pesanan.");
  if (input.discount) itemDetails.push({ id: "new-buyer-discount", name: "Voucher pembeli baru", price: -input.discount, quantity: 1 });
  if (input.shippingFee) itemDetails.push({ id: "manual-delivery", name: "Ongkir delivery manual", price: input.shippingFee, quantity: 1 });
  const startTime = new Date(input.createdAt.getTime() + 7 * 3600000).toISOString().slice(0, 19).replace("T", " ") + " +0700";
  return {
    transaction_details: { order_id: input.providerOrderId, gross_amount: input.total }, item_details: itemDetails,
    customer_details: { first_name: input.recipientName, phone: input.phone },
    callbacks: { finish: `${url.origin}/payment/finish` },
    expiry: { start_time: startTime, unit: "minutes", duration: PAYMENT_EXPIRY_MINUTES },
    send_email: { token: { enabled: false }, reminder: { enabled: false } },
  };
}
export async function boundedProviderJson(response: Response) {
  if (!response.body) throw new SnapFailure("SNAP_UNCONFIRMED");
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 65536) { await reader.cancel(); throw new SnapFailure("SNAP_UNCONFIRMED"); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
// Native fetch avoids copying SDK/dependency/configuration from LanggananKu.
export function createSnapGateway(settings: { serverKey: string; appUrl: string; notificationUrl?: string }, transport: typeof fetch = fetch): SnapGateway {
  if (!settings.serverKey.startsWith("SB-Mid-server-") || /REPLACE|PLACEHOLDER/.test(settings.serverKey)) throw new ApiError(503, "ENV_NOT_CONFIGURED", "Server key Midtrans Sandbox belum valid.");
  if (settings.notificationUrl) {
    const url = new URL(settings.notificationUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/api/webhooks/midtrans") throw new ApiError(503, "ENV_NOT_CONFIGURED", "URL webhook pembayaran belum valid.");
  }
  return { async create(input) {
    if (input.deadline.getTime() - Date.now() < 20000) throw new ApiError(409, "PAYMENT_WINDOW_TOO_SHORT", "Tenggat pembayaran terlalu dekat untuk mengirim permintaan baru.");
    const payload = buildSnapPayload(input, settings.appUrl);
    try {
      const response = await transport(SNAP_SANDBOX_URL, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(settings.serverKey + ":").toString("base64")}`, "Content-Type": "application/json", Accept: "application/json", ...(settings.notificationUrl ? { "X-Override-Notification": settings.notificationUrl } : {}) }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "error" });
      const body = await boundedProviderJson(response);
      if (response.status === 401 && z.object({ error_messages: z.array(z.string()).min(1) }).safeParse(body).success) throw new SnapFailure("SNAP_AUTH_REJECTED", true);
      const invalidAmount = z.object({ error_messages: z.tuple([z.literal("transaction_details.gross_amount is not equal to the sum of item_details")]) }).safeParse(body);
      if (response.status === 400 && invalidAmount.success) throw new SnapFailure("SNAP_INVALID_AMOUNT", true);
      if (response.status !== 201) throw new SnapFailure("SNAP_UNCONFIRMED");
      const result = z.object({ token: z.string(), redirect_url: z.string() }).parse(body);
      return validSnapResult({ token: result.token, redirectUrl: result.redirect_url });
    } catch (error) { if (error instanceof SnapFailure) throw error; throw new SnapFailure("SNAP_UNCONFIRMED"); }
  } };
}
