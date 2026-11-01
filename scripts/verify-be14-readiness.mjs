// Read-only SQL and sanitized local evidence; no provider calls or task mutation.
import nextEnv from '@next/env';
import pg from 'pg';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { databaseUrl, snapConfig, paymentConfig } from '../src/lib/config/schema.ts';
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const report = { observedAt: new Date().toISOString(), readOnly: true };
try {
  for (const kind of ['app', 'test']) {
    const connectionString = databaseUrl(process.env, kind), url = new URL(connectionString);
    if (url.port !== '55433' || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('TARGET_REJECTED');
    if (kind === 'app' && url.pathname !== '/salvora_kitchen_dev') throw new Error('TARGET_REJECTED');
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000, options: '-c default_transaction_read_only=on -c statement_timeout=10000' });
    try {
      await client.connect();
      const identity = (await client.query('SELECT current_database() AS name, inet_server_port() AS port')).rows[0];
      if (identity.name !== (kind === 'app' ? 'salvora_kitchen_dev' : 'salvora_kitchen_test') || identity.port !== 55433) throw new Error('IDENTITY_REJECTED');
      if (kind === 'app') report.dev = { ...identity, queue: (await client.query(`SELECT
        (SELECT count(*)::int FROM "Order" WHERE status='AWAITING_PAYMENT') AS awaiting,
        (SELECT count(*)::int FROM "Order" WHERE status='AWAITING_PAYMENT' AND "paymentDeadline"<=now()) AS overdue,
        (SELECT count(*)::int FROM "StockReservation" WHERE status='RESERVED' AND "expiresAt"<=now()) AS expired_reservations,
        (SELECT count(*)::int FROM "Payment" WHERE status IN ('CREATED','PENDING','UNCONFIRMED')) AS active_payments,
        (SELECT count(*)::int FROM "Order" WHERE status='NEEDS_ATTENTION') AS attention`)).rows[0] };
      else {
        report.test = { ...identity, roleCanConnectDev: (await client.query("SELECT has_database_privilege(current_user,'salvora_kitchen_dev','CONNECT') AS allowed")).rows[0].allowed };
        report.providerArtifacts = [];
        const artifacts = ['midtrans-sandbox-proof.json', 'midtrans-webhook-proof.json'];
        if (existsSync('.local/be14-provider')) for (const entry of readdirSync('.local/be14-provider', { withFileTypes: true })) {
          if (entry.isDirectory() && /^[a-f0-9-]{36}$/.test(entry.name) && existsSync(`.local/be14-provider/${entry.name}/proof.json`)) artifacts.push(`be14-provider/${entry.name}/proof.json`);
        }
        for (const filename of artifacts) {
          const proof = JSON.parse(readFileSync(`.local/${filename}`, 'utf8'));
          if (proof.database !== 'salvora_kitchen_test') throw new Error('PROOF_TARGET_REJECTED');
          const record = (await client.query(`SELECT p.status::text AS status, o.status::text AS order_status, p."expiresAt"<=now() AS local_deadline_passed,
            EXISTS(SELECT 1 FROM "PaymentApplication" a WHERE a."paymentId"=p.id) AS applied,
            EXISTS(SELECT 1 FROM "PaymentEvent" e WHERE e."paymentId"=p.id AND e.source='WEBHOOK' AND e.verification='VERIFIED' AND e."resultingStatus"='SUCCESS') AS verified_success_webhook
            FROM "Payment" p JOIN "Order" o ON o.id=p."orderId" WHERE p.id=$1 AND p."orderId"=$2`, [proof.paymentId, proof.orderId])).rows[0];
          report.providerArtifacts.push({ artifact: filename, storedPaymentStatus: record?.status ?? 'NOT_FOUND', storedOrderStatus: record?.order_status ?? 'NOT_FOUND', localDeadlinePassed: record?.local_deadline_passed ?? null, applied: record?.applied ?? false, verifiedSuccessWebhook: record?.verified_success_webhook ?? false, proofClaimsSimulated: proof.paymentSimulated === true || proof.manualSimulation === true, proofClaimsWebhookVerified: proof.webhookVerified === true });
        }
      }
    } finally { await client.end(); }
  }
  try { snapConfig(process.env); report.snapConfigurationValid = true; } catch { report.snapConfigurationValid = false; }
  try { paymentConfig(process.env); report.httpsWebhookConfigurationValid = true; } catch { report.httpsWebhookConfigurationValid = false; }
  report.status = 'VERIFIED';
} catch { report.status = 'READINESS_FAILED'; process.exitCode = 1; }
console.log(JSON.stringify(report));
mkdirSync('.local/be14-results', { recursive: true });
writeFileSync(`.local/be14-results/readiness-${Date.now()}.json`, JSON.stringify(report), { flag: 'wx' });
