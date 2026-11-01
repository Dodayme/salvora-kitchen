import sharp from "sharp";
import { ApiError } from "../api/errors";
import { MAX_PHOTO_BYTES } from "./validation";

export async function boundedPhotoFile(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Gunakan multipart/form-data dengan satu file.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "INVALID_MULTIPART", "File foto diperlukan.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PHOTO_BYTES + 65536) { await reader.cancel(); throw new ApiError(413, "BODY_TOO_LARGE", "Ukuran unggahan terlalu besar."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": contentType } }).formData(); }
  catch { throw new ApiError(400, "INVALID_MULTIPART", "Data unggahan tidak valid."); }
  const entries = [...form.entries()];
  if (entries.length !== 1 || entries[0][0] !== "file" || !(entries[0][1] instanceof File)) throw new ApiError(422, "VALIDATION_ERROR", "Unggah tepat satu field file.", [{ path: "file", code: "invalid_file" }]);
  return entries[0][1];
}

export async function normalizePhoto(file: File) {
  if (file.size === 0 || file.size > MAX_PHOTO_BYTES) throw new ApiError(413, "PHOTO_TOO_LARGE", "Foto harus berisi data dan maksimal 2.000.000 byte.");
  const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
  const expected = formats[file.type.toLowerCase()];
  if (!expected) throw new ApiError(422, "INVALID_PHOTO", "Gunakan foto JPEG, PNG, atau WebP yang valid.");
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { failOn: "warning", limitInputPixels: 20000000 });
    const metadata = await image.metadata();
    if (metadata.format !== expected || (metadata.pages ?? 1) !== 1) throw new Error("Invalid format or animation");
    // Full decode + re-encode strips embedded metadata and ignores the supplied filename/path.
    const output = await image.rotate().webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
    if (output.data.byteLength > MAX_PHOTO_BYTES) throw new ApiError(413, "PHOTO_TOO_LARGE", "Hasil foto melebihi 2.000.000 byte.");
    return { buffer: output.data, width: output.info.width, height: output.info.height };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, "INVALID_PHOTO", "Foto rusak, format tidak cocok, animasi, atau dimensi terlalu besar.");
  }
}
