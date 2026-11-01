import { recoverySchema, type CheckoutRecovery } from "./model";
import { clearPaymentReturn } from "@/lib/payment-client/return-context";
export const CHECKOUT_RECOVERY_KEY = "salvora-checkout-recovery-v1";
export type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function createCheckoutJournal(storage: () => RecoveryStorage) {
  return {
    load(ownerId: string): CheckoutRecovery | null {
      const raw = storage().getItem(CHECKOUT_RECOVERY_KEY);
      if (raw === null) return null;
      const record = recoverySchema.parse(JSON.parse(raw));
      if (record.ownerId !== ownerId) { storage().removeItem(CHECKOUT_RECOVERY_KEY); return null; }
      return record;
    },
    save(record: CheckoutRecovery) { storage().setItem(CHECKOUT_RECOVERY_KEY, JSON.stringify(recoverySchema.parse(record))); },
    clear() { storage().removeItem(CHECKOUT_RECOVERY_KEY); },
  };
}
export const browserCheckoutJournal = () => createCheckoutJournal(() => window.sessionStorage);
/** Explicit auth changes/401 clear references. Foreground same-account session checks do not. */
export function clearCheckoutRecovery() { clearPaymentReturn(); try { window.sessionStorage.removeItem(CHECKOUT_RECOVERY_KEY); } catch { /* unavailable storage cannot be used for a new confirmation */ } }
