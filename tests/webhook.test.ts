import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createStatusGateway, mapProviderStatus, notificationSchema, providerStatusSchema, providerTime, rupiah, verifyNotificationSignature } from "../src/lib/payments/status";

const key = "SB-Mid-server-unit-webhook-only";
const status = () => ({ order_id: `SV-${randomUUID()}`, transaction_id: randomUUID(), status_code: "200", gross_amount: "14000.00", currency: "IDR", transaction_status: "settlement", payment_type: "bank_transfer", settlement_time: "2026-10-23 12:00:00" });
describe("Signature dan Get Status Midtrans", () => {
  it("signature mengikat teks nominal persis dan diverifikasi tanpa timing-dependent string compare", () => {
    const value = status(), signature = createHash("sha512").update(value.order_id + value.status_code + value.gross_amount + key).digest("hex");
    expect(() => verifyNotificationSignature({ ...value, signature_key: signature }, key)).not.toThrow();
    expect(() => verifyNotificationSignature({ ...value, gross_amount: "14000", signature_key: signature }, key)).toThrow();
    expect(() => verifyNotificationSignature({ ...value, signature_key: "a".repeat(128) }, key)).toThrow();
    expect(notificationSchema.parse({ ...value, signature_key: signature, private_extra: "ignored" })).not.toHaveProperty("private_extra");
  });
  it("nominal Rupiah tanpa float, pecahan nonnol/overflow dan waktu invalid ditolak", () => {
    expect(rupiah("2147483647.00")).toBe(2147483647);
    for (const amount of ["14000.01", "2147483648", "1e3", "-1", " 100"]) expect(() => rupiah(amount)).toThrow();
    expect(providerTime("2026-10-23 12:00:00")?.toISOString()).toBe("2026-10-23T05:00:00.000Z");
    for (const date of ["2026-02-30 12:00:00", "bad", "2026-10-23 25:00:00"]) expect(providerTime(date)).toBeNull();
  });
  it("success memerlukan status/code/fraud yang sesuai, authorize/challenge bukan sukses", () => {
    expect(mapProviderStatus(status()).status).toBe("SUCCESS");
    expect(mapProviderStatus({ ...status(), transaction_status: "capture", payment_type: "credit_card", fraud_status: "accept" }).status).toBe("SUCCESS");
    for (const value of [{ ...status(), transaction_status: "capture", payment_type: "credit_card", fraud_status: "challenge" }, { ...status(), fraud_status: "deny" }, { ...status(), status_code: "500" }, { ...status(), transaction_status: "authorize" }]) expect(mapProviderStatus(value).status).toBe("UNCONFIRMED");
    for (const [provider, expected] of [["pending", "PENDING"], ["expire", "EXPIRED"], ["cancel", "CANCELLED"], ["deny", "FAILED"], ["failure", "FAILED"], ["refund", "REFUNDED"], ["partial_refund", "PARTIALLY_REFUNDED"], ["reversal", "REVERSED"]]) expect(mapProviderStatus({ ...status(), transaction_status: provider }).status).toBe(expected);
    expect(mapProviderStatus({ ...status(), transaction_status: "future_status" }).known).toBe(false);
  });
  it("GET hanya endpoint Sandbox fixed, Basic server key, timeout/body limit; 404 tidak menjadi terminal", async () => {
    const value = status(); let count = 0;
    const gateway = createStatusGateway(key, async (url, init) => {
      count++; expect(url).toBe(`https://api.sandbox.midtrans.com/v2/${value.order_id}/status`); expect(init?.method).toBe("GET"); expect(init?.redirect).toBe("error");
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Basic ${Buffer.from(key + ":").toString("base64")}`);
      return Response.json(value);
    });
    expect(await gateway.get(value.order_id)).toEqual(providerStatusSchema.parse(value)); expect(count).toBe(1);
    expect(await createStatusGateway(key, async () => new Response(null, { status: 404 })).get(value.order_id)).toBeNull();
    for (const response of [Response.json({}, { status: 500 }), Response.json({}), new Response("x".repeat(65537))]) await expect(createStatusGateway(key, async () => response).get(value.order_id)).rejects.toMatchObject({ status: 503 });
    await expect(createStatusGateway(key, async () => { throw new Error("private detail"); }).get(value.order_id)).rejects.toMatchObject({ code: "MIDTRANS_STATUS_UNAVAILABLE" });
  });
});
