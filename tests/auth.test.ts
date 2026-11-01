import { describe, expect, it } from "vitest";
import { registerSchema, loginSchema, adminProfileSchema } from "../src/lib/auth/validation";
import { SESSION_COOKIE, sessionToken, sessionDigest, newSessionToken } from "../src/lib/auth/session";
import { sessionResponse } from "../src/lib/auth/http";
import { failure, success } from "../src/lib/api/response";
import { ApiError } from "../src/lib/api/errors";

const settings = { appUrl: "https://shop.example.test", authSecret: "unit-test-secret-not-an-account", sessionTtlDays: 7 };
describe("Validasi autentikasi dan cookie", () => {
  const input = { name: " Pembeli ", email: " Buyer@Example.Test ", password: " space password ", confirmPassword: " space password " };
  it("normalisasi identitas tidak mengubah password", () => {
    expect(registerSchema.parse(input)).toEqual({ ...input, name: "Pembeli", email: "buyer@example.test" });
    expect(loginSchema.parse({ email: input.email, password: input.password }).password).toBe(input.password);
  });
  it("menolak eskalasi role, target akun dan field profil yang tidak didukung", () => {
    for (const extra of [{ role: "ADMIN" }, { id: "other" }, { isFirstPurchase: false }, { avatar: "x" }]) expect(registerSchema.safeParse({ ...input, ...extra }).success).toBe(false);
    for (const extra of [{ email: "new@example.test" }, { role: "ADMIN" }, { id: "other" }, { password: "new-password" }]) expect(adminProfileSchema.safeParse({ name: "Admin Baru", ...extra }).success).toBe(false);
  });
  it("batas password memakai karakter dan byte UTF-8 serta konfirmasi sama", () => {
    expect(registerSchema.safeParse({ ...input, confirmPassword: "different" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "test@example.test", password: "a".repeat(72) }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "test@example.test", password: "a".repeat(73) }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "test@example.test", password: "é".repeat(37) }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "test@example.test", password: "😀".repeat(4) }).success).toBe(false);
  });
  it("cookie malformed, ambigu dan nama lain tidak dapat menjadi sesi", () => {
    const token = newSessionToken();
    const request = (cookie: string) => new Request("http://localhost", { headers: { cookie } });
    expect(sessionToken(request(`${SESSION_COOKIE}=${token}`))).toBe(token);
    expect(sessionToken(request(`other=${token}`))).toBeNull();
    expect(sessionToken(request(`${SESSION_COOKIE}=short`))).toBeNull();
    expect(sessionToken(request(`${SESSION_COOKIE}=${token}; ${SESSION_COOKIE}=${token}`))).toBeNull();
    expect(sessionDigest(token, settings.authSecret)).not.toBe(token);
    expect(sessionDigest(token, settings.authSecret)).toMatch(/^[a-f0-9]{64}$/);
  });
  it("cookie sesi HttpOnly/SameSite/path/TTL dan Secure mengikuti HTTPS", () => {
    const session = { token: newSessionToken(), expiresAt: new Date(Date.now() + 7 * 86400000) };
    const secure = sessionResponse(success({ user: null }), settings, session);
    const header = secure.headers.get("set-cookie")!;
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=lax");
    expect(header).toContain("Path=/");
    expect(header).toContain("Max-Age=604800");
    expect(header).toContain("Secure");
    expect(sessionResponse(success(null), { ...settings, appUrl: "http://localhost:3000" }, session).headers.get("set-cookie")).not.toContain("Secure");
    expect(sessionResponse(success(null), settings, null).headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("rate limit mengirim Retry-After tanpa identitas pengguna", async () => {
    const response = failure(new ApiError(429, "RATE_LIMITED", "Tunggu sebentar.", undefined, 120));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("120");
    expect(await response.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });
});
