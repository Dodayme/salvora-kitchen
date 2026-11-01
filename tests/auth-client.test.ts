import { describe, expect, it, vi } from "vitest";
import { authDestination, authErrorMessage, authFieldIssues, decodeSession, safeReturnTo, validateAuthFields } from "@/lib/auth-client/model";
import { createSessionStore } from "@/lib/auth-client/session-store";
import { createApiClient } from "@/lib/http/client";

const buyer = { id: "buyer-fixture", name: "Buyer Fixture", email: "buyer@example.test", role: "BUYER" as const };
const admin = { ...buyer, id: "admin-fixture", role: "ADMIN" as const };
const envelope = (data: unknown) => Response.json({ success: true, data, meta: { requestId: "auth-client-test" } });
const rejected = (status: number, code: string) => Response.json({ success: false, error: { code, message: "Pesan publik contoh" }, meta: { requestId: "auth-client-test" } }, { status });
const setup = () => { const fetcher = vi.fn<typeof fetch>(); const notify = vi.fn(); const store = createSessionStore(createApiClient(fetcher), notify); return { fetcher, store, notify }; };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

describe("Auth return path", () => {
  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "/%2f%2fevil.test", "/%252f%252fevil.test", "/\nevil.test", "/api/auth/logout", "/login", "/register", "/dev/ui", "/admin/../login", "/akun?token=secret", "/payment/finish?order_id=secret", "/menu?token=secret", "/menu?page=1&page=2", "/menu?page=-1"])("rejects unsafe/unneeded destination %s", value => {
    expect(safeReturnTo(value)).toBeNull();
  });
  it("keeps approved internal UI paths and harmless catalog filters", () => {
    for (const path of ["/", "/akun", "/menu/product-001#ulasan", "/menu?page=2&categoryId=category-1", "/admin/pesanan/order-1"]) expect(safeReturnTo(path)).toBe(path);
    expect(safeReturnTo(["/akun", "/admin"])).toBeNull();
  });
  it("routes according to the server's role", () => {
    expect(authDestination(admin, "/checkout")).toBe("/admin");
    expect(authDestination(buyer, "/admin")).toBe("/");
    expect(authDestination(buyer, "/akun")).toBe("/akun");
    expect(authDestination(admin, null)).toBe("/admin");
  });
});

describe("Auth input/DTO privacy", () => {
  const fields = { name: "Buyer Fixture", email: "buyer@example.test", password: " fixture-password ", confirmPassword: " fixture-password " };
  it("accepts password whitespace without silently trimming it", () => { expect(validateAuthFields("register", fields)).toEqual({}); });
  it("counts Unicode characters and UTF-8 bytes, matching the server boundary", () => {
    expect(validateAuthFields("register", { ...fields, password: "😀".repeat(7), confirmPassword: "😀".repeat(7) })).toHaveProperty("password");
    expect(validateAuthFields("register", { ...fields, password: "😀".repeat(18), confirmPassword: "😀".repeat(18) })).not.toHaveProperty("password");
    expect(validateAuthFields("register", { ...fields, password: "😀".repeat(19), confirmPassword: "😀".repeat(19) })).toHaveProperty("password");
  });
  it("validates registration fields without adding registration-only checks to login", () => {
    expect(validateAuthFields("register", { ...fields, name: " ", email: "invalid", confirmPassword: "different" })).toMatchObject({ name: expect.any(String), email: expect.any(String), confirmPassword: expect.any(String) });
    expect(validateAuthFields("login", { ...fields, name: "", confirmPassword: "" })).toEqual({});
  });
  it("whitelists session data and rejects unknown roles/malformed DTOs", () => {
    expect(decodeSession({ user: { ...buyer, passwordHash: "PRIVATE_SENTINEL", token: "PRIVATE_SENTINEL" } })).toEqual({ user: buyer });
    expect(decodeSession({ user: null })).toEqual({ user: null });
    for (const data of [{}, null, { user: {} }, { user: { ...buyer, role: "SUPERADMIN" } }]) expect(() => decodeSession(data)).toThrow();
  });
  it("maps only auth fields and never echoes raw validation input or unknown exceptions", () => {
    expect(authFieldIssues([{ path: "email", code: "invalid_format" }, { path: "PRIVATE_SENTINEL", code: "invalid" }, { path: "__proto__", code: "invalid" }])).toEqual({ email: expect.any(String) });
    expect(authErrorMessage(Error("PRIVATE_SENTINEL"))).not.toContain("PRIVATE_SENTINEL");
  });
});

