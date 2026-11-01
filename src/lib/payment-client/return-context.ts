import { z } from "zod";
import type { RecoveryStorage } from "@/lib/checkout-client/recovery";
const key = "salvora-payment-return-v1", id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const record = z.strictObject({ ownerId: id, orderId: id, version: z.literal(1) });
export function createPaymentReturn(storage: () => RecoveryStorage) {
  return {
    save(ownerId: string, orderId: string) { storage().setItem(key, JSON.stringify(record.parse({ ownerId, orderId, version: 1 }))); },
    load(ownerId: string) { const raw = storage().getItem(key); if (raw === null) return null; const value = record.parse(JSON.parse(raw)); if (value.ownerId !== ownerId) { storage().removeItem(key); return null; } return value.orderId; },
    clear() { storage().removeItem(key); },
  };
}
export function clearPaymentReturn() { try { window.sessionStorage.removeItem(key); } catch { /* unavailable storage cannot supply a return context */ } }
