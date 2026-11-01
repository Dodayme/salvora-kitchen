import { randomBytes, randomUUID } from "node:crypto";
import { hash, compare } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "../../src/lib/db/client";
import { createAuthService } from "../../src/services/auth";
import { authHandlers } from "../../src/lib/auth/http";
import { sessionDigest, SESSION_COOKIE } from "../../src/lib/auth/session";
import { consumeRateLimit, rateLimitKey } from "../../src/lib/auth/rate-limit";
import { requireOwner } from "../../src/lib/auth/access";

const db = createDatabaseClient();
const settings = { authSecret: randomBytes(32).toString("hex"), appUrl: "https://auth.example.test", sessionTtlDays: 7 };
const service = createAuthService(db, settings);
const handlers = authHandlers(() => ({ service, settings }));
const emails: string[] = [];
const started = Date.now();
const password = randomBytes(18).toString("base64url");
const buyerInput = () => {
  const email = `auth-${randomUUID()}@example.test`;
  emails.push(email);
  return { name: "Pembeli Test", email, password, confirmPassword: password };
};
let adminId: string, adminEmail: string, otherAdminId: string;
const request = (path: string, data?: unknown, token?: string, origin: string | null = settings.appUrl) => new Request(`https://auth.example.test${path}`, {
  method: data === undefined ? "GET" : "POST",
  headers: { ...(data === undefined ? {} : { "Content-Type": "application/json" }), ...(origin ? { Origin: origin } : {}), ...(token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {}) },
  ...(data === undefined ? {} : { body: JSON.stringify(data) }),
});
beforeAll(async () => {
  for (const name of ["Admin Test", "Admin Other"]) {
    const email = `auth-admin-${randomUUID()}@example.test`;
    emails.push(email);
    const user = await db.user.create({ data: { name, email, role: "ADMIN", passwordHash: await hash(password, 12) } });
    if (!adminId) { adminId = user.id; adminEmail = email; } else otherAdminId = user.id;
  }
});
afterAll(async () => {
  await db.discount.deleteMany({ where: { user: { email: { in: emails } } } });
  await db.user.deleteMany({ where: { email: { in: emails } } });
  const keys: string[] = [];
  for (let time = started - 900000; time <= Date.now() + 900000; time += 900000) {
    for (const operation of ["login", "register"]) {
      keys.push(rateLimitKey(`auth.${operation}.global`, "all", settings.authSecret, new Date(time)));
      for (const email of emails) keys.push(rateLimitKey(`auth.${operation}.email`, email, settings.authSecret, new Date(time)));
    }
  }
  await db.rateLimit.deleteMany({ where: { key: { in: keys } } });
  await db.$disconnect();
});

