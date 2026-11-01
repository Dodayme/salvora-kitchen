import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { appConfig, databaseUrl, paymentConfig, snapConfig } from "../src/lib/config/schema";
import { failure, route, success } from "../src/lib/api/response";
import { jsonBody, pagination, pageMeta } from "../src/lib/api/input";
import { checkOrigin, requireOwner, requireRole } from "../src/lib/auth/access";
import { userView } from "../src/lib/contracts/user";
import { GET } from "../src/app/api/health/route";
import { spawnSync } from "node:child_process";

const config = {
  DATABASE_URL: "postgresql://localhost/salvora_kitchen_dev",
  AUTH_SECRET: "unit-test-new-secret-for-salvora-only-123456",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  MIDTRANS_IS_PRODUCTION: "false",
  NODE_ENV: "development" as const,
};
afterEach(() => vi.unstubAllEnvs());

describe("Konfigurasi terpisah dan tanpa fallback", () => {
  it("CLI konfigurasi benar-benar dapat dijalankan dan tidak mencetak rahasia", () => {
    for (const valid of [false, true]) {
      const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/check-env.ts"], {
        env: { ...process.env, ...config, DATABASE_URL: valid ? config.DATABASE_URL : "postgresql://private:secret@localhost/subspace" },
        encoding: "utf8", windowsHide: true,
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(valid ? 0 : 1);
      expect(result.stdout + result.stderr).not.toContain(config.AUTH_SECRET);
      expect(result.stdout + result.stderr).not.toContain("private:secret");
      expect(result.stdout + result.stderr).toContain(valid ? "Konfigurasi valid" : "Konfigurasi DATABASE_URL");
    }
  });
  it("menolak koneksi hilang, placeholder, legacy, URL berbahaya, dan opsi override", () => {
    for (const url of [undefined, "", "postgresql://localhost/subspace", "postgresql://localhost/subspace_test", "postgresql://localhost/salvora_kitchen_test", "postgresql://REPLACE_USER@localhost/salvora_kitchen_dev", "https://localhost/salvora_kitchen_dev", "postgresql://localhost/salvora_kitchen_dev?dbname=subspace"]) {
      expect(() => databaseUrl({ DATABASE_URL: url })).toThrow("DATABASE_URL");
    }
  });
  it("mengizinkan dev/demo dan shadow terpisah, tidak memetakan test ke dev", () => {
    expect(databaseUrl(config)).toBe(config.DATABASE_URL);
    expect(databaseUrl({ DATABASE_URL: "postgresql://localhost/salvora_kitchen_demo" })).toContain("salvora_kitchen_demo");
    expect(() => databaseUrl({ ...config, NODE_ENV: "test" })).toThrow();
    expect(() => databaseUrl(config, "test")).toThrow("TEST_DATABASE_URL");
    expect(() => databaseUrl({ TEST_DATABASE_URL: config.DATABASE_URL }, "test")).toThrow();
    expect(databaseUrl({ TEST_DATABASE_URL: "postgresql://localhost/salvora_kitchen_test" }, "test")).toContain("salvora_kitchen_test");
    expect(() => databaseUrl({ SHADOW_DATABASE_URL: config.DATABASE_URL }, "shadow")).toThrow();
  });
  it("fondasi tidak membutuhkan key pembayaran tetapi menolak produksi Midtrans", () => {
    expect(appConfig(config).sessionTtlDays).toBe(7);
    expect(() => appConfig({ ...config, MIDTRANS_IS_PRODUCTION: "true" })).toThrow();
    expect(() => appConfig({ ...config, AUTH_SECRET: "short" })).toThrow();
    expect(() => appConfig({ ...config, NODE_ENV: "production" })).toThrow("NEXT_PUBLIC_APP_URL");
    expect(() => appConfig({ ...config, NEXT_PUBLIC_APP_URL: "http://user:password@localhost" })).toThrow();
  });
  it("pembayaran mensyaratkan key sandbox, HTTPS webhook, dan expiry eksplisit", () => {
    expect(() => paymentConfig(config)).toThrow("MIDTRANS_SERVER_KEY");
    const payment = { ...config, NEXT_PUBLIC_APP_URL: "https://shop.example.test", MIDTRANS_SERVER_KEY: "SB-Mid-server-test-only", NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "SB-Mid-client-test-only", MIDTRANS_WEBHOOK_URL: "https://shop.example.test/api/webhooks/midtrans", PAYMENT_EXPIRY_MINUTES: "60" };
    expect(paymentConfig(payment).isProduction).toBe(false);
    expect(() => paymentConfig({ ...payment, PAYMENT_EXPIRY_MINUTES: "" })).toThrow("PAYMENT_EXPIRY_MINUTES");
    expect(() => paymentConfig({ ...payment, PAYMENT_EXPIRY_MINUTES: "30" })).toThrow("PAYMENT_EXPIRY_MINUTES");
    expect(() => paymentConfig({ ...payment, MIDTRANS_WEBHOOK_URL: "https://other.example.test" })).toThrow();
  });
  it("pembuatan token lokal tidak bergantung pada kesiapan webhook HTTPS", () => {
    const snap = { ...config, MIDTRANS_SERVER_KEY: "SB-Mid-server-test-only", NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: "SB-Mid-client-test-only", PAYMENT_EXPIRY_MINUTES: "60", MIDTRANS_WEBHOOK_URL: "" };
    expect(snapConfig(snap).appUrl).toBe("http://localhost:3000");
    expect(() => paymentConfig(snap)).toThrow("MIDTRANS_WEBHOOK_URL");
  });
});

