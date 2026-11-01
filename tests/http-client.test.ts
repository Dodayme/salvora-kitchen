import { describe, expect, it, vi } from "vitest";
import { ApiClientError, createApiClient, createLatestRead, isRequestAborted, retryAfterSeconds } from "@/lib/http/client";

const meta = { requestId: "test-request-001" };
const success = (data: unknown = null, extra = {}) => Response.json({ success: true, data, meta: { ...meta, ...extra } });
const client = (response: Response) => { const transport = vi.fn<typeof fetch>().mockResolvedValue(response); return { request: createApiClient(transport), transport }; };
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("API transport (in-memory fetch, no database/provider)", () => {
  it("preserves null and server pagination/rating metadata without fake defaults", async () => {
    const extra = { pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }, ratingSummary: { averageRating: null, reviewCount: 0 } };
    const { request, transport } = client(success(null, extra));
    await expect(request("/api/products?page=1")).resolves.toEqual({ data: null, meta: { ...meta, ...extra } });
    expect(transport).toHaveBeenCalledWith("/api/products?page=1", expect.objectContaining({ method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error" }));
  });
  it.each(["https://other.invalid/api/orders", "//other.invalid/api/orders", "/api/../private", "/api/products#secret", "/api/\\other.invalid", "http://["])("rejects unsafe path before transport: %s", async path => {
    const { request, transport } = client(success());
    await expect(request(path)).rejects.toThrow("Gunakan path API relatif");
    expect(transport).not.toHaveBeenCalled();
  });
  it("sends one JSON mutation with the caller's idempotency key", async () => {
    const { request, transport } = client(success({ id: "example" }));
    await request("/api/orders", { method: "POST", json: { quoteId: "example" }, headers: { "Idempotency-Key": "example-key" } });
    expect(transport).toHaveBeenCalledTimes(1);
    const options = transport.mock.calls[0][1]!;
    expect(options.body).toBe('{"quoteId":"example"}');
    expect(new Headers(options.headers).get("idempotency-key")).toBe("example-key");
    expect(new Headers(options.headers).get("content-type")).toBe("application/json");
  });
  it("lets the browser supply the multipart boundary", async () => {
    const { request, transport } = client(success());
    const form = new FormData(); form.set("photo", new Blob(["example"]), "example.png");
    await request("/api/admin/products/example/photo", { method: "POST", form, headers: { "Content-Type": "application/json" } });
    const options = transport.mock.calls[0][1]!;
    expect(options.body).toBe(form);
    expect(new Headers(options.headers).has("content-type")).toBe(false);
  });
  it("rejects ambiguous or GET bodies before fetch", async () => {
    const { request, transport } = client(success());
    await expect(request("/api/products", { json: {} })).rejects.toThrow(TypeError);
    await expect(request("/api/products", { method: "POST", json: {}, form: new FormData() })).rejects.toThrow(TypeError);
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([401, 403, 409, 422, 429, 503])("retains public error code/status/requestId for HTTP %i, without retry", async status => {
    const response = Response.json({ success: false, error: { code: "EXAMPLE_ERROR", message: "Pesan publik contoh", fields: [{ path: "items.0.quantity", code: "too_small", input: "PRIVATE_SENTINEL" }, { path: "invalid/path", code: "invalid" }] }, meta }, { status, headers: { "Retry-After": "60" } });
    const { request, transport } = client(response);
    const error = await request("/api/orders", { method: "POST", json: {} }).catch(error => error);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ kind: "http", status, code: "EXAMPLE_ERROR", message: "Pesan publik contoh", requestId: meta.requestId, fields: [{ path: "items.0.quantity", code: "too_small" }], retryAfterSeconds: 60 });
    expect(JSON.stringify(error)).not.toContain("PRIVATE_SENTINEL");
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each([404, 405])("handles non-JSON framework error %i without exposing HTML", async status => {
    const { request } = client(new Response("<html>PRIVATE_SENTINEL</html>", { status, headers: { "content-type": "text/html", "X-Request-Id": "test-header-id" } }));
    const error = await request("/api/missing").catch(error => error);
    expect(error).toMatchObject({ status, kind: "http", code: "HTTP_ERROR", requestId: "test-header-id" });
    expect(error.message).not.toContain("PRIVATE_SENTINEL");
  });
  it.each([
    () => new Response("PRIVATE_SENTINEL", { headers: { "content-type": "text/html" } }),
    () => new Response('{"PRIVATE_SENTINEL":', { headers: { "content-type": "application/json" } }),
    () => Response.json({ success: true, data: {}, meta: { requestId: "bad/id" } }),
    () => success([], { pagination: { page: 1, pageSize: 20, total: -1, totalPages: 0 } }),
    () => success([], { ratingSummary: { averageRating: 9, reviewCount: 2 } }),
  ])("rejects malformed success as protocol failure", async response => {
    const { request } = client(response());
    const error = await request("/api/products").catch(error => error);
    expect(error).toMatchObject({ kind: "protocol", code: "INVALID_RESPONSE" });
    expect(error.message).not.toContain("PRIVATE_SENTINEL");
  });
  it("sanitizes decoder failures without exposing data", async () => {
    const { request } = client(success({ value: "PRIVATE_SENTINEL" }));
    const error = await request("/api/products", { decode: () => { throw Error("PRIVATE_SENTINEL"); } }).catch(error => error);
    expect(error).toMatchObject({ kind: "protocol" });
    expect(String(error)).not.toContain("PRIVATE_SENTINEL");
  });
  it("does not replay an uncertain mutation or expose transport internals", async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(Error("PRIVATE_SENTINEL"));
    const error = await createApiClient(transport)("/api/orders", { method: "POST", json: {} }).catch(error => error);
    expect(error).toMatchObject({ kind: "network", code: "NETWORK_ERROR" });
    expect(String(error)).not.toContain("PRIVATE_SENTINEL");
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("distinguishes abort before fetch from network failure", async () => {
    const { request, transport } = client(success()); const controller = new AbortController(); controller.abort();
    const error = await request("/api/products", { signal: controller.signal }).catch(error => error);
    expect(isRequestAborted(error)).toBe(true);
    expect(transport).not.toHaveBeenCalled();
  });
  it("distinguishes abort while reading the response body", async () => {
    const response = success(); vi.spyOn(response, "json").mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const error = await client(response).request("/api/products").catch(error => error);
    expect(isRequestAborted(error)).toBe(true);
  });
  it("handles Retry-After seconds/date and rejects invalid or unsafe values", () => {
    const now = Date.parse("2026-10-24T03:00:00Z");
    expect(retryAfterSeconds("60", now)).toBe(60);
    expect(retryAfterSeconds("Sat, 24 Oct 2026 03:00:12 GMT", now)).toBe(12);
    expect(retryAfterSeconds("Sat, 24 Oct 2026 02:59:00 GMT", now)).toBe(0);
    for (const value of [null, "-1", "1.5", "tomorrow", "999999999999999999999"]) expect(retryAfterSeconds(value, now)).toBeUndefined();
  });
});

describe("Latest-only reads", () => {
  it("ignores an older response even when transport ignores abort", async () => {
    const reader = createLatestRead<string>(), old = deferred<string>();
    let oldSignal: AbortSignal | undefined;
    const first = reader.run(signal => { oldSignal = signal; return old.promise; });
    const second = reader.run(async () => "new");
    expect(oldSignal?.aborted).toBe(true);
    await expect(second).resolves.toEqual({ status: "success", data: "new" });
    old.resolve("old"); await expect(first).resolves.toEqual({ status: "superseded" });
  });
  it("ignores stale errors but propagates the current failure", async () => {
    const reader = createLatestRead<string>(), old = deferred<string>();
    const first = reader.run(() => old.promise);
    await reader.run(async () => "new");
    old.reject(Error("stale")); await expect(first).resolves.toEqual({ status: "superseded" });
    await expect(reader.run(async () => { throw Error("current"); })).rejects.toThrow("current");
  });
  it("cancels on cleanup and remains reusable", async () => {
    const reader = createLatestRead<string>(), pending = deferred<string>();
    const result = reader.run(() => pending.promise); reader.cancel(); pending.resolve("late");
    await expect(result).resolves.toEqual({ status: "superseded" });
    await expect(reader.run(async () => "next")).resolves.toEqual({ status: "success", data: "next" });
  });
});
