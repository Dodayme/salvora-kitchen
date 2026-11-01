import { mkdir, readFile, writeFile, unlink, lstat } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "../api/errors";
import type { Environment } from "../config/schema";

const validKey = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/;
export function photoDirectory(environment: Environment = process.env) {
  if (environment.NODE_ENV === "test") return path.resolve(".local/uploads/product-photos-test");
  const configured = environment.PRODUCT_PHOTO_STORAGE_DIR;
  if (environment.NODE_ENV === "production" && (!configured || environment.PRODUCT_PHOTO_STORAGE_PERSISTENT !== "true")) throw new ApiError(503, "PHOTO_STORAGE_NOT_CONFIGURED", "Penyimpanan foto persisten belum dikonfigurasi.");
  const directory = configured ? path.resolve(configured) : path.resolve(".local/uploads/product-photos");
  const publicRoot = path.resolve("public");
  const relative = path.relative(publicRoot, directory);
  if (configured && !path.isAbsolute(configured) || relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) throw new ApiError(503, "PHOTO_STORAGE_NOT_CONFIGURED", "Lokasi penyimpanan foto tidak valid.");
  return directory;
}

export function localPhotoStorage(directory: string) {
  const root = path.resolve(directory);
  const filename = (key: string) => {
    if (!validKey.test(key)) throw new ApiError(422, "INVALID_PHOTO_KEY", "Referensi foto tidak valid.");
    return path.join(root, key);
  };
  return {
    async write(key: string, buffer: Buffer) {
      await mkdir(root, { recursive: true });
      if ((await lstat(root)).isSymbolicLink()) throw new Error("Storage directory cannot be a symlink");
      await writeFile(filename(key), buffer, { flag: "wx", mode: 0o600 });
    },
    async read(key: string) {
      const file = filename(key);
      if (!(await lstat(file)).isFile() || (await lstat(file)).isSymbolicLink()) throw new Error("Invalid storage entry");
      return readFile(file);
    },
    async remove(key: string) {
      try { await unlink(filename(key)); }
      catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
    },
  };
}
export type PhotoStorage = ReturnType<typeof localPhotoStorage>;
