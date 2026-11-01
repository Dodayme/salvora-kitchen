import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg, { type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { databaseUrl } from "../../src/lib/config/schema";
import { createDatabaseClient } from "../../src/lib/db/client";

const connectionString = databaseUrl(process.env, "test");
const pool = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000 });
const unique = () => randomUUID();
beforeAll(async () => {
  const { rows } = await pool.query("SELECT current_database() AS name");
  expect(rows[0].name).toBe("salvora_kitchen_test");
});
afterAll(async () => { await pool.end(); });

async function transaction(run: (client: PoolClient) => Promise<void>) {
  const client = await pool.connect();
  try { await client.query("BEGIN"); await run(client); }
  finally { await client.query("ROLLBACK"); client.release(); }
}

async function rejects(client: PoolClient, sql: string, values: unknown[], code: string) {
  await client.query("SAVEPOINT expected_failure");
  try { await expect(client.query(sql, values)).rejects.toMatchObject({ code }); }
  finally { await client.query("ROLLBACK TO SAVEPOINT expected_failure"); }
}

async function addUser(client: PoolClient) {
  const id = unique();
  await client.query('INSERT INTO "User" (id,name,email,"passwordHash","updatedAt") VALUES ($1,\'Test only\',$2,\'not-a-login-hash\',now())', [id, `${id}@example.test`]);
  return id;
}

async function addOrder(client: PoolClient, userId: string, discountId: string | null = null) {
  const id = unique();
  // The one-hour interval is a fixture only, never a checkout policy default.
  await client.query(`INSERT INTO "Order" (id,number,"userId","discountId","idempotencyKey","inputHash","recipientName",phone,"addressLine",city,province,subtotal,"shippingFee",total,"shippingLabel","paymentDeadline","updatedAt")
    VALUES ($1::text,$1::text,$2,$3,$1::text,$4,'Recipient','0800000000','Historical address','Test city','Test province',10000,0,10000,'TEST FIXTURE ONLY',now()+interval '1 hour',now())`, [id, userId, discountId, "a".repeat(64)]);
  return id;
}

async function fixture(client: PoolClient) {
  const userId = await addUser(client);
  const categoryId = unique(), productId = unique(), itemId = unique();
  await client.query('INSERT INTO "Category" (id,name,"updatedAt") VALUES ($1::text,$1::text,now())', [categoryId]);
  await client.query('INSERT INTO "Product" (id,"categoryId",name,description,price,"physicalStock","updatedAt") VALUES ($1,$2,\'Snapshot name\',\'Fixture\',10000,1,now())', [productId, categoryId]);
  const orderId = await addOrder(client, userId);
  await client.query('INSERT INTO "OrderItem" (id,"orderId","productId",name,"unitPrice",quantity,"lineSubtotal") VALUES ($1,$2,$3,\'Snapshot name\',10000,1,10000)', [itemId, orderId, productId]);
  return { userId, categoryId, productId, orderId, itemId };
}

async function payment(client: PoolClient, orderId: string, status = "FAILED") {
  const id = unique();
  await client.query(`INSERT INTO "Payment" (id,"orderId","providerOrderId",amount,status,"paidAt","expiresAt","updatedAt")
    SELECT $1::text,id,$1::text,total,$3::"PaymentStatus",$4,now()+interval '1 hour',now() FROM "Order" WHERE id=$2`, [id, orderId, status, status === "SUCCESS" ? new Date() : null]);
  return id;
}

