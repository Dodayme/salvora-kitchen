import { jsonBody } from "../api/input";
import { route, success } from "../api/response";
import { checkOrigin, requireRole, type Principal } from "../auth/access";
import { emptyObjectSchema } from "../auth/validation";
import { queryParameters } from "./validation";
import { createCatalogService } from "../../services/catalog";
import { z } from "zod";

type Context = {
  service: ReturnType<typeof createCatalogService>;
  principal: () => Promise<Principal | null>;
  appUrl: string;
};
const jsonInput = (request: Request) => jsonBody(request, z.unknown());

export function catalogHandlers(context: (request: Request) => Context) {
  const admin = async (request: Request, mutation = false) => {
    const ctx = context(request);
    if (mutation) checkOrigin(request, ctx.appUrl);
    const principal = requireRole(await ctx.principal(), "ADMIN");
    return { ...ctx, user: principal };
  };
  return {
    categories: route(async request => { const result = await context(request).service.publicCategories(queryParameters(request.url)); return success(result.data, { pagination: result.pagination }); }),
    products: route(async request => { const result = await context(request).service.publicProducts(queryParameters(request.url)); return success(result.data, { pagination: result.pagination }); }),
    product: (request: Request, id: string) => route(async () => success(await context(request).service.publicProduct(id)))(request),
    adminCategories: route(async request => { const ctx = await admin(request); const result = await ctx.service.adminCategories(ctx.user, queryParameters(request.url)); return success(result.data, { pagination: result.pagination }); }),
    createCategory: route(async request => { const ctx = await admin(request, true); return success(await ctx.service.createCategory(ctx.user, await jsonInput(request)), { status: 201 }); }),
    updateCategory: (request: Request, id: string) => route(async () => { const ctx = await admin(request, true); return success(await ctx.service.updateCategory(ctx.user, id, await jsonInput(request))); })(request),
    deleteCategory: (request: Request, id: string) => route(async () => { const ctx = await admin(request, true); await jsonBody(request, emptyObjectSchema); await ctx.service.deleteCategory(ctx.user, id); return success(null); })(request),
    adminProducts: route(async request => { const ctx = await admin(request); const result = await ctx.service.adminProducts(ctx.user, queryParameters(request.url)); return success(result.data, { pagination: result.pagination }); }),
    adminProduct: (request: Request, id: string) => route(async () => { const ctx = await admin(request); return success(await ctx.service.adminProduct(ctx.user, id)); })(request),
    createProduct: route(async request => { const ctx = await admin(request, true); return success(await ctx.service.createProduct(ctx.user, await jsonInput(request)), { status: 201 }); }),
    updateProduct: (request: Request, id: string) => route(async () => { const ctx = await admin(request, true); return success(await ctx.service.updateProduct(ctx.user, id, await jsonInput(request))); })(request),
    updateStock: (request: Request, id: string) => route(async () => { const ctx = await admin(request, true); return success(await ctx.service.updateStock(ctx.user, id, await jsonInput(request))); })(request),
  };
}
