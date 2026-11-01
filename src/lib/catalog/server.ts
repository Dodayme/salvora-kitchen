import "server-only";
import { getAppConfig } from "../config/server";
import { getDatabase } from "../db";
import { authContext } from "../auth/server";
import { sessionToken } from "../auth/session";
import { createCatalogService } from "../../services/catalog";
import { catalogHandlers } from "./http";
import { createPhotoService } from "../../services/product-photos";
import { localPhotoStorage, photoDirectory } from "./photo-storage";
import { boundedPhotoFile } from "./photo-input";
import { checkOrigin, requireRole } from "../auth/access";
import { route, success } from "../api/response";

export const catalog = catalogHandlers(request => ({
  appUrl: getAppConfig().appUrl,
  service: createCatalogService(getDatabase()),
  principal: () => authContext().service.currentUser(sessionToken(request)),
}));

export const uploadPhoto = route(async request => {
  const { settings, service } = authContext();
  checkOrigin(request, settings.appUrl);
  const user = requireRole(await service.currentUser(sessionToken(request)), "ADMIN");
  const photos = createPhotoService(getDatabase(), localPhotoStorage(photoDirectory()));
  const file = await boundedPhotoFile(request);
  return success(await photos.upload(user, file), { status: 201 });
});

export const readPhoto = (request: Request, id: string) => route(async () => {
  getAppConfig();
  const principal = sessionToken(request) ? await authContext().service.currentUser(sessionToken(request)) : null;
  const photos = createPhotoService(getDatabase(), localPhotoStorage(photoDirectory()));
  const buffer = await photos.read(id, principal);
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "image/webp", "Content-Disposition": 'inline; filename="product.webp"', "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", "Vary": "Cookie" } });
})(request);
