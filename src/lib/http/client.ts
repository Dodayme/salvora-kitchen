/** Browser-safe API transport. No ORM, secrets, payment SDK, storage or logging. */
export type PaginationMeta = { page: number; pageSize: number; total: number; totalPages: number };
export type ApiMeta = { requestId: string; pagination?: PaginationMeta; ratingSummary?: { averageRating: number | null; reviewCount: number } };
export type ApiResult<T> = { data: T; meta: ApiMeta };
export type FieldIssue = { path: string; code: string };
type ErrorKind = "http" | "network" | "protocol" | "aborted";

export class ApiClientError extends Error {
  readonly name = "ApiClientError";
  constructor(readonly status: number, readonly code: string, message: string, readonly kind: ErrorKind = "http", readonly requestId?: string, readonly fields: FieldIssue[] = [], readonly retryAfterSeconds?: number) { super(message); }
}
export const isRequestAborted = (error: unknown) => error instanceof ApiClientError && error.kind === "aborted" || error instanceof Error && error.name === "AbortError";
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const safeRequestId = (value: unknown) => identifier(value) ? value : undefined;
const integer = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function retryAfterSeconds(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) { const seconds = Number(value); return Number.isSafeInteger(seconds) ? seconds : undefined; }
  if (!/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)) return undefined;
  const deadline = Date.parse(value); return Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : undefined;
}

function messageFor(status: number) {
  if (status === 401) return "Silakan masuk kembali untuk melanjutkan.";
  if (status === 403) return "Anda tidak memiliki akses untuk tindakan ini.";
  if (status === 404) return "Data yang Anda cari tidak tersedia.";
  if (status === 405) return "Tindakan ini tidak tersedia.";
  if (status === 409) return "Data sudah berubah. Muat ulang dan tinjau sebelum mencoba lagi.";
  if (status === 422) return "Periksa kembali isian Anda.";
  if (status === 429) return "Terlalu banyak permintaan. Tunggu sebelum mencoba lagi.";
  if (status === 503) return "Layanan sementara belum tersedia. Periksa status sebelum mencoba lagi.";
  return "Permintaan belum dapat diselesaikan. Silakan coba kembali nanti.";
}
function metadata(value: unknown): ApiMeta | null {
  if (!object(value) || !safeRequestId(value.requestId)) return null;
  const meta: ApiMeta = { requestId: value.requestId as string };
  if (value.pagination !== undefined) {
    const p = value.pagination;
    if (!object(p) || !integer(p.page) || p.page < 1 || !integer(p.pageSize) || p.pageSize < 1 || !integer(p.total) || !integer(p.totalPages)) return null;
    meta.pagination = { page: p.page, pageSize: p.pageSize, total: p.total, totalPages: p.totalPages };
  }
  if (value.ratingSummary !== undefined) {
    const r = value.ratingSummary;
    if (!object(r) || !integer(r.reviewCount) || !(r.averageRating === null || typeof r.averageRating === "number" && Number.isFinite(r.averageRating) && r.averageRating >= 1 && r.averageRating <= 5)) return null;
    meta.ratingSummary = { averageRating: r.averageRating, reviewCount: r.reviewCount };
  }
  return meta;
}
function validatePath(path: string) {
  if (!path.startsWith("/api/") || path.includes("\\")) throw new TypeError("Gunakan path API relatif pada origin aplikasi.");
  const url = new URL(path, "https://same-origin.invalid");
  if (!path.startsWith("/api/") || path.includes("\\") || url.origin !== "https://same-origin.invalid" || !url.pathname.startsWith("/api/") || url.hash) throw new TypeError("Gunakan path API relatif pada origin aplikasi.");
}
export type ApiRequestOptions<T> = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  json?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  headers?: HeadersInit;
  decode?: (data: unknown) => T;
};

