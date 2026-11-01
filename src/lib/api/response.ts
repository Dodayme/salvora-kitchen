import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { ApiError } from "./errors";

export function success<T>(data: T, options: { status?: number; requestId?: string; pagination?: { page: number; pageSize: number; total: number; totalPages: number }; ratingSummary?: { averageRating: number | null; reviewCount: number } } = {}) {
  const requestId = options.requestId ?? randomUUID();
  return Response.json({ success: true, data, meta: { requestId, ...(options.pagination ? { pagination: options.pagination } : {}), ...(options.ratingSummary ? { ratingSummary: options.ratingSummary } : {}) } }, {
    status: options.status ?? 200,
    headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
  });
}

export function failure(error: unknown, requestId = randomUUID()) {
  const safe = error instanceof ApiError ? error : error instanceof ZodError
    ? new ApiError(422, "VALIDATION_ERROR", "Input tidak valid.", error.issues.map(issue => ({ path: issue.path.join("."), code: issue.code })))
    : new ApiError(500, "INTERNAL_ERROR", "Terjadi kesalahan pada server.");
  return Response.json({ success: false, error: { code: safe.code, message: safe.publicMessage, ...(safe.fields ? { fields: safe.fields } : {}) }, meta: { requestId } }, {
    status: safe.status,
    headers: { "Cache-Control": "no-store", "X-Request-Id": requestId, ...(safe.retryAfterSeconds ? { "Retry-After": String(safe.retryAfterSeconds) } : {}) },
  });
}

export function route(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try { return await handler(request); }
    catch (error) { return failure(error); }
  };
}
