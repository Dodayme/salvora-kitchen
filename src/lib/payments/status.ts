import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ApiError } from "../api/errors";
import { boundedProviderJson } from "./snap";
import type { PaymentStatus } from "../../generated/prisma/enums";

const reference = z.string().min(1).max(50).regex(/^[A-Za-z0-9_.~-]+$/);
const money = z.string().max(32).regex(/^(0|[1-9]\d{0,9})(?:\.\d{1,2})?$/);
export const providerStatusSchema = z.object({
  order_id: reference, transaction_id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_.~-]+$/),
  status_code: z.string().regex(/^\d{3}$/), gross_amount: money,
  transaction_status: z.string().min(1).max(64).regex(/^[A-Za-z_]+$/),
  currency: z.string().max(3).optional(), fraud_status: z.string().max(32).optional(),
  payment_type: z.string().max(64).regex(/^[A-Za-z0-9_-]+$/).optional(),
  transaction_time: z.string().max(32).optional(), settlement_time: z.string().max(32).optional(),
  signature_key: z.string().regex(/^[a-fA-F0-9]{128}$/).optional(),
});
export const notificationSchema = providerStatusSchema.extend({ signature_key: z.string().regex(/^[a-fA-F0-9]{128}$/) });
export type ProviderStatus = z.output<typeof providerStatusSchema>;
export interface StatusGateway { get(reference: string): Promise<ProviderStatus | null> }
export function rupiah(value: string) {
  money.parse(value);
  const [whole, fraction = ""] = value.split(".");
  if (/[1-9]/.test(fraction) || BigInt(whole) > 2147483647n) throw new ApiError(422, "PAYMENT_AMOUNT_INVALID", "Nominal pembayaran tidak valid.");
  return Number(whole);
}
export function verifyNotificationSignature(value: ProviderStatus, serverKey: string) {
  const signature = value.signature_key ?? "";
  const expected = createHash("sha512").update(value.order_id + value.status_code + value.gross_amount + serverKey).digest("hex");
  if (!/^[a-fA-F0-9]{128}$/.test(signature) || !timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) throw new ApiError(403, "INVALID_SIGNATURE", "Signature notifikasi tidak valid.");
}
export function providerTime(value: string | undefined) {
  if (!value) return null;
  if (!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)) return null;
  const date = new Date(value.replace(" ", "T") + "+07:00");
  if (!Number.isFinite(date.getTime()) || new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 19).replace("T", " ") !== value) return null;
  return date;
}
export function mapProviderStatus(value: ProviderStatus): { status: PaymentStatus; known: boolean; providerStatus: string } {
  const status = value.transaction_status.toLowerCase(), fraud = value.fraud_status?.toLowerCase();
  if (status === "settlement" && value.status_code === "200" && (!fraud || fraud === "accept")) return { status: "SUCCESS", known: true, providerStatus: status };
  if (status === "capture" && value.status_code === "200" && value.payment_type === "credit_card" && fraud === "accept") return { status: "SUCCESS", known: true, providerStatus: status };
  if (status === "settlement" || status === "capture" && (value.status_code !== "200" || fraud !== "challenge")) return { status: "UNCONFIRMED", known: false, providerStatus: status };
  if (["refund", "partial_refund", "reversal"].includes(status) && value.status_code !== "200") return { status: "UNCONFIRMED", known: false, providerStatus: status };
  const statuses: Record<string, PaymentStatus> = { pending: "PENDING", deny: "FAILED", failure: "FAILED", cancel: "CANCELLED", expire: "EXPIRED", refund: "REFUNDED", partial_refund: "PARTIALLY_REFUNDED", reversal: "REVERSED", authorize: "UNCONFIRMED", capture: "UNCONFIRMED", settlement: "UNCONFIRMED" };
  return { status: statuses[status] ?? "UNCONFIRMED", known: Object.hasOwn(statuses, status), providerStatus: Object.hasOwn(statuses, status) ? status : "unknown" };
}
export function createStatusGateway(serverKey: string, transport: typeof fetch = fetch): StatusGateway {
  if (!serverKey.startsWith("SB-Mid-server-") || /REPLACE|PLACEHOLDER/i.test(serverKey)) throw new ApiError(503, "ENV_NOT_CONFIGURED", "Server key Sandbox belum valid.");
  return { async get(providerOrderId) {
    reference.parse(providerOrderId);
    try {
      const response = await transport(`https://api.sandbox.midtrans.com/v2/${encodeURIComponent(providerOrderId)}/status`, { method: "GET", headers: { Authorization: `Basic ${Buffer.from(serverKey + ":").toString("base64")}`, Accept: "application/json" }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (response.status === 404) return null;
      if (response.status !== 200) throw new Error("Status unavailable");
      const raw = await boundedProviderJson(response);
      if (z.object({ status_code: z.literal("404") }).safeParse(raw).success) return null;
      const result = providerStatusSchema.parse(raw);
      if (result.signature_key) verifyNotificationSignature(result, serverKey);
      return result;
    } catch { throw new ApiError(503, "MIDTRANS_STATUS_UNAVAILABLE", "Status pembayaran belum dapat dipastikan. Coba kembali nanti.", undefined, 3); }
  } };
}
