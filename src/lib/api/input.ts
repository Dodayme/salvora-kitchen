import { z } from "zod";
import { ApiError } from "./errors";

// Limit actual streamed bytes, not only an untrusted Content-Length header.
export async function jsonBody<T extends z.ZodType>(request: Request, schema: T, limit = 65536): Promise<z.output<T>> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Gunakan Content-Type application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "INVALID_JSON", "Body JSON diperlukan.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ApiError(413, "BODY_TOO_LARGE", "Ukuran permintaan terlalu besar.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let input: unknown;
  try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ApiError(400, "INVALID_JSON", "JSON tidak valid."); }
  return schema.parse(input);
}

const positiveInteger = (fallback: string, max: number) => z.string().regex(/^[1-9]\d*$/).default(fallback).transform(Number).pipe(z.number().int().max(max));
export const paginationSchema = z.strictObject({ page: positiveInteger("1", 100000), pageSize: positiveInteger("20", 100) });

export function pagination(query: URLSearchParams) {
  for (const key of ["page", "pageSize"]) if (query.getAll(key).length > 1) throw new ApiError(422, "VALIDATION_ERROR", "Parameter pagination tidak boleh berulang.");
  return paginationSchema.parse({ page: query.get("page") ?? undefined, pageSize: query.get("pageSize") ?? undefined });
}

export function pageMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
