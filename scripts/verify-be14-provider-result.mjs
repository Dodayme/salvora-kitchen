// Verify one explicitly authorized provider run: read-only TEST SQL + Sandbox GET.
// Never calls reconciliation, creates a charge, applies a payment or logs raw data.
import nextEnv from '@next/env';
import pg from 'pg';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { databaseUrl, snapConfig } from '../src/lib/config/schema.ts';
import { createStatusGateway, rupiah, providerTime } from '../src/lib/payments/status.ts';
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const run = process.argv[2];
assert.match(run ?? '', /^[a-f0-9-]{36}$/); assert.equal(process.argv.length, 3);
const directory = `.local/be14-provider/${run}`, proof = JSON.parse(readFileSync(`${directory}/proof.json`, 'utf8'));
let client, phase = 'target', success = false, summary;
try {
  const connectionString = databaseUrl(process.env, 'test'), url = new URL(connectionString);
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname)); assert.equal(url.port, '55433'); assert.equal(url.pathname, '/salvora_kitchen_test');
  assert.equal(proof.database, 'salvora_kitchen_test'); assert.equal(proof.amount, 14000);
  client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000, options: '-c default_transaction_read_only=on -c statement_timeout=10000' });
  await client.connect(); await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.deepEqual((await client.query('SELECT current_database() AS name, inet_server_port() AS port')).rows[0], { name: 'salvora_kitchen_test', port: 55433 });
  phase = 'database_evidence';
  const row = (await client.query(`SELECT p.status::text AS payment_status,p.amount,p.currency,p.channel,p."providerOrderId",p."midtransTransactionId",p."paidAt",p."expiresAt",o.status::text AS order_status,o.total,o.discount,o."shippingFee",u."isFirstPurchase" AS first_purchase,
    (SELECT count(*)::int FROM "Payment" WHERE "orderId"=o.id) AS payment_attempts,
    (SELECT count(*)::int FROM "PaymentApplication" WHERE "orderId"=o.id AND "paymentId"=p.id) AS applications,
    (SELECT count(*)::int FROM "PaymentEvent" WHERE "paymentId"=p.id AND source='WEBHOOK' AND verification='VERIFIED' AND "resultingStatus"='SUCCESS') AS success_webhooks,
    (SELECT count(*)::int FROM "OrderStatusHistory" WHERE "orderId"=o.id AND "fromStatus"='AWAITING_PAYMENT' AND "toStatus"='PROCESSING' AND actor='SYSTEM') AS processing_transitions,
    pr."physicalStock" AS physical_stock,pr."reservedStock" AS reserved_stock,oi.quantity,sr.status::text AS reservation_status,
    d.status::text AS voucher_status,(d."usedOrderId"=o.id) AS voucher_matches_order,(d."reservedOrderId" IS NULL) AS voucher_not_reserved
    FROM "Payment" p JOIN "Order" o ON o.id=p."orderId" JOIN "User" u ON u.id=o."userId"
    JOIN "OrderItem" oi ON oi."orderId"=o.id JOIN "Product" pr ON pr.id=oi."productId" JOIN "StockReservation" sr ON sr."orderItemId"=oi.id
    JOIN "Discount" d ON d.id=o."discountId"
    WHERE p.id=$1 AND o.id=$2 AND o."userId"=$3 AND pr.id=$4`, [proof.paymentId, proof.orderId, proof.userId, proof.productId])).rows[0];
  assert.ok(row); assert.equal(row.payment_status, 'SUCCESS'); assert.equal(row.order_status, 'PROCESSING');
  assert.equal(row.amount,14000); assert.equal(row.total,14000); assert.equal(row.currency,'IDR'); assert.equal(row.discount,1000); assert.equal(row.shippingFee,10000);
  assert.equal(row.payment_attempts,1); assert.equal(row.applications,1); assert.equal(row.processing_transitions,1); assert.ok(row.success_webhooks>=1);
  assert.equal(row.physical_stock,0); assert.equal(row.reserved_stock,0); assert.equal(row.quantity,1); assert.equal(row.reservation_status,'CONSUMED');
  assert.equal(row.voucher_status,'USED'); assert.equal(row.voucher_matches_order,true); assert.equal(row.voucher_not_reserved,true); assert.equal(row.first_purchase,false);
  assert.ok(row.paidAt && row.paidAt<=row.expiresAt);
  phase = 'provider_get_status';
  let banks=[];
  const transport = async (...args) => {
    const response = await fetch(...args);
    if (response.status===200) {
      const body = await response.clone().json();
      banks = [...new Set((body.va_numbers ?? []).map(va=>va.bank).filter(bank=>typeof bank==='string' && /^[a-z]{2,12}$/.test(bank)))];
    }
    return response;
  };
  const latest = await createStatusGateway(snapConfig(process.env).serverKey, transport).get(row.providerOrderId);
  assert.ok(latest); assert.equal(latest.order_id,row.providerOrderId); assert.equal(latest.transaction_id,row.midtransTransactionId);
  assert.equal(latest.transaction_status,'settlement'); assert.equal(latest.status_code,'200'); assert.equal(latest.payment_type,'bank_transfer');
  assert.equal(rupiah(latest.gross_amount),14000); assert.ok(latest.currency===undefined || latest.currency==='IDR');
  const paid = providerTime(latest.settlement_time); assert.ok(paid && paid<=row.expiresAt);
  summary = { observedAt:new Date().toISOString(),run,provider:'MIDTRANS_SANDBOX',providerStatus:latest.transaction_status,channel:latest.payment_type,banks,amount:14000,currency:'IDR',referenceAndTransactionMatched:true,paidWithinDeadline:true,
    paymentStatus:row.payment_status,orderStatus:row.order_status,paymentAttempts:row.payment_attempts,applications:row.applications,verifiedSuccessWebhookEvents:row.success_webhooks,processingTransitions:row.processing_transitions,
    physicalStock:row.physical_stock,reservedStock:row.reserved_stock,reservationStatus:row.reservation_status,voucherStatus:row.voucher_status,firstPurchase:row.first_purchase,localProxyHttp200Count:proof.webhookHttp200Count ?? null,readOnly:true,chargeCreated:false,manualReconciliation:false };
  success=true;
} catch { /* No references, VA numbers, key, raw errors or provider bodies printed. */ }
finally { if(client) await client.end().catch(()=>{success=false;phase='disconnect';}); }
const report={...(summary??{}),success,phase:success?'complete':phase};
const resultFile=`verification-${Date.now()}.json`;
writeFileSync(`${directory}/${resultFile}`,JSON.stringify(report),{flag:'wx'});
if(success) {
  // Update only this run's private evidence, never payment/database state.
  const current=JSON.parse(readFileSync(`${directory}/proof.json`,'utf8'));
  writeFileSync(`${directory}/proof.json`,JSON.stringify({...current,initialPaymentStatus:current.initialPaymentStatus??current.paymentStatus,paymentStatus:report.paymentStatus,paymentSimulated:true,webhookVerified:true,providerVerifiedAt:report.observedAt,verificationFile:resultFile},null,2));
}
console.log(JSON.stringify(report)); if(!success)process.exitCode=1;
