import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "../generated/prisma/client";
import { ApiError } from "../lib/api/errors";
import { requireRole, type Principal } from "../lib/auth/access";
import { normalizePhoto } from "../lib/catalog/photo-input";
import type { PhotoStorage } from "../lib/catalog/photo-storage";

export function createPhotoService(db: PrismaClient, storage: PhotoStorage) {
  return {
    async upload(principal: Principal | null, file: File) {
      const admin = requireRole(principal, "ADMIN");
      const photo = await normalizePhoto(file);
      const id = randomUUID(), key = `${id}.webp`;
      await storage.write(key, photo.buffer);
      try {
        await db.productPhoto.create({ data: { id, key, contentType: "image/webp", byteSize: photo.buffer.byteLength, width: photo.width, height: photo.height, sha256: createHash("sha256").update(photo.buffer).digest("hex"), createdById: admin.id } });
      } catch (error) {
        await storage.remove(key);
        throw error;
      }
      return { photoId: id, url: `/api/product-photos/${id}` };
    },
    async read(id: string, principal: Principal | null = null) {
      z.uuid().parse(id);
      const photo = await db.productPhoto.findFirst({ where: { id, ...(principal?.role === "ADMIN" ? {} : { products: { some: { isActive: true, category: { isActive: true } } } }) }, select: { key: true } });
      if (!photo) throw new ApiError(404, "NOT_FOUND", "Foto tidak ditemukan.");
      try { return await storage.read(photo.key); }
      catch { throw new ApiError(404, "NOT_FOUND", "Foto tidak ditemukan."); }
    },
  };
}