describe("Integritas PostgreSQL Salvora nyata", () => {
  it("migrasi tidak membawa tabel langganan dan akses role test terisolasi", async () => {
    const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    expect(tables.rows.map(row => row.tablename)).not.toContain("Plan");
    expect(tables.rows.map(row => row.tablename)).not.toContain("Subscription");
    const { rows } = await pool.query("SELECT has_database_privilege(current_user,'salvora_kitchen_dev','CONNECT') AS allowed");
    expect(rows[0].allowed).toBe(false);
    expect(tables.rows.map(row => row.tablename)).toContain("PaymentApplication");
  });

  it("email ternormalisasi unik, foreign key dan sesi tidak valid ditolak", async () => transaction(async client => {
    const userId = await addUser(client);
    await rejects(client, 'INSERT INTO "User" (id,name,email,"passwordHash","updatedAt") VALUES ($1,\'x\',\'UPPER@EXAMPLE.TEST\',\'hash\',now())', [unique()], "23514");
    await rejects(client, 'INSERT INTO "User" (id,name,email,"passwordHash","updatedAt") SELECT $1,name,email,"passwordHash",now() FROM "User" WHERE id=$2', [unique(), userId], "23505");
    await rejects(client, 'INSERT INTO "Session" ("tokenDigest","userId","expiresAt") VALUES ($1,$2,now()-interval \'1 day\')', ["a".repeat(64), userId], "23514");
    await rejects(client, 'INSERT INTO "Session" ("tokenDigest","userId","expiresAt") VALUES ($1,$2,now()+interval \'1 day\')', ["a".repeat(64), unique()], "23503");
  }));

  it("stok fisik/reservasi/harga dan kuantitas keranjang dijaga DB", async () => transaction(async client => {
    const f = await fixture(client), cartId = unique();
    await rejects(client, 'UPDATE "Product" SET "reservedStock"=2 WHERE id=$1', [f.productId], "23514");
    await rejects(client, 'UPDATE "Product" SET "physicalStock"=-1 WHERE id=$1', [f.productId], "23514");
    await rejects(client, 'UPDATE "Product" SET price=0 WHERE id=$1', [f.productId], "23514");
    await client.query('INSERT INTO "Cart" (id,"userId","updatedAt") VALUES ($1,$2,now())', [cartId, f.userId]);
    await rejects(client, 'INSERT INTO "CartItem" (id,"cartId","productId",quantity,"updatedAt") VALUES ($1,$2,$3,0,now())', [unique(), cartId, f.productId], "23514");
    await client.query('INSERT INTO "CartItem" (id,"cartId","productId",quantity,"updatedAt") VALUES ($1,$2,$3,1,now())', [unique(), cartId, f.productId]);
    await rejects(client, 'INSERT INTO "CartItem" (id,"cartId","productId",quantity,"updatedAt") VALUES ($1,$2,$3,1,now())', [unique(), cartId, f.productId], "23505");
  }));

  it("snapshot dan tenggat pesanan tetap, total/kuantitas dan idempotensi tervalidasi", async () => transaction(async client => {
    const f = await fixture(client);
    const addressId = unique();
    await client.query('INSERT INTO "Address" (id,"userId","recipientName",phone,"addressLine",city,province,"updatedAt") VALUES ($1,$2,\'Recipient\',\'0800000000\',\'Historical address\',\'Test city\',\'Test province\',now())', [addressId, f.userId]);
    await client.query('UPDATE "Address" SET "addressLine"=\'New account address\' WHERE id=$1', [addressId]);
    await client.query('DELETE FROM "Address" WHERE id=$1', [addressId]);
    expect((await client.query('SELECT "addressLine" FROM "Order" WHERE id=$1', [f.orderId])).rows[0].addressLine).toBe("Historical address");
    await client.query('UPDATE "Product" SET name=\'Changed catalog\',price=20000 WHERE id=$1', [f.productId]);
    expect((await client.query('SELECT name,"unitPrice" FROM "OrderItem" WHERE id=$1', [f.itemId])).rows[0]).toEqual({ name: "Snapshot name", unitPrice: 10000 });
    await rejects(client, 'UPDATE "Order" SET "paymentDeadline"="paymentDeadline"+interval \'1 hour\' WHERE id=$1', [f.orderId], "23514");
    await rejects(client, 'UPDATE "Order" SET total=1 WHERE id=$1', [f.orderId], "23514");
    await rejects(client, 'UPDATE "OrderItem" SET quantity=2 WHERE id=$1', [f.itemId], "23514");
    await rejects(client, 'INSERT INTO "OrderItem" (id,"orderId","productId",name,"unitPrice",quantity,"lineSubtotal") VALUES ($1,$2,$3,\'bad\',10000,2,1)', [unique(), f.orderId, f.productId], "23514");
    // Only number/id differ: idempotency pair must still reject the second order.
    await rejects(client, `INSERT INTO "Order" (id,number,"userId","idempotencyKey","inputHash","recipientName",phone,"addressLine",city,province,subtotal,"shippingFee",total,"shippingLabel","paymentDeadline","updatedAt")
      SELECT $1::text,$1::text,"userId","idempotencyKey","inputHash","recipientName",phone,"addressLine",city,province,subtotal,"shippingFee",total,"shippingLabel","paymentDeadline",now() FROM "Order" WHERE id=$2`, [unique(), f.orderId], "23505");
  }));

  it("voucher tunggal, kebijakan tetap, state dan kepemilikan reservasi dijaga", async () => transaction(async client => {
    const f = await fixture(client), discountId = unique();
    await client.query('INSERT INTO "Discount" (id,"userId") VALUES ($1,$2)', [discountId, f.userId]);
    await rejects(client, 'INSERT INTO "Discount" (id,"userId") VALUES ($1,$2)', [unique(), f.userId], "23505");
    await rejects(client, 'UPDATE "Discount" SET percentage=50 WHERE id=$1', [discountId], "23514");
    await rejects(client, 'UPDATE "Discount" SET status=\'RESERVED\' WHERE id=$1', [discountId], "23514");
    const other = await addUser(client), otherOrder = await addOrder(client, other);
    await rejects(client, 'UPDATE "Discount" SET status=\'RESERVED\',"reservedOrderId"=$1 WHERE id=$2', [otherOrder, discountId], "23503");
    const own = await addOrder(client, f.userId, discountId);
    await client.query('UPDATE "Discount" SET status=\'RESERVED\',"reservedOrderId"=$1 WHERE id=$2', [own, discountId]);
    await client.query('UPDATE "Discount" SET status=\'AVAILABLE\',"reservedOrderId"=null WHERE id=$1', [discountId]);
    const retryOrder = await addOrder(client, f.userId, discountId);
    await client.query('UPDATE "Discount" SET status=\'RESERVED\',"reservedOrderId"=$1 WHERE id=$2', [retryOrder, discountId]);
    expect((await client.query('SELECT status FROM "Discount" WHERE id=$1', [discountId])).rows[0].status).toBe("RESERVED");
  }));

  it("percobaan historis banyak tetapi aktif satu, referensi dan nominal konsisten", async () => transaction(async client => {
    const f = await fixture(client);
    await payment(client, f.orderId, "FAILED");
    const active = await payment(client, f.orderId, "UNCONFIRMED");
    await rejects(client, `INSERT INTO "Payment" (id,"orderId","providerOrderId",amount,"expiresAt","updatedAt") VALUES ($1::text,$2,$1::text,10000,now()+interval '1 hour',now())`, [unique(), f.orderId], "23505");
    await rejects(client, 'UPDATE "Payment" SET amount=999 WHERE id=$1', [active], "23503");
    await client.query('UPDATE "Payment" SET status=\'EXPIRED\' WHERE id=$1', [active]);
    const next = await payment(client, f.orderId, "PENDING");
    await rejects(client, 'UPDATE "Payment" SET "providerOrderId"=$1 WHERE id=$2', [active, next], "23505");
    await client.query('UPDATE "Payment" SET "midtransTransactionId"=\'test-provider-id\' WHERE id=$1', [active]);
    await rejects(client, 'UPDATE "Payment" SET "midtransTransactionId"=\'test-provider-id\' WHERE id=$1', [next], "23505");
    expect((await client.query('SELECT count(*)::int AS count FROM "Payment" WHERE "orderId"=$1', [f.orderId])).rows[0].count).toBe(3);
  }));

  it("penerapan pembayaran hanya untuk sukses pesanan yang cocok dan sekali per pesanan", async () => transaction(async client => {
    const f = await fixture(client), secondOrder = await addOrder(client, f.userId);
    const failed = await payment(client, f.orderId), p1 = await payment(client, f.orderId, "SUCCESS"), p2 = await payment(client, f.orderId, "SUCCESS");
    const otherPayment = await payment(client, secondOrder, "SUCCESS");
    await rejects(client, 'INSERT INTO "PaymentApplication" ("orderId","paymentId") VALUES ($1,$2)', [f.orderId, failed], "23514");
    await rejects(client, 'INSERT INTO "PaymentApplication" ("orderId","paymentId") VALUES ($1,$2)', [f.orderId, otherPayment], "23514");
    await client.query('INSERT INTO "PaymentApplication" ("orderId","paymentId") VALUES ($1,$2)', [f.orderId, p1]);
    await rejects(client, 'INSERT INTO "PaymentApplication" ("orderId","paymentId") VALUES ($1,$2)', [f.orderId, p2], "23505");
  }));

  it("event terdeduplikasi, rating valid tunggal, riwayat produk tidak dapat dihapus", async () => transaction(async client => {
    const f = await fixture(client), p = await payment(client, f.orderId);
    await client.query(`INSERT INTO "PaymentEvent" (id,"paymentId","deduplicationKey",source,verification) VALUES ($1,$2,'event-key','WEBHOOK','VERIFIED')`, [unique(), p]);
    await rejects(client, `INSERT INTO "PaymentEvent" (id,"paymentId","deduplicationKey",source,verification) VALUES ($1,$2,'event-key','WEBHOOK','VERIFIED')`, [unique(), p], "23505");
    await rejects(client, 'INSERT INTO "Rating" (id,"orderItemId",rating,comment) VALUES ($1,$2,6,\'Fixture comment\')', [unique(), f.itemId], "23514");
    await client.query('UPDATE "Order" SET status=\'COMPLETED\' WHERE id=$1', [f.orderId]);
    await client.query('INSERT INTO "Rating" (id,"orderItemId",rating,comment) VALUES ($1,$2,5,\'Fixture comment\')', [unique(), f.itemId]);
    await rejects(client, 'INSERT INTO "Rating" (id,"orderItemId",rating,comment) VALUES ($1,$2,4,\'Other comment\')', [unique(), f.itemId], "23505");
    await rejects(client, 'DELETE FROM "Product" WHERE id=$1', [f.productId], "23001");
  }));

  it("Prisma client menjalankan transaksi nyata dan rollback tanpa sisa data", async () => {
    const db = createDatabaseClient();
    const id = unique();
    try {
      await expect(db.$transaction(async tx => {
        await tx.user.create({ data: { id, name: "Rollback test", email: `${id}@example.test`, passwordHash: "not-a-login-hash" } });
        expect((await tx.user.findUniqueOrThrow({ where: { id } })).role).toBe("BUYER");
        throw new Error("intentional-rollback");
      })).rejects.toThrow("intentional-rollback");
      expect(await db.user.findUnique({ where: { id } })).toBeNull();
    } finally { await db.$disconnect(); }
  });

  it("seed demo dapat diulang tanpa mereset stok atau mengubah data yang sudah ada", async () => {
    const seed = () => spawnSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { env: process.env, encoding: "utf8", windowsHide: true });
    expect(seed().status).toBe(0);
    const before = (await pool.query('SELECT * FROM "Product" WHERE id IN (\'demo-product-risol\',\'demo-product-cookies\') ORDER BY id')).rows;
    expect(before).toHaveLength(2);
    expect(before.every(row => row.isDemo === true)).toBe(true);
    expect(seed().status).toBe(0);
    const after = (await pool.query('SELECT * FROM "Product" WHERE id IN (\'demo-product-risol\',\'demo-product-cookies\') ORDER BY id')).rows;
    expect(after).toEqual(before);
  });

  it("state reservasi stok wajib konsisten dan unik per item", async () => transaction(async client => {
    const f = await fixture(client);
    await client.query('INSERT INTO "StockReservation" ("orderItemId","expiresAt") VALUES ($1,now()+interval \'1 hour\')', [f.itemId]);
    await rejects(client, 'INSERT INTO "StockReservation" ("orderItemId","expiresAt") VALUES ($1,now()+interval \'1 hour\')', [f.itemId], "23505");
    await rejects(client, 'UPDATE "StockReservation" SET status=\'RELEASED\' WHERE "orderItemId"=$1', [f.itemId], "23514");
    await client.query('UPDATE "StockReservation" SET status=\'RELEASED\',"finalizedAt"=now() WHERE "orderItemId"=$1', [f.itemId]);
  }));

  it("dua transaksi bersamaan tidak memperoleh unit stok terakhir yang sama", async () => {
    const client = await pool.connect();
    const categoryId = unique(), productId = unique();
    try {
      await client.query('INSERT INTO "Category" (id,name,"updatedAt") VALUES ($1::text,$1::text,now())', [categoryId]);
      await client.query('INSERT INTO "Product" (id,"categoryId",name,description,price,"physicalStock","updatedAt") VALUES ($1,$2,\'Concurrency fixture\',\'Fixture\',10000,1,now())', [productId, categoryId]);
      const reserve = async () => {
        const connection = await pool.connect();
        try {
          await connection.query("BEGIN");
          const result = await connection.query('UPDATE "Product" SET "reservedStock"="reservedStock"+1 WHERE id=$1 AND "physicalStock"-"reservedStock">=1 RETURNING id', [productId]);
          await connection.query("COMMIT");
          return result.rowCount;
        } catch (error) { await connection.query("ROLLBACK"); throw error; }
        finally { connection.release(); }
      };
      expect((await Promise.all([reserve(), reserve()])).sort()).toEqual([0, 1]);
      expect((await client.query('SELECT "reservedStock" FROM "Product" WHERE id=$1', [productId])).rows[0].reservedStock).toBe(1);
    } finally {
      // Exact UUID fixture only; never truncate/reset the shared test database.
      await client.query('DELETE FROM "Product" WHERE id=$1', [productId]);
      await client.query('DELETE FROM "Category" WHERE id=$1', [categoryId]);
      client.release();
    }
  });
});
