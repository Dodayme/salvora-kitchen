// Existing TEST DB only, no migrate/reset. Regression includes the existing
// idempotent seed test; schema-restore touches only its own new fixture schema.
import nextEnv from '@next/env';
import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { databaseUrl } from '../src/lib/config/schema.ts';

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const mode = process.argv[2] ?? 'integration';
const regressionFiles = ['auth', 'buyer', 'catalog', 'checkout', 'integrity', 'payments', 'reconciliation', 'vouchers', 'webhook'].map(name => `tests/database/${name}.test.ts`);
const tables = ['User', 'Session', 'RateLimit', 'Address', 'Category', 'Product', 'ProductPhoto', 'Cart', 'CartItem', 'CheckoutQuote', 'Discount', 'Order', 'OrderItem', 'StockReservation', 'Payment', 'PaymentApplication', 'PaymentEvent', 'Rating', 'OrderStatusHistory'];
let client, before, phase = 'target_validation';
async function fingerprint() {
  const value = {};
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    for (const table of tables) {
      // Fixed identifiers only. Row contents never leave PostgreSQL; only hashes/counts.
      value[table] = (await client.query(`SELECT count(*)::int AS count, md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text), '')) AS digest FROM "${table}" t`)).rows[0];
    }
  } finally { await client.query('ROLLBACK'); }
  return value;
}
try {
  if (!['integration', 'regression', 'http', 'schema-restore'].includes(mode) || process.argv.length > 3) throw new Error('MODE_REJECTED');
  const connectionString = databaseUrl(process.env, 'test');
  const target = new URL(connectionString);
  if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '55433' || target.pathname !== '/salvora_kitchen_test') throw new Error('TARGET_REJECTED');
  client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000, options: '-c default_transaction_read_only=on -c statement_timeout=15000' });
  phase = 'connection'; await client.connect();
  const identity = (await client.query('SELECT current_database() AS name, inet_server_port() AS port')).rows[0];
  if (identity.name !== 'salvora_kitchen_test' || identity.port !== 55433) throw new Error('IDENTITY_REJECTED');
  phase = 'schema_check';
  const migrations = (await client.query('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows;
  if (!['202610230001_init', '202610230002_product_photos'].every(name => migrations.some(row => row.migration_name === name))) throw new Error('MIGRATIONS_NOT_READY');
  before = await fingerprint();
  phase = 'integration_tests';
  const args = ['http', 'schema-restore'].includes(mode) ? ['--import', 'tsx', mode === 'http' ? 'scripts/verify-be14-http.mjs' : 'scripts/verify-be14-schema-restore.mjs'] : ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.db.config.ts', ...(mode === 'regression' ? regressionFiles : ['tests/database/be14-integration.test.ts']), '--reporter=json'];
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(), windowsHide: true, encoding: 'utf8', timeout: 180000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, NODE_ENV: 'test', SALVORA_DATABASE_TARGET: 'test', DATABASE_URL: connectionString, TEST_DATABASE_URL: connectionString, MIDTRANS_IS_PRODUCTION: 'false', MIDTRANS_SERVER_KEY: 'SB-Mid-server-be14-mock-only', NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: 'SB-Mid-client-be14-mock-only', AUTH_SECRET: randomBytes(32).toString('hex') },
  });
  // Never forward raw Vitest/driver stdout/stderr, even on failures.
  let report;
  try { report = JSON.parse(result.stdout); } catch { /* Report only a safe classification below. */ }
  const after = await fingerprint();
  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  const changedTables = tables.filter(table => JSON.stringify(before[table]) !== JSON.stringify(after[table])).map(table => ({ table, beforeCount: before[table].count, afterCount: after[table].count }));
  const summary = { completedAt: new Date().toISOString(), mode, target: 'salvora_kitchen_test', port: 55433, passed: report?.numPassedTests ?? null, failed: report?.numFailedTests ?? null, phase: report?.phase ?? null, subprocessCode: ['EPERM', 'EACCES', 'ETIMEDOUT'].includes(result.error?.code) ? result.error.code : null, changedTables, existingRowsAndCleanup: unchanged ? 'VERIFIED_UNCHANGED' : 'MISMATCH_REQUIRES_REVIEW', rawOutputSuppressed: true, provider: 'MOCK_ONLY', taskChanged: false };
  console.log(JSON.stringify(summary));
  // New proof only; never overwrite backups or earlier run evidence.
  mkdirSync('.local/be14-results', { recursive: true });
  writeFileSync(`.local/be14-results/${mode}-${Date.now()}.json`, JSON.stringify(summary), { flag: 'wx' });
  if (result.error || result.status !== 0 || !report?.success || !unchanged) {
    process.exitCode = 1;
    if (report) console.log(JSON.stringify({ failedTests: report.testResults.flatMap(file => file.assertionResults.filter(test => test.status === 'failed').map(test => test.title)) }));
  }
} catch (error) {
  const allowed = new Set(['EACCES', 'EPERM', 'ECONNREFUSED', 'ETIMEDOUT', '28P01', '42P01', '42501', '57014']);
  const codes = [error?.code, ...(error?.errors ?? []).map(item => item.code)].filter(code => allowed.has(code));
  console.log(JSON.stringify({ status: 'BE14_CHECK_FAILED', phase, codes: [...new Set(codes)], rawDetailsSuppressed: true }));
  process.exitCode = 1;
} finally { if (client) await client.end().catch(() => { process.exitCode = 1; }); }