export function createApiClient(transport: typeof fetch) {
  return async function request<T>(path: string, options: ApiRequestOptions<T> = {}): Promise<ApiResult<T>> {
    validatePath(path);
    const { method = "GET", json, form, signal, decode } = options;
    if (json !== undefined && form !== undefined || method === "GET" && (json !== undefined || form !== undefined)) throw new TypeError("Body permintaan tidak sesuai metode.");
    const headers = new Headers(options.headers); headers.set("Accept", "application/json");
    if (json !== undefined) headers.set("Content-Type", "application/json");
    if (form !== undefined) headers.delete("Content-Type"); // Browser supplies multipart boundary.
    try {
      if (signal?.aborted) throw new ApiClientError(0, "REQUEST_ABORTED", "Permintaan dibatalkan.", "aborted");
      const response = await transport(path, { method, headers, signal, credentials: "same-origin", cache: "no-store", redirect: "error", ...(form !== undefined ? { body: form } : json !== undefined ? { body: JSON.stringify(json) } : {}) });
      let payload: unknown;
      if (/^application\/(?:[\w.+-]+\+)?json(?:;|$)/i.test(response.headers.get("content-type") ?? "")) {
        try { payload = await response.json(); }
        catch (error) { if (isRequestAborted(error) || signal?.aborted) throw error; }
      }
      const requestId = safeRequestId(response.headers.get("x-request-id")) ?? (object(payload) && object(payload.meta) ? safeRequestId(payload.meta.requestId) : undefined);
      if (!response.ok) {
        const error = object(payload) && payload.success === false && object(payload.error) ? payload.error : null;
        const fields = Array.isArray(error?.fields) ? error.fields.flatMap(issue => object(issue) && typeof issue.path === "string" && /^[\w.]{1,128}$/.test(issue.path) && identifier(issue.code) ? [{ path: issue.path, code: issue.code }] : []).slice(0, 100) : [];
        // Public server messages remain server-owned; never copy raw response/error bodies.
        const message = typeof error?.message === "string" && error.message.length <= 500 ? error.message : messageFor(response.status);
        throw new ApiClientError(response.status, identifier(error?.code) ? error.code : "HTTP_ERROR", message, "http", requestId, fields, retryAfterSeconds(response.headers.get("retry-after")));
      }
      const meta = object(payload) ? metadata(payload.meta) : null;
      if (!object(payload) || payload.success !== true || !("data" in payload) || !meta) throw new ApiClientError(response.status, "INVALID_RESPONSE", "Respons server tidak dapat dibaca. Periksa keadaan terbaru sebelum mencoba lagi.", "protocol", requestId);
      let data: T;
      try { data = decode ? decode(payload.data) : payload.data as T; }
      catch { throw new ApiClientError(response.status, "INVALID_RESPONSE", "Bentuk data server belum sesuai. Silakan muat ulang.", "protocol", requestId); }
      return { data, meta };
    } catch (error) {
      if (isRequestAborted(error) || signal?.aborted) throw new ApiClientError(0, "REQUEST_ABORTED", "Permintaan dibatalkan.", "aborted");
      if (error instanceof ApiClientError) throw error;
      throw new ApiClientError(0, "NETWORK_ERROR", "Koneksi terputus. Periksa keadaan terbaru sebelum mencoba lagi.", "network");
    }
  };
}
// Lazy wrapper permits testing/importing without network or reading environment.
export const apiRequest = <T>(path: string, options?: ApiRequestOptions<T>) => createApiClient((...args) => fetch(...args))<T>(path, options);

/** Latest-only reads, even when an older transport ignores AbortSignal. Never use for mutations. */
export function createLatestRead<T>() {
  let generation = 0, controller: AbortController | undefined;
  return {
    async run(read: (signal: AbortSignal) => Promise<T>): Promise<{ status: "success"; data: T } | { status: "superseded" }> {
      const current = ++generation; controller?.abort(); const request = new AbortController(); controller = request;
      try { const data = await read(request.signal); return current === generation && !request.signal.aborted ? { status: "success", data } : { status: "superseded" }; }
      catch (error) { if (current !== generation || request.signal.aborted || isRequestAborted(error)) return { status: "superseded" }; throw error; }
      finally { if (current === generation) controller = undefined; }
    },
    cancel() { generation++; controller?.abort(); controller = undefined; },
  };
}
