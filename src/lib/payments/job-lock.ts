import pg from "pg";

// A dedicated connection owns this session lock. Never use a pooled Prisma
// connection for a session-scoped advisory lock or hold a row transaction over HTTP.
export async function withPaymentJobLock<T>(connectionString: string, action: (assertHeld: () => void) => Promise<T>, observeStage?: (stage: "database_connection" | "lock") => void) {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000, query_timeout: 5000, application_name: "salvora-payment-job" });
  let held = false;
  client.on("error", () => { held = false; });
  try {
    observeStage?.("database_connection");
    await client.connect();
    observeStage?.("lock");
    held = (await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(1935764598, 10) AS locked")).rows[0].locked;
    if (!held) return { skipped: true as const };
    const value = await action(() => { if (!held) throw Object.assign(new Error("Payment job lock connection lost"), { code: "PAYMENT_JOB_LOCK_LOST" }); });
    return { skipped: false as const, value };
  } finally {
    if (held) await client.query("SELECT pg_advisory_unlock(1935764598, 10)").catch(() => {});
    await client.end().catch(() => {});
  }
}
