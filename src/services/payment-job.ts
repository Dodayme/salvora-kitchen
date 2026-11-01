import type { PrismaClient } from "../generated/prisma/client";
import type { createReconciliationService } from "./reconciliation";

export async function runPaymentBatch(db: PrismaClient, service: Pick<ReturnType<typeof createReconciliationService>, "reconcileOrder">, assertHeld: () => void, onlyOrderIds?: string[]) {
  const started = Date.now(), summary = { checked: 0, released: 0, unconfirmed: 0 };
  // Reuse the durable limiter table for per-order scheduling, not payment truth.
  // Native md5 only constructs a deterministic opaque queue key (not a secret).
  const candidates = await db.$queryRaw<Array<{ id: string }>>`
    SELECT o.id FROM "Order" o LEFT JOIN "RateLimit" r
      ON r.key=md5('salvora-payment-job:'||o.id)||md5(o.id||':salvora-payment-job')
    WHERE (o.status='AWAITING_PAYMENT' AND (o."paymentDeadline"<=clock_timestamp() OR EXISTS(SELECT 1 FROM "Payment" p WHERE p."orderId"=o.id))
      OR o.status='NEEDS_ATTENTION' AND EXISTS(SELECT 1 FROM "Payment" p WHERE p."orderId"=o.id AND p.status IN ('CREATED','PENDING','UNCONFIRMED')))
      AND (r."resetAt" IS NULL OR r."resetAt"<=clock_timestamp())
      AND (${onlyOrderIds === undefined} OR o.id=ANY(${onlyOrderIds ?? []}::text[]))
    ORDER BY r."resetAt" NULLS FIRST,o."paymentDeadline",o.id LIMIT 25`;
  for (const candidate of candidates) {
    if (Date.now() - started >= 50000) break;
    assertHeld();
    let delaySeconds = 60;
    try { const result = await service.reconcileOrder(candidate.id, "SCHEDULER"); summary.checked++; if (result.released) summary.released++; }
    catch { summary.checked++; summary.unconfirmed++; delaySeconds = 300; }
    assertHeld();
    await db.$executeRaw`INSERT INTO "RateLimit" (key,count,"resetAt") VALUES(md5('salvora-payment-job:'||${candidate.id})||md5(${candidate.id}||':salvora-payment-job'),1,clock_timestamp()+${delaySeconds}*interval '1 second') ON CONFLICT(key) DO UPDATE SET count="RateLimit".count+1,"resetAt"=EXCLUDED."resetAt"`;
  }
  return summary;
}
