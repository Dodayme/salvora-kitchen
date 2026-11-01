import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { createServer } from "node:net";
import assert from "node:assert/strict";

// Uses a disposable Next.js process and process-only fixtures, never .env/database writes.
async function verify(configured) {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const env = { ...process.env, NODE_ENV: "production", DATABASE_URL: "", AUTH_SECRET: "", NEXT_PUBLIC_APP_URL: "", MIDTRANS_SERVER_KEY: "", NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "", MIDTRANS_IS_PRODUCTION: "false" };
  if (configured) Object.assign(env, {
    DATABASE_URL: "postgresql://localhost/salvora_kitchen_demo",
    AUTH_SECRET: "disposable-http-smoke-test-secret-for-salvora",
    NEXT_PUBLIC_APP_URL: "https://shop.example.test",
  });
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env, windowsHide: true, stdio: "ignore" });
  let spawnError;
  child.on("error", error => { spawnError = error; });
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let n = 0; n < 150; n++) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw new Error("Next.js process exited before HTTP verification.");
      try {
        const response = await fetch(base, { signal: AbortSignal.timeout(500) });
        if (response.status === 200) { ready = true; break; }
      } catch { /* Await local server startup. */ }
      await delay(100);
    }
    assert.ok(ready, "Next.js startup timed out");
    assert.match(await (await fetch(base)).text(), /Salvora Kitchen/);
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, configured ? 200 : 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.meta.requestId, response.headers.get("x-request-id"));
    assert.equal(body.success, configured);
    assert.ok(!JSON.stringify(body).includes("postgresql://"));
    assert.ok(!JSON.stringify(body).includes("disposable-http-smoke-test-secret"));
    if (configured) {
      assert.equal(body.data.database, "not_checked");
      assert.equal(body.data.payment, "not_checked");
    } else assert.equal(body.error.code, "ENV_NOT_CONFIGURED");
    assert.equal((await fetch(`${base}/api/health`, { method: "POST" })).status, 405);
    // These routes now exist. Exercise only framework method dispatch: invoking
    // GET would resolve sessions/database and would violate this smoke's scope.
    for (const route of ["orders", "admin/orders", "admin/dashboard", "admin/vouchers", "admin/voucher-policy", "products/smoke-product/reviews", "order-items/smoke-item/review"]) {
      assert.equal((await fetch(`${base}/api/${route}`, { method: "DELETE" })).status, 405);
    }
    assert.equal((await fetch(`${base}/api/smoke-route-that-does-not-exist`)).status, 404);
  } finally {
    if (child.exitCode === null && !spawnError) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  }
}

await verify(false);
await verify(true);
console.log("HTTP verified: home 200, health 503/200 without/with configuration, existing routes unsupported method 405, unknown route 404. Business handlers not invoked; no DB/provider connection attempted.");
