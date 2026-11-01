// Explicit interactive Sandbox test. Only the signed webhook is publicly exposed.
import nextEnv from "@next/env";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { databaseUrl, snapConfig } from "../src/lib/config/schema.ts";
import { createDatabaseClient } from "../src/lib/db/client.ts";
import { createBuyerService } from "../src/services/buyer.ts";
import { createCheckoutService } from "../src/services/checkout.ts";
import { createPaymentService } from "../src/services/payments.ts";
import { createSnapGateway } from "../src/lib/payments/snap.ts";
import { issueNewBuyerVoucher } from "../src/services/vouchers.ts";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
if (process.argv.length > 3 || process.argv[2] && process.argv[2] !== "--be14-new") throw new Error("Unsupported mode");
// Explicitly authorized fresh run; never overwrite or reuse legacy proof/attempts.
const runDirectory = process.argv[2] === "--be14-new" ? path.resolve(".local/be14-provider", randomUUID()) : null;
const proofFile = runDirectory ? path.join(runDirectory, "proof.json") : ".local/midtrans-webhook-proof.json";
let db, app, tunnel, proxy, control, proof, stage = "configuration", stopping = false, saveQueue = Promise.resolve();
const save = () => { const value = JSON.stringify(proof, null, 2) + "\n"; saveQueue = saveQueue.then(() => writeFile(proofFile, value)); return saveQueue; };
async function listen(server) { server.listen(0, "127.0.0.1"); await once(server, "listening"); return `http://127.0.0.1:${server.address().port}`; }
async function stop() {
  if (stopping) return; stopping = true;
  if (proof) { proof.stoppedAt = new Date().toISOString(); await save().catch(() => {}); }
  for (const child of [tunnel, app]) if (child?.pid && child.exitCode === null) child.kill();
  proxy?.closeAllConnections(); proxy?.close(); control?.closeAllConnections(); control?.close();
  if (db) await db.$disconnect();
  console.log("Sandbox webhook tunnel and test servers stopped. Provider/payment fixture retained for audit/reconciliation; no merchant configuration overwritten."); process.exit();
}
process.on("SIGINT", stop); process.on("SIGTERM", stop);
process.stdin.on("data", data => { if (data.includes(3) || data.toString().trim() === "stop") void stop(); });
try {
  const settings = snapConfig(process.env), testUrl = databaseUrl(process.env, "test");
  const target = new URL(testUrl);
  if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.port !== "55433" || target.pathname !== "/salvora_kitchen_test") throw new Error("Test target rejected");
  try { await readFile(proofFile); throw new Error("Existing live proof requires review; refusing to create another provider attempt"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (runDirectory) await mkdir(runDirectory, { recursive: true });
  await mkdir(".local/tools", { recursive: true });
  stage = "official cloudflared download verification";
  const release = await (await fetch("https://api.github.com/repos/cloudflare/cloudflared/releases/latest", { headers: { Accept: "application/vnd.github+json", "User-Agent": "Salvora-Sandbox-Test" }, signal: AbortSignal.timeout(20000) })).json();
  const asset = release.assets?.find(value => value.name === "cloudflared-windows-amd64.exe");
  if (!/^[0-9.]+$/.test(release.tag_name) || !asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest) || asset.size > 150000000 || !asset.browser_download_url.startsWith("https://github.com/cloudflare/cloudflared/releases/download/")) throw new Error("Unverifiable official binary");
  const binary = path.resolve(`.local/tools/cloudflared-${release.tag_name}.exe`);
  let bytes; try { bytes = await readFile(binary); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const valid = value => value && value.length === asset.size && `sha256:${createHash("sha256").update(value).digest("hex")}` === asset.digest;
  if (!valid(bytes)) { const response = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(120000) }); if (!response.ok) throw new Error("Binary unavailable"); bytes = Buffer.from(await response.arrayBuffer()); if (!valid(bytes)) throw new Error("Binary digest mismatch"); await writeFile(binary, bytes); }
  console.log(`Official cloudflared ${release.tag_name} checksum verified; temporary webhook-only test uses salvora_kitchen_test.`);
  db = createDatabaseClient({ NODE_ENV: "test", TEST_DATABASE_URL: testUrl });
  const identity = (await db.$queryRaw`SELECT current_database() AS name, inet_server_port() AS port`)[0];
  if (identity.name !== "salvora_kitchen_test" || identity.port !== 55433) throw new Error("Test identity rejected");
  const portProbe = createServer(); const appBase = await listen(portProbe); const appPort = new URL(appBase).port; await new Promise(resolve => portProbe.close(resolve));
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", appPort], { windowsHide: true, stdio: "ignore", env: { ...process.env, NODE_ENV: "test", DATABASE_URL: "", TEST_DATABASE_URL: testUrl, AUTH_SECRET: randomBytes(32).toString("hex"), NEXT_PUBLIC_APP_URL: appBase, MIDTRANS_WEBHOOK_URL: "", MIDTRANS_IS_PRODUCTION: "false", PAYMENT_EXPIRY_MINUTES: "60" } });
  let appError; app.on("error", error => { appError = error; }); stage = "private test app startup";
  let ready = false;
  for (let n = 0; n < 150; n++) { if (appError || app.exitCode !== null) throw new Error("App startup failed"); try { if ((await fetch(appBase, { signal: AbortSignal.timeout(500) })).status === 200) { ready = true; break; } } catch {} await delay(100); }
  if (!ready) throw new Error("App startup timeout");
  const probe = { order_id: "SV-probe", transaction_id: "probe", gross_amount: "14000.00", status_code: "200", transaction_status: "settlement", signature_key: "a".repeat(128) };
  const localProbe = await fetch(`${appBase}/api/webhooks/midtrans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(probe), signal: AbortSignal.timeout(5000) });
  console.log(`Private webhook signature probe: HTTP ${localProbe.status}.`);
  if (localProbe.status !== 403) { const body = await localProbe.json(); console.log(`Private probe code: ${body.error?.code ?? "unknown"}.`); throw new Error("Private signature route not ready"); }
  proxy = createServer({ requestTimeout: 20000, headersTimeout: 10000 }, (req, res) => {
    if (req.url !== "/api/webhooks/midtrans" || req.method !== "POST") { res.writeHead(404, { "Cache-Control": "no-store" }); res.end(); return; }
    if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json") { res.writeHead(415); res.end(); return; }
    let size = 0; const chunks = [];
    req.on("data", chunk => { size += chunk.length; if (size <= 65536) chunks.push(chunk); });
    req.on("end", async () => {
      if (size > 65536) { res.writeHead(413); res.end(); return; }
      try {
        const response = await fetch(`${appBase}/api/webhooks/midtrans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: Buffer.concat(chunks), signal: AbortSignal.timeout(35000), redirect: "error" });
        res.writeHead(response.status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(await response.text());
        console.log(`Provider webhook forwarded: HTTP ${response.status}; no request body/signature logged.`);
        if (proof?.orderId && response.status === 200) {
          const state = await db.order.findUniqueOrThrow({ where: { id: proof.orderId }, include: { application: true, payments: { select: { status: true } } } });
          const stock = await db.product.findUniqueOrThrow({ where: { id: proof.productId } });
          const voucher = await db.discount.findUniqueOrThrow({ where: { userId: proof.userId } });
          proof = { ...proof, webhookHttp200Count: (proof.webhookHttp200Count ?? 0) + 1, lastWebhookAt: new Date().toISOString(), orderStatus: state.status, paymentStatuses: state.payments.map(p => p.status), applicationPresent: !!state.application, physicalStock: stock.physicalStock, reservedStock: stock.reservedStock, voucherStatus: voucher.status };
          await save();
          if (state.application) console.log("Real webhook applied payment: application exists, stock/voucher finalized. Safe proof updated; token/key not printed.");
        }
      } catch { if (!res.headersSent) res.writeHead(503); res.end(); }
    });
  });
  const proxyBase = await listen(proxy); stage = "temporary HTTPS webhook tunnel";
  const tunnelConfig = runDirectory ? path.join(runDirectory, "tunnel-config.yml") : path.resolve(".local/tools/webhook-test-config.yml"); await writeFile(tunnelConfig, "no-autoupdate: true\n");
  tunnel = spawn(binary, ["tunnel", "--config", tunnelConfig, "--no-autoupdate", "--url", proxyBase, "--protocol", "http2", "--loglevel", "info"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let log = "", publicBase, tunnelError;
  tunnel.on("error", error => { tunnelError = error; });
  const inspect = data => { log = (log + data.toString()).slice(-16384); if (!runDirectory) void writeFile(".local/tools/webhook-tunnel-last.log", log).catch(() => {}); publicBase = [...log.matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g)].map(match => match[0]).find(url => url !== "https://api.trycloudflare.com") ?? publicBase; };
  tunnel.stdout.on("data", inspect); tunnel.stderr.on("data", inspect);
  for (let n = 0; n < 300 && !publicBase; n++) { if (tunnelError || tunnel.exitCode !== null) throw new Error("Tunnel failed"); await delay(200); }
  if (!publicBase) throw new Error("Tunnel startup timeout");
  const webhookUrl = `${publicBase}/api/webhooks/midtrans`;
  stage = "public route scope and signature probe";
  let reachable = false, publicPost, publicRoot, probeError;
  for (let n = 0; n < 12; n++) {
    try {
      const response = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(probe), signal: AbortSignal.timeout(10000) });
      publicPost = response.status; publicRoot = (await fetch(publicBase, { signal: AbortSignal.timeout(10000) })).status;
      if (publicPost === 403 && publicRoot === 404) { reachable = true; break; }
    } catch (error) { probeError = error.cause?.code ?? error.name; } await delay(1000);
  }
  if (!reachable) { console.log(`Public route probe incomplete: POST=${publicPost ?? "unreachable"}, root=${publicRoot ?? "unreachable"}, error=${probeError ?? "none"}.`); throw new Error("Public route not ready or scope invalid"); }
  stage = "test-only Snap order with per-transaction notification override";
  const run = randomUUID(), user = await db.user.create({ data: { name: "Webhook Live Sandbox", email: `webhook-live-${run}@example.test`, passwordHash: "not-a-login-hash" }, select: { id: true, role: true } });
  proof = { database: "salvora_kitchen_test", userId: user.id, createdAt: new Date().toISOString(), webhookUrl, cloudflaredVersion: release.tag_name, scope: "webhook-only temporary test" }; await save();
  await db.$transaction(tx => issueNewBuyerVoucher(tx, user.id));
  const buyer = createBuyerService(db), address = await buyer.createAddress(user, { recipientName: "Sandbox Fixture", phone: "081200000000", addressLine: "Alamat pengujian webhook Sandbox", city: "Tanjungpinang", province: "Kepulauan Riau" });
  const category = await db.category.create({ data: { name: `Webhook Live ${run}`, isDemo: true } });
  const product = await db.product.create({ data: { categoryId: category.id, name: "Data Demo Webhook", description: "Sandbox only", price: 5000, physicalStock: 1, isDemo: true } });
  proof = { ...proof, categoryId: category.id, productId: product.id }; await save();
  await buyer.addItem(user, { productId: product.id, quantity: 1 });
  const checkout = createCheckoutService(db), quote = await checkout.quote(user, { addressId: address.id });
  const order = (await checkout.order(user, { quoteId: quote.quoteId }, randomUUID())).data;
  proof = { ...proof, orderId: order.id, amount: order.total, deadline: order.paymentDeadline }; await save();
  const payment = await createPaymentService(db, () => createSnapGateway({ ...settings, appUrl: appBase, notificationUrl: webhookUrl })).pay(user, order.id);
  proof = { ...proof, paymentId: payment.paymentId, providerOrderId: payment.providerOrderId, paymentStatus: payment.status, tokenPresent: !!payment.snapToken }; await save();
  if (!payment.snapToken || payment.status !== "PENDING") throw new Error("Snap not ready");
  control = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.url === "/open-snap" && req.method === "POST") { const p = await db.payment.findUniqueOrThrow({ where: { id: proof.paymentId } }); res.writeHead(303, { Location: p.snapRedirectUrl }); res.end(); return; }
    if (req.url !== "/" || req.method !== "GET") { res.writeHead(404); res.end(); return; }
    const state = await db.order.findUniqueOrThrow({ where: { id: proof.orderId } });
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(`<!doctype html><html lang="id"><meta charset="utf-8"><title>Uji webhook Salvora Sandbox</title><body style="font:18px system-ui;max-width:700px;margin:80px auto;padding:24px"><h1>Uji webhook Salvora — Sandbox</h1><p>Pesanan uji Rp14.000. Status: ${state.status}. Tidak memakai uang atau data pelanggan nyata.</p><form method="post" action="/open-snap"><button style="font:inherit;padding:12px">Buka Snap Sandbox</button></form><p>Halaman kontrol ini hanya tersedia di loopback. URL publik hanya menerima POST webhook bertanda tangan.</p></body></html>`);
  });
  const controlBase = await listen(control);
  console.log(`READY — local Sandbox control: ${controlBase}`);
  console.log(`Temporary public route: ${webhookUrl} (only POST webhook, all other paths rejected).`);
  console.log("Use the Sandbox VA simulator after choosing a bank. Type stop or Ctrl+C here to close tunnel/app. No key/token printed; fixture retained.");
} catch { console.error(`Live Sandbox setup failed at ${stage}; private diagnostics suppressed.`); process.exitCode = 1; await stop(); }