describe("Autentikasi pada PostgreSQL nyata", () => {
  it("registrasi membuat pembeli baru, hash cost 12, sesi digest dan DTO aman", async () => {
    const input = buyerInput();
    const result = await service.register({ ...input, email: ` ${input.email.toUpperCase()} ` });
    const stored = await db.user.findUniqueOrThrow({ where: { id: result.user.id } });
    expect(stored.role).toBe("BUYER");
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(await compare(password, stored.passwordHash)).toBe(true);
    const session = await db.session.findUniqueOrThrow({ where: { tokenDigest: sessionDigest(result.session.token, settings.authSecret) } });
    expect(session.userId).toBe(stored.id);
    expect(session.tokenDigest).not.toBe(result.session.token);
    expect(Object.keys(result.user).sort()).toEqual(["email", "id", "name", "role"]);
    expect(await db.discount.count({ where: { userId: stored.id } })).toBe(1);
    expect(stored.isFirstPurchase).toBe(true);
  });
  it("dua registrasi email sama hanya menghasilkan satu akun, tanpa sesi parsial", async () => {
    const input = buyerInput();
    const results = await Promise.allSettled([service.register(input), service.register(input)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409, code: "EMAIL_EXISTS" });
    const user = await db.user.findUniqueOrThrow({ where: { email: input.email } });
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
  });
  it("login merotasi sesi browser lama dan logout mencabut akses token lama", async () => {
    const input = buyerInput(), first = await service.register(input);
    const next = await service.login({ email: input.email, password }, first.session.token);
    expect(next.session.token).not.toBe(first.session.token);
    expect(await service.currentUser(first.session.token)).toBeNull();
    expect(await service.currentUser(next.session.token)).toEqual(next.user);
    await service.logout(next.session.token);
    await service.logout(next.session.token);
    expect(await service.currentUser(next.session.token)).toBeNull();
  });
  it("password salah dan email tidak terdaftar memiliki pesan/login status yang sama", async () => {
    const input = buyerInput();
    await service.register(input);
    const wrong = await service.login({ email: input.email, password: "incorrect-test-password" }).catch(error => error);
    const missingEmail = `missing-${randomUUID()}@example.test`; emails.push(missingEmail);
    const missing = await service.login({ email: missingEmail, password }).catch(error => error);
    expect(wrong).toMatchObject({ status: 401, code: "INVALID_CREDENTIALS", publicMessage: "Email atau kata sandi salah." });
    expect(missing.publicMessage).toBe(wrong.publicMessage);
    expect(missing.status).toBe(wrong.status);
  });
  it("sesi expired/tampered/salah secret dan role terbaru diperiksa server", async () => {
    const input = buyerInput(), result = await service.register(input);
    const digest = sessionDigest(result.session.token, settings.authSecret);
    await db.session.update({ where: { tokenDigest: digest }, data: { createdAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() - 1000) } });
    expect(await service.currentUser(result.session.token)).toBeNull();
    expect(await service.currentUser(randomBytes(32).toString("hex"))).toBeNull();
    const fresh = await service.login({ email: input.email, password });
    const wrongSecret = createAuthService(db, { ...settings, authSecret: randomBytes(32).toString("hex") });
    expect(await wrongSecret.currentUser(fresh.session.token)).toBeNull();
    await db.user.update({ where: { id: result.user.id }, data: { role: "ADMIN" } });
    expect((await service.currentUser(fresh.session.token))?.role).toBe("ADMIN");
    await db.user.update({ where: { id: result.user.id }, data: { role: "BUYER" } });
    await expect(service.adminProfile(fresh.session.token)).rejects.toMatchObject({ status: 403 });
  });
  it("pembeli/anonymous tidak boleh mengakses admin atau data pembeli lain", async () => {
    const result = await service.register(buyerInput());
    expect((await handlers.adminGet(request("/api/admin/me"))).status).toBe(401);
    expect((await handlers.adminGet(request("/api/admin/me", undefined, result.session.token))).status).toBe(403);
    expect((await handlers.adminPatch(request("/api/admin/me", { name: "Blocked Buyer" }, result.session.token))).status).toBe(403);
    expect(() => requireOwner(result.user, "other-user")).toThrow();
    expect(() => requireOwner(result.user, result.user.id)).not.toThrow();
  });
  it("profil admin hanya mengubah nama sendiri, role/email/ID lain ditolak", async () => {
    const admin = await service.login({ email: adminEmail, password });
    for (const extra of [{ role: "BUYER" }, { email: "new@example.test" }, { id: otherAdminId }]) {
      const result = await handlers.adminPatch(request("/api/admin/me", { name: "Targeted Name", ...extra }, admin.session.token));
      expect(result.status).toBe(422);
    }
    const updated = await handlers.adminPatch(request("/api/admin/me", { name: " Updated Admin " }, admin.session.token));
    expect(updated.status).toBe(200);
    expect((await updated.json()).data).toEqual({ id: adminId, name: "Updated Admin", email: adminEmail, role: "ADMIN" });
    expect((await db.user.findUniqueOrThrow({ where: { id: otherAdminId } })).name).toBe("Admin Other");
  });
  it("Origin palsu/hilang ditolak sebelum pembuatan akun, logout dan perubahan profil", async () => {
    const input = buyerInput();
    expect((await handlers.register(request("/api/auth/register", input, undefined, "https://attacker.example.test"))).status).toBe(403);
    expect(await db.user.findUnique({ where: { email: input.email } })).toBeNull();
    const registered = await service.register(input);
    expect((await handlers.logout(request("/api/auth/logout", {}, registered.session.token, null))).status).toBe(403);
    expect(await service.currentUser(registered.session.token)).not.toBeNull();
    const admin = await service.login({ email: adminEmail, password });
    expect((await handlers.adminPatch(request("/api/admin/me", { name: "Blocked Admin" }, admin.session.token, "https://attacker.example.test"))).status).toBe(403);
  });
  it("hook login menggunakan transaksi yang sama; gagal hook merollback akun/sesi/rotasi", async () => {
    const input = buyerInput();
    const failing = createAuthService(db, settings, async tx => {
      expect(await tx.user.count({ where: { email: input.email } })).toBe(1);
      throw new Error("test-hook-failure");
    });
    await expect(failing.register(input)).rejects.toThrow("test-hook-failure");
    expect(await db.user.findUnique({ where: { email: input.email } })).toBeNull();
    const old = await service.register(input);
    await expect(failing.login({ email: input.email, password }, old.session.token)).rejects.toThrow("test-hook-failure");
    expect(await service.currentUser(old.session.token)).not.toBeNull();
    expect(await db.session.count({ where: { userId: old.user.id } })).toBe(1);
  });
  it("rate limiter PostgreSQL mengizinkan hanya batasnya saat request bersamaan", async () => {
    const scope = `test.concurrent.${randomUUID()}`, identity = "fixture", time = new Date();
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => consumeRateLimit(db, settings.authSecret, scope, identity, 3, time)));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(3);
    for (const result of results) if (result.status === "rejected") expect(result.reason).toMatchObject({ status: 429, code: "RATE_LIMITED" });
    const key = rateLimitKey(scope, identity, settings.authSecret, time);
    const stored = await db.rateLimit.findUniqueOrThrow({ where: { key } });
    expect(stored.count).toBe(8);
    expect(stored.key).not.toContain(identity);
    await db.rateLimit.delete({ where: { key } });
  });
});