describe("Session state machine with in-memory HTTP", () => {
  it("starts with a stable anonymous-free SSR snapshot and verifies identity through GET", async () => {
    const { store, fetcher } = setup();
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot());
    expect(store.getSnapshot()).toMatchObject({ status: "checking", user: null });
    fetcher.mockResolvedValueOnce(envelope({ user: buyer })); await store.refresh();
    expect(store.getSnapshot()).toMatchObject({ status: "authenticated", user: buyer });
  });
  it("drops stale GET results when a newer check returns a different account", async () => {
    const { store, fetcher } = setup(), old = deferred<Response>();
    fetcher.mockReturnValueOnce(old.promise).mockResolvedValueOnce(envelope({ user: admin }));
    const first = store.refresh(); await store.refresh(); old.resolve(envelope({ user: buyer })); await first;
    expect(store.getSnapshot()).toMatchObject({ status: "authenticated", user: admin });
  });
  it("confirms persisted cookie state after login and never exposes the POST's stale user", async () => {
    const { store, fetcher, notify } = setup();
    fetcher.mockResolvedValueOnce(envelope({ user: buyer })).mockResolvedValueOnce(envelope({ user: admin }));
    await expect(store.authenticate("login", { email: buyer.email, password: "fixture-only" })).resolves.toEqual(admin);
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(["/api/auth/login", "/api/auth/session"]);
    expect(store.getSnapshot().user).toEqual(admin);
    expect(notify.mock.calls).toEqual([["changing"], ["changed"]]);
  });
  it("does not claim login success when the browser session remains null", async () => {
    const { store, fetcher } = setup();
    fetcher.mockResolvedValueOnce(envelope({ user: buyer })).mockResolvedValueOnce(envelope({ user: null }));
    await expect(store.authenticate("register", { email: buyer.email })).rejects.toMatchObject({ code: "SESSION_NOT_CONFIRMED" });
    expect(store.getSnapshot()).toMatchObject({ status: "error", user: null });
  });
  it("prevents parallel auth mutations and ignores reads while a mutation is in flight", async () => {
    const { store, fetcher } = setup(), pending = deferred<Response>();
    fetcher.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(envelope({ user: buyer }));
    const first = store.authenticate("login", { email: buyer.email });
    await expect(store.logout()).rejects.toMatchObject({ code: "AUTH_PENDING" });
    await store.refresh(); expect(fetcher).toHaveBeenCalledTimes(1);
    pending.resolve(envelope({ user: buyer })); await first;
  });
  it("does not let an earlier read restore identity after logout", async () => {
    const { store, fetcher } = setup(), old = deferred<Response>();
    fetcher.mockReturnValueOnce(old.promise).mockResolvedValueOnce(envelope(null));
    const reading = store.refresh(); await store.logout(); old.resolve(envelope({ user: buyer })); await reading;
    expect(store.getSnapshot()).toMatchObject({ status: "anonymous", user: null });
  });
  it.each([401, 403, 409, 422, 429])("leaves a rejected auth attempt retryable without a cached user (HTTP %i)", async status => {
    const { store, fetcher } = setup(); fetcher.mockResolvedValueOnce(rejected(status, "EXAMPLE_ERROR"));
    await expect(store.authenticate("login", { email: buyer.email })).rejects.toMatchObject({ status });
    expect(store.getSnapshot()).toMatchObject({ status: "anonymous", user: null });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("clears private identity immediately on logout failure and never replays it", async () => {
    const { store, fetcher } = setup(), pending = deferred<Response>();
    fetcher.mockResolvedValueOnce(envelope({ user: buyer })); await store.refresh();
    fetcher.mockReturnValueOnce(pending.promise); const loggingOut = store.logout();
    expect(store.getSnapshot()).toMatchObject({ status: "checking", user: null });
    pending.resolve(rejected(503, "EXAMPLE_UNAVAILABLE")); await expect(loggingOut).rejects.toMatchObject({ status: 503 });
    expect(store.getSnapshot()).toMatchObject({ status: "error", user: null });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("treats an uncertain login mutation as error, without automatic POST retry", async () => {
    const { store, fetcher } = setup(); fetcher.mockRejectedValueOnce(Error("PRIVATE_SENTINEL"));
    await expect(store.authenticate("login", { email: buyer.email })).rejects.toMatchObject({ kind: "network" });
    expect(store.getSnapshot()).toMatchObject({ status: "error", user: null }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("keeps a same-identity background check from resetting private feature state", async () => {
    const { store, fetcher } = setup(); fetcher.mockResolvedValueOnce(envelope({ user: buyer })).mockResolvedValueOnce(envelope({ user: buyer }));
    await store.refresh(); const revision = store.getSnapshot().revision; await store.refresh(true);
    expect(store.getSnapshot().revision).toBe(revision);
  });
  it("keeps a visible account mounted while a focus recheck is pending, then invalidates on expiry", async () => {
    const { store, fetcher } = setup(), pending = deferred<Response>();
    fetcher.mockResolvedValueOnce(envelope({ user: buyer })).mockReturnValueOnce(pending.promise);
    await store.refresh(); const revision = store.getSnapshot().revision;
    const checking = store.refresh(true);
    expect(store.getSnapshot()).toMatchObject({ status: "authenticated", user: buyer, revision });
    pending.resolve(envelope({ user: null })); await checking;
    expect(store.getSnapshot()).toMatchObject({ status: "anonymous", user: null });
    expect(store.getSnapshot().revision).toBeGreaterThan(revision);
  });
  it("clears private state when the next server read returns an expired session or fails", async () => {
    const { store, fetcher } = setup(); fetcher.mockResolvedValueOnce(envelope({ user: buyer })).mockResolvedValueOnce(envelope({ user: null }));
    await store.refresh(); const revision = store.getSnapshot().revision; await store.refresh(true);
    expect(store.getSnapshot()).toMatchObject({ status: "anonymous", user: null }); expect(store.getSnapshot().revision).toBeGreaterThan(revision);
    fetcher.mockResolvedValueOnce(rejected(503, "UNAVAILABLE")); await store.refresh(); expect(store.getSnapshot()).toMatchObject({ status: "error", user: null });
  });
  it("clears account identity on private API 401 and rechecks the current role on 403", async () => {
    const { store, fetcher } = setup(); fetcher.mockResolvedValueOnce(envelope({ user: buyer })).mockResolvedValueOnce(rejected(401, "UNAUTHENTICATED"));
    await store.refresh(); await expect(store.accountRequest("/api/cart")).rejects.toMatchObject({ status: 401 }); expect(store.getSnapshot().user).toBeNull();
    fetcher.mockResolvedValueOnce(envelope({ user: buyer })).mockResolvedValueOnce(rejected(403, "FORBIDDEN")).mockResolvedValueOnce(envelope({ user: admin }));
    await store.refresh(); await expect(store.accountRequest("/api/cart")).rejects.toMatchObject({ status: 403 });
    await vi.waitFor(() => expect(store.getSnapshot()).toMatchObject({ status: "authenticated", user: admin }));
  });
  it("suspends a tab without allowing pending identity to reappear", async () => {
    const { store, fetcher } = setup(), pending = deferred<Response>(); fetcher.mockReturnValueOnce(pending.promise);
    const reading = store.refresh(); store.suspend(); pending.resolve(envelope({ user: buyer })); await reading;
    expect(store.getSnapshot()).toMatchObject({ status: "checking", user: null });
  });
});

it("preserves same-account drafts across routine tab revalidation but resets for another account", async () => {
  const { store, fetcher } = setup();
  fetcher.mockResolvedValueOnce(envelope({ user: buyer })); await store.refresh();
  const revision = store.getSnapshot().revision;
  const pending = deferred<Response>(); fetcher.mockReturnValueOnce(pending.promise);
  const refresh = store.refresh(true);
  expect(store.getSnapshot()).toMatchObject({ status: "authenticated", user: buyer, revision });
  pending.resolve(envelope({ user: buyer })); await refresh;
  expect(store.getSnapshot().revision).toBe(revision);
  fetcher.mockResolvedValueOnce(envelope({ user: admin })); await store.refresh(true);
  expect(store.getSnapshot().revision).toBeGreaterThan(revision);
});
