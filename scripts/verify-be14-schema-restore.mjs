// TEST-only schema rehearsal. This is NOT a new-database/Prisma-deploy proof.
import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { databaseUrl } from '../src/lib/config/schema.ts';

const connectionString = databaseUrl(process.env, 'test'), url = new URL(connectionString);
assert.equal(url.port, '55433'); assert.equal(url.pathname, '/salvora_kitchen_test');
assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
const schema = `be14_fixture_${randomUUID().replaceAll('-', '')}`, identifier = `"${schema}"`;
const db = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
let created = false, passed = 0, success = false, phase = 'identity';
try {
  await db.connect();
  assert.deepEqual((await db.query('SELECT current_database() AS name, inet_server_port() AS port')).rows[0], { name: 'salvora_kitchen_test', port: 55433 });
  assert.equal((await db.query('SELECT count(*)::int AS count FROM pg_namespace WHERE nspname=$1', [schema])).rows[0].count, 0);
  await db.query(`CREATE SCHEMA ${identifier}`); created = true;
  await db.query(`SET search_path TO ${identifier}`);
  phase = 'migration_sql';
  for (const migration of ['202610230001_init', '202610230002_product_photos']) {
    // The initial public-schema declaration is deliberately omitted; all remaining
    // statements are unchanged and resolve into the newly created fixture schema.
    const sql = readFileSync(`prisma/migrations/${migration}/migration.sql`, 'utf8').replace('CREATE SCHEMA IF NOT EXISTS "public";', '');
    await db.query(sql);
  }
  assert.equal((await db.query('SELECT count(*)::int AS count FROM pg_tables WHERE schemaname=$1', [schema])).rows[0].count, 19);
  await db.query('INSERT INTO "Category" (id,name,"updatedAt") VALUES ($1,$2,now())', ['restore-category', 'BE14 synthetic restore']);
  await db.query('INSERT INTO "Product" (id,"categoryId",name,description,price,"physicalStock","updatedAt") VALUES ($1,$2,$3,$4,10000,5,now())', ['restore-product', 'restore-category', 'Restore product', 'Synthetic fixture only']);
  await assert.rejects(db.query('UPDATE "Product" SET "reservedStock"=6 WHERE id=$1', ['restore-product']), e => e.code === '23514'); passed++;
  const before = (await db.query('SELECT row_to_json(p)::text AS value FROM "Product" p ORDER BY id')).rows;
  phase = 'dump';
  const directory = resolve('.local/be14-results/schema-restore'); mkdirSync(directory, { recursive: true });
  const archive = join(directory, `${schema}.dump`), bin = process.env.SALVORA_POSTGRES_BIN ?? 'C:/Program Files/PostgreSQL/18/bin';
  const env = { ...process.env, PGHOST: url.hostname, PGPORT: '55433', PGDATABASE: 'salvora_kitchen_test', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGCONNECT_TIMEOUT: '5' };
  for (const key of ['PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS']) delete env[key];
  const run = (exe, args) => { const result = spawnSync(join(bin, exe + '.exe'), args, { env, windowsHide: true, stdio: 'ignore', timeout: 30000 }); assert.equal(result.status, 0); };
  run('pg_dump', ['--format=custom', '--schema', schema, '--no-owner', '--no-privileges', '--file', archive]);
  run('pg_restore', ['--list', archive]); passed++;
  // Only the exact random schema this run created is removed, never public or a DB.
  assert.ok(created && /^be14_fixture_[a-f0-9]{32}$/.test(schema));
  await db.query('SET search_path TO public'); await db.query(`DROP SCHEMA ${identifier} CASCADE`);
  phase = 'restore';
  run('pg_restore', ['--dbname', 'salvora_kitchen_test', '--no-owner', '--no-privileges', '--exit-on-error', archive]);
  await db.query(`SET search_path TO ${identifier}`);
  assert.deepEqual((await db.query('SELECT row_to_json(p)::text AS value FROM "Product" p ORDER BY id')).rows, before);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM pg_tables WHERE schemaname=$1', [schema])).rows[0].count, 19);
  await assert.rejects(db.query('UPDATE "Product" SET "reservedStock"=6 WHERE id=$1', ['restore-product']), e => e.code === '23514'); passed++;
  success = true;
} catch { /* No raw SQL, credentials or archive data printed. */ }
finally {
  if (created) try {
    assert.match(schema, /^be14_fixture_[a-f0-9]{32}$/);
    await db.query('ROLLBACK'); await db.query('SET search_path TO public'); await db.query(`DROP SCHEMA IF EXISTS ${identifier} CASCADE`);
  } catch { success = false; phase = 'cleanup'; }
  await db.end().catch(() => { success = false; });
}
console.log(JSON.stringify({ success, numPassedTests: passed, numFailedTests: success ? 0 : 1, phase: success ? 'complete' : phase, testResults: [] }));
if (!success) process.exitCode = 1;
