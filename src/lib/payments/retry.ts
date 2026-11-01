type Evidence = { source: string; verification: string; resultingStatus: string | null; providerStatus?: string | null; errorCode: string | null };
type Attempt = { status: string; midtransTransactionId?: string | null; providerStatus?: string | null; events?: Evidence[] };
export const unpaidTerminal = new Set(["FAILED", "CANCELLED", "EXPIRED"]);
export function definitiveSnapRejection(payment: Attempt) {
  return payment.status === "FAILED" && !payment.midtransTransactionId && !payment.providerStatus && !!payment.events?.some(e => e.source === "SNAP_REQUEST" && e.verification === "REJECTED" && e.resultingStatus === "FAILED" && ["SNAP_AUTH_REJECTED", "SNAP_INVALID_AMOUNT"].includes(e.errorCode ?? ""));
}
export function verifiedTerminal(payment: Attempt) {
  return definitiveSnapRejection(payment) || unpaidTerminal.has(payment.status) && !!payment.midtransTransactionId && !!payment.events?.some(e => ["WEBHOOK", "STATUS_API", "SCHEDULER"].includes(e.source) && e.verification === "VERIFIED" && e.resultingStatus === payment.status && e.providerStatus === payment.providerStatus && !e.errorCode);
}
