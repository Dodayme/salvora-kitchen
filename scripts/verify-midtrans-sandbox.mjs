// Explicit opt-in real provider smoke. Other test suites never use merchant keys.
import nextEnv from "@next/env";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { snapConfig, databaseUrl } from "../src/lib/config/schema.ts";
import { createDatabaseClient } from "../src/lib/db/client.ts";
import { createSnapGateway } from "../src/lib/payments/snap.ts";
import { createBuyerService } from "../src/services/buyer.ts";
import { createCheckoutService } from "../src/services/checkout.ts";
import { createPaymentService } from "../src/services/payments.ts";
import { issueNewBuyerVoucher } from "../src/services/vouchers.ts";
import { ApiError } from "../src/lib/api/errors.ts";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
const proofFile = ".local/midtrans-sandbox-proof.json";
let db, proof, stage = "configuration";
try {
  const settings = snapConfig(process.env);
  db = createDatabaseClient({ NODE_ENV: "test", TEST_DATABASE_URL: databaseUrl(process.env, "test") });
  await mkdir(".local", { recursive: true });
  try { proof = JSON.parse(await readFile(proofFile, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (!proof) {
    stage = "test fixture preparation";
    const run = randomUUID();
    const user = await db.user.create({ data: { name: "Midtrans Sandbox Test", email: `sandbox-run-${run}@example.test`, passwordHash: "not-a-login-hash" }, select: { id: true, role: true } });
    await db.$transaction(tx => issueNewBuyerVoucher(tx, user.id));
    const buyer = createBuyerService(db);
    const address = await buyer.createAddress(user, { recipientName: "Sandbox Test", phone: "081200000000", addressLine: "Alamat pengujian Sandbox", city: "Tanjungpinang", province: "Kepulauan Riau" });
    const category = await db.category.create({ data: { name: `Midtrans Sandbox ${run}`, isDemo: true } });
    const product = await db.product.create({ data: { categoryId: category.id, name: "Data Demo Sandbox", description: "Provider test only", price: 5000, physicalStock: 1, isDemo: true } });
    await buyer.addItem(user, { productId: product.id, quantity: 1 });
    const checkout = createCheckoutService(db), quote = await checkout.quote(user, { addressId: address.id });
    const order = (await checkout.order(user, { quoteId: quote.quoteId }, randomUUID())).data;
    proof = { database: "salvora_kitchen_test", userId: user.id, orderId: order.id, productId: product.id, categoryId: category.id, amount: order.total, deadline: order.paymentDeadline, createdAt: new Date().toISOString(), status: "PREPARED" };
    await writeFile(proofFile, JSON.stringify(proof, null, 2) + "\n");
  }
  stage = "test fixture verification";
  if (proof.database !== "salvora_kitchen_test") throw new Error("Invalid proof target");
  const user = await db.user.findUniqueOrThrow({ where: { id: proof.userId }, select: { id: true, role: true, email: true } });
  if (!/^sandbox-run-[a-f0-9-]+@example\.test$/.test(user.email) || user.role !== "BUYER") throw new Error("Invalid fixture owner");
  const order = await db.order.findFirstOrThrow({ where: { id: proof.orderId, userId: user.id } });
  const existing = await db.payment.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: "desc" } });
  if (existing && !["CREATED", "PENDING", "UNCONFIRMED"].includes(existing.status)) throw new Error("Prior attempt needs explicit review; no automatic real provider retry");
  stage = "sandbox Snap token request";
  const payment = await createPaymentService(db, () => createSnapGateway(settings)).pay(user, order.id);
  proof = { ...proof, paymentId: payment.paymentId, providerOrderId: payment.providerOrderId, status: payment.status, checkedAt: new Date().toISOString(), tokenPresent: !!payment.snapToken, reused: payment.reused, paymentSimulated: false, webhookVerified: false };
  await writeFile(proofFile, JSON.stringify(proof, null, 2) + "\n");
  if (payment.status !== "PENDING" || !payment.snapToken) throw new Error("Provider result not confirmed");
  console.log("Real Midtrans Sandbox token verified and persisted on dedicated test order. No payment simulated, no webhook verified, no key/token printed. Safe proof: .local/midtrans-sandbox-proof.json. Fixture retained for reconciliation; reruns reuse this order.");
} catch (error) {
  if (db && proof?.orderId) {
    try {
      const payment = await db.payment.findFirst({ where: { orderId: proof.orderId }, orderBy: { createdAt: "desc" }, select: { id: true, providerOrderId: true, status: true } });
      if (payment) await writeFile(proofFile, JSON.stringify({ ...proof, paymentId: payment.id, providerOrderId: payment.providerOrderId, status: payment.status, checkedAt: new Date().toISOString(), paymentSimulated: false, webhookVerified: false }, null, 2) + "\n");
    } catch { /* Retain the original reference; never delete an uncertain attempt. */ }
  }
  console.error(`Sandbox smoke incomplete at ${stage}${error instanceof ApiError ? ` (${error.code})` : ""}. Sensitive diagnostics suppressed; existing fixture retained.`); process.exitCode = 1;
} finally { if (db) await db.$disconnect(); }
