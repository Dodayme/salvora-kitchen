import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildSnapPayload, createSnapGateway, SNAP_SANDBOX_URL, SnapFailure, validSnapResult, type SnapInput } from "../src/lib/payments/snap";

const input = (): SnapInput => {
  const createdAt = new Date(Date.now() - 600000);
  return { providerOrderId: `SV-${randomUUID()}`, orderId: randomUUID(), subtotal: 10003, discount: 2000, shippingFee: 10000, total: 18003, createdAt, deadline: new Date(createdAt.getTime() + 3600000), requestedAt: new Date(), recipientName: "Fixture", phone: "081200000000", items: [{ productId: "product", name: "Risol", unitPrice: 10003, quantity: 1 }] };
};
const settings = { serverKey: "SB-Mid-server-unit-fixture", appUrl: "https://shop.example.test" };
describe("Adapter Midtrans Snap Sandbox", () => {
  it("payload snapshot lengkap, diskon negatif, ongkir, referensi dan expiry sejak order dibuat", () => {
    const data = input(), payload = buildSnapPayload(data, settings.appUrl);
    expect(payload.transaction_details).toEqual({ order_id: data.providerOrderId, gross_amount: 18003 });
    expect(payload.item_details.reduce((sum, item) => sum + item.price * item.quantity, 0)).toBe(18003);
    expect(payload.item_details.find(item => item.id === "new-buyer-discount")?.price).toBe(-2000);
    expect(payload.expiry.duration).toBe(60); expect(payload.expiry.unit).toBe("minutes");
    const start = new Date(payload.expiry.start_time.replace(" ", "T").replace(" +0700", "+07:00"));
    expect(Math.abs(start.getTime() - data.createdAt.getTime())).toBeLessThan(1000);
    expect(payload.callbacks.finish).toBe("https://shop.example.test/payment/finish");
    expect(payload).not.toHaveProperty("enabled_payments");
    expect(JSON.stringify(payload)).not.toMatch(/Subscription|planName|premium|recurring/);
    expect(payload.send_email.token.enabled).toBe(false);
  });
  it("nama/id item dibatasi, tidak meminta nominal browser, total tidak cocok ditolak sebelum request", () => {
    const data = input(); data.items[0].name = "A|\n" + "🍪".repeat(70);
    const payload = buildSnapPayload(data, settings.appUrl);
    expect(Array.from(payload.item_details[0].name).length).toBeLessThanOrEqual(50);
    expect(payload.item_details[0].name).not.toMatch(/[|\n]/);
    expect(() => buildSnapPayload({ ...data, total: 1 }, settings.appUrl)).toThrow();
    expect(() => buildSnapPayload({ ...data, deadline: new Date(data.createdAt.getTime() + 7200000) }, settings.appUrl)).toThrow();
    expect(() => buildSnapPayload({ ...data, requestedAt: new Date(data.deadline.getTime() - 59000) }, settings.appUrl)).toThrow();
    expect(() => buildSnapPayload(data, "http://shop.example.test")).toThrow();
    expect(buildSnapPayload(data, "http://localhost:3000").callbacks.finish).toBe("http://localhost:3000/payment/finish");
  });
  it("request hanya Sandbox, Basic server-key, satu kali dan redirect/error mentah tidak keluar", async () => {
    const token = randomUUID(); let calls = 0;
    const transport: typeof fetch = async (url, init) => {
      calls++; expect(url).toBe(SNAP_SANDBOX_URL); expect(init?.redirect).toBe("error");
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Basic ${Buffer.from(settings.serverKey + ":").toString("base64")}`);
      return Response.json({ token, redirect_url: `https://app.sandbox.midtrans.com/snap/v3/redirection/${token}` }, { status: 201 });
    };
    expect(await createSnapGateway(settings, transport).create(input())).toEqual({ token, redirectUrl: `https://app.sandbox.midtrans.com/snap/v3/redirection/${token}` }); expect(calls).toBe(1);
    await createSnapGateway({ ...settings, notificationUrl: "https://hooks.example.test/api/webhooks/midtrans" }, async (_url, init) => { expect(new Headers(init?.headers).get("X-Override-Notification")).toBe("https://hooks.example.test/api/webhooks/midtrans"); return Response.json({ token, redirect_url: `https://app.sandbox.midtrans.com/snap/v3/redirection/${token}` }, { status: 201 }); }).create(input());
  });
  it("hanya penolakan otentikasi/nominal eksplisit yang definitif; duplicate, 429, 5xx dan timeout ambigu", async () => {
    for (const [status, body, definitive] of [[401, { error_messages: ["Unauthorized"] }, true], [400, { error_messages: ["transaction_details.gross_amount is not equal to the sum of item_details"] }, true], [400, { error_messages: ["order_id has already been taken"] }, false], [403, {}, false], [429, {}, false], [500, {}, false]] as const) {
      const transport: typeof fetch = async () => Response.json(body, { status });
      await expect(createSnapGateway(settings, transport).create(input())).rejects.toMatchObject({ definitive });
    }
    await expect(createSnapGateway(settings, async () => { throw new Error("private diagnostic"); }).create(input())).rejects.toEqual(new SnapFailure("SNAP_UNCONFIRMED"));
  });
  it("malformed/oversized/unsafe success ditahan sebagai belum terkonfirmasi", async () => {
    const token = randomUUID();
    for (const response of [new Response("invalid json", { status: 201 }), new Response("x".repeat(65537), { status: 201 }), Response.json({ token, redirect_url: `https://evil.example.test/${token}` }, { status: 201 }), Response.json({ token: "bad", redirect_url: "https://app.sandbox.midtrans.com/snap/v3/redirection/bad" }, { status: 201 })]) await expect(createSnapGateway(settings, async () => response).create(input())).rejects.toMatchObject({ definitive: false });
    for (const url of [`https://user:secret@app.sandbox.midtrans.com/snap/v3/redirection/${token}`, `https://app.midtrans.com/snap/v3/redirection/${token}`, `https://app.sandbox.midtrans.com/snap/v3/redirection/${token}?next=evil`]) expect(() => validSnapResult({ token, redirectUrl: url })).toThrow();
    expect(() => createSnapGateway({ ...settings, serverKey: "Mid-server-production" })).toThrow();
  });
});