describe("Kontrak respons dan input", () => {
  it("membungkus respons sukses dengan requestId dan no-store", async () => {
    const response = success({ count: 0 });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toMatchObject({ success: true, data: { count: 0 } });
    expect(body.meta.requestId).toBe(response.headers.get("X-Request-Id"));
  });
  it("tidak membocorkan internal error atau nilai konfigurasi/input", async () => {
    const secret = "private-database-password-and-server-key";
    const result = failure(new Error(secret));
    expect(result.status).toBe(500);
    expect(await result.text()).not.toContain(secret);
    const validation = z.strictObject({ email: z.email() }).safeParse({ email: secret, passwordHash: secret });
    if (validation.success) throw new Error("Expected validation failure");
    const response = failure(validation.error);
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).not.toContain(secret);
    expect(body).not.toContain("passwordHash");
  });
  it("wrapper menangkap error tak terduga", async () => {
    const handler = route(async () => { throw new Error("private SQL query"); });
    expect((await handler(new Request("http://localhost"))).status).toBe(500);
  });
  it("menolak media salah, JSON rusak, field tambahan, dan byte body berlebih", async () => {
    const schema = z.strictObject({ name: z.string() });
    const request = (body: string, type = "application/json") => new Request("http://localhost", { method: "POST", headers: { "Content-Type": type }, body });
    await expect(jsonBody(request("{}", "text/plain"), schema)).rejects.toMatchObject({ status: 415 });
    await expect(jsonBody(request("{"), schema)).rejects.toMatchObject({ status: 400 });
    await expect(jsonBody(request('{"name":"n","role":"ADMIN"}'), schema)).rejects.toBeInstanceOf(z.ZodError);
    await expect(jsonBody(request('{"name":"ééé"}'), schema, 14)).rejects.toMatchObject({ status: 413 });
    await expect(jsonBody(request('{"name":"Salvora"}'), schema)).resolves.toEqual({ name: "Salvora" });
  });
  it("pagination membatasi ukuran dan menolak angka ambigu/parameter ganda", () => {
    expect(pagination(new URLSearchParams())).toEqual({ page: 1, pageSize: 20 });
    for (const q of ["page=0", "page=-1", "page=1.5", "page=1e2", "pageSize=101", "page=1&page=2"]) expect(() => pagination(new URLSearchParams(q))).toThrow();
    expect(pageMeta(1, 20, 0)).toEqual({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  });
});

describe("Pola akses dan whitelist", () => {
  const buyer = { id: "buyer-1", role: "BUYER" as const };
  const admin = { id: "admin-1", role: "ADMIN" as const };
  it("menolak sesi kosong, role salah, dan data pengguna lain", () => {
    expect(() => requireRole(null, "BUYER")).toThrow();
    expect(() => requireRole(buyer, "ADMIN")).toThrow();
    expect(() => requireOwner(buyer, "buyer-2")).toThrow();
    expect(() => requireOwner(admin, "buyer-2")).toThrow();
    expect(requireOwner(admin, "buyer-2", true)).toBe(admin);
    expect(requireOwner(buyer, buyer.id)).toBe(buyer);
  });
  it("Origin harus cocok termasuk port dan tidak boleh hilang", () => {
    const app = "http://localhost:3000";
    expect(() => checkOrigin(new Request(app), app)).toThrow();
    expect(() => checkOrigin(new Request(app, { headers: { Origin: "http://localhost:3001" } }), app)).toThrow();
    expect(() => checkOrigin(new Request(app, { headers: { Origin: app } }), app)).not.toThrow();
  });
  it("user DTO hanya mengeluarkan field yang diizinkan", () => {
    const user = { ...buyer, name: "Pembeli", email: "buyer@example.test", passwordHash: "private", sessions: ["private"], serverKey: "private" };
    expect(userView(user)).toEqual({ ...buyer, name: user.name, email: user.email });
  });
});

describe("HTTP health konfigurasi", () => {
  it("konfigurasi belum lengkap menghasilkan 503 yang aman", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://private:secret@localhost/subspace");
    const result = await GET(new Request("http://localhost/api/health"));
    expect(result.status).toBe(503);
    const body = await result.text();
    expect(body).not.toContain("private");
    expect(body).not.toContain("subspace");
    expect(body).not.toContain("secret");
  });
  it("konfigurasi valid tidak mengklaim DB atau Midtrans sudah terhubung", async () => {
    for (const [key, value] of Object.entries(config)) vi.stubEnv(key, value);
    const result = await GET(new Request("http://localhost/api/health"));
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ data: { application: "salvora-kitchen", database: "not_checked", payment: "not_checked" } });
  });
});
