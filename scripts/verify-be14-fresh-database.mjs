// Authorized disposable databases only. Never reset/migrate existing dev/test DBs.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { seedDemoCatalog } from '../prisma/seed-catalog.ts';

const root = resolve('.'), id = randomBytes(8).toString('hex');
const names = [`salvora_be14_fresh_${id}`, `salvora_be14_restore_${id}`], role = `salvora_be14_role_${id}`, password = randomBytes(32).toString('hex');
const directory = resolve('.local/be14-results', `fresh-${id}`), created = [];
const tables = ['User','Session','RateLimit','Address','Category','Product','ProductPhoto','Cart','CartItem','CheckoutQuote','Discount','Order','OrderItem','StockReservation','Payment','PaymentApplication','PaymentEvent','Rating','OrderStatusHistory'];
let owner, roleCreated = false, prisma, before, success = false, phase = 'ownership', stages = 0, existingUnchanged = false;
const state = JSON.parse(readFileSync('.local/postgres/owner.json', 'utf8'));
const ident = value => { assert.match(value, /^salvora_be14_(fresh|restore|role)_[a-f0-9]{16}$/); return `"${value}"`; };
const ownerOptions = { host: '127.0.0.1', port: 55433, user: state.owner, password: state.ownerPassword, connectionTimeoutMillis: 5000 };
async function snapshotExisting() {
  const result = {};
  for (const name of ['salvora_kitchen_dev', 'salvora_kitchen_test']) {
    const connection = new pg.Client({ ...ownerOptions, database: name, options: '-c default_transaction_read_only=on -c statement_timeout=15000' });
    try {
      await connection.connect(); await connection.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      result[name] = {};
      for (const table of tables) result[name][table] = (await connection.query(`SELECT count(*)::int AS count, md5(coalesce(string_agg(row_to_json(t)::text,'' ORDER BY row_to_json(t)::text),'')) AS digest FROM "${table}" t`)).rows[0];
    } finally { await connection.end(); }
  }
  return result;
}
try {
  assert.equal(state.root, root); assert.equal(state.port, 55433); assert.equal(state.owner, 'salvora_bootstrap');
  owner = new pg.Client({ ...ownerOptions, database: 'postgres' }); await owner.connect();
  assert.equal((await owner.query('SELECT inet_server_port() AS port')).rows[0].port, 55433);
  before = await snapshotExisting();
  assert.equal((await owner.query('SELECT count(*)::int AS count FROM pg_database WHERE datname=ANY($1::text[])', [names])).rows[0].count, 0);
  assert.equal((await owner.query('SELECT count(*)::int AS count FROM pg_roles WHERE rolname=$1', [role])).rows[0].count, 0);
  phase = 'disposable_provisioning';
  await owner.query(`CREATE ROLE ${ident(role)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${password}'`); roleCreated = true;
  for (const name of names) {
    await owner.query(`CREATE DATABASE ${ident(name)} OWNER ${ident(role)}`); created.push(name);
    await owner.query(`REVOKE CONNECT ON DATABASE ${ident(name)} FROM PUBLIC`);
  }
  mkdirSync(directory, { recursive: true });
  const url = new URL('postgresql://127.0.0.1:55433/' + names[0]); url.username = role; url.password = password;
  const config = join(directory, 'prisma.config.ts');
  writeFileSync(config, `import { defineConfig } from 'prisma/config';\nexport default defineConfig({ schema: ${JSON.stringify(resolve('prisma/schema.prisma'))}, migrations: { path: ${JSON.stringify(resolve('prisma/migrations'))} }, datasource: { url: process.env.BE14_TEMP_DATABASE_URL! } });\n`, { flag: 'wx' });
  phase = 'prisma_migrate_deploy';
  const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--config', config], {
    windowsHide: true, stdio: 'ignore', timeout: 60000, env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: '', TEST_DATABASE_URL: '', SHADOW_DATABASE_URL: '', BE14_TEMP_DATABASE_URL: url.toString() },
  });
  assert.equal(migration.status, 0);
  // Explicit target is constructed from this run's new role/database; no general
  // runtime allowlist is broadened to permit arbitrary database names.
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 2 }) });
  const identity = (await prisma.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`)[0];
  assert.deepEqual(identity, { name: names[0], port: 55433 });
  assert.equal((await prisma.$queryRaw`SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`)[0].count, 2);
  assert.equal((await prisma.$queryRaw`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public' AND tablename IN ('Plan','Subscription')`)[0].count, 0); stages++;
  phase = 'seed_idempotency_isolation';
  await seedDemoCatalog(prisma);
  assert.equal(await prisma.product.count(), 2); assert.equal(await prisma.category.count(), 2); assert.equal(await prisma.user.count(), 0);
  await prisma.product.update({ where: { id: 'demo-product-risol' }, data: { physicalStock: 7 } });
  await seedDemoCatalog(prisma); assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: 'demo-product-risol' } })).physicalStock, 7);
  const isolation = (await prisma.$queryRaw`SELECT has_database_privilege(current_user,'salvora_kitchen_dev','CONNECT') AS dev, has_database_privilege(current_user,'salvora_kitchen_test','CONNECT') AS test`)[0];
  assert.deepEqual(isolation, { dev: false, test: false });
  const productRows = await prisma.product.findMany({ orderBy: { id: 'asc' } });
  await prisma.$disconnect(); prisma = undefined; stages++;
  phase = 'dump_restore_fresh_database';
  const bin = process.env.SALVORA_POSTGRES_BIN ?? 'C:/Program Files/PostgreSQL/18/bin', archive = join(directory, 'fresh.dump');
  const env = { ...process.env, PGHOST: '127.0.0.1', PGPORT: '55433', PGUSER: role, PGPASSWORD: password, PGDATABASE: names[0], PGCONNECT_TIMEOUT: '5' };
  for (const key of ['PGSERVICE','PGSERVICEFILE','PGOPTIONS']) delete env[key];
  const command = (name, args, target = names[0]) => { const result = spawnSync(join(bin, name + '.exe'), args, { windowsHide: true, stdio: 'ignore', timeout: 60000, env: { ...env, PGDATABASE: target } }); assert.equal(result.status, 0); };
  command('pg_dump', ['--format=custom','--no-owner','--no-privileges','--file',archive]); command('pg_restore', ['--list',archive]);
  const restoreUrl = new URL(url); restoreUrl.pathname = '/' + names[1];
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: restoreUrl.toString(), max: 2 }) });
  assert.equal((await prisma.$queryRaw`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'`)[0].count, 0);
  command('pg_restore', ['--dbname',names[1],'--no-owner','--no-privileges','--exit-on-error',archive], names[1]);
  assert.deepEqual(await prisma.product.findMany({ orderBy: { id: 'asc' } }), productRows);
  assert.equal((await prisma.$queryRaw`SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`)[0].count, 2);
  await assert.rejects(prisma.product.update({ where: { id: 'demo-product-risol' }, data: { reservedStock: 8 } }));
  stages++; success = true;
} catch { /* No raw SQL/Prisma/credential output. */ }
finally {
  if (prisma) await prisma.$disconnect().catch(() => { success = false; });
  if (owner) {
    try {
      for (const name of created.reverse()) {
        const owned = (await owner.query('SELECT r.rolname AS owner FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname=$1', [name])).rows[0];
        assert.equal(owned?.owner, role); await owner.query(`DROP DATABASE ${ident(name)}`);
      }
      if (roleCreated) await owner.query(`DROP ROLE ${ident(role)}`);
      if (before) existingUnchanged = JSON.stringify(before) === JSON.stringify(await snapshotExisting());
      if (!existingUnchanged) success = false;
    } catch { success = false; phase = 'cleanup_or_retention'; }
    await owner.end();
  }
}
const report = { completedAt: new Date().toISOString(), success, phase: success ? 'complete' : phase, stagesPassed: stages, migrations: success ? 2 : null, freshDatabases: true, temporaryTargetsRemoved: success, existingDevAndTestRows: existingUnchanged ? 'VERIFIED_UNCHANGED' : 'REVIEW_REQUIRED', providerCalled: false, taskChanged: false };
mkdirSync(directory, { recursive: true }); writeFileSync(join(directory,'result.json'), JSON.stringify(report), { flag: 'wx' });
console.log(JSON.stringify(report)); if (!success) process.exitCode = 1;
