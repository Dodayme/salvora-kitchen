import { z } from "zod";
import { jsonBody } from "../api/input";
import { route, success } from "../api/response";
import { checkOrigin, requireRole, type Principal } from "../auth/access";
import { emptyObjectSchema } from "../auth/validation";
import { queryParameters } from "../catalog/validation";
import type { createBuyerService } from "../../services/buyer";

type Context = { service: ReturnType<typeof createBuyerService>; principal: () => Promise<Principal | null>; appUrl: string };
export function buyerHandlers(context: (request: Request) => Context) {
  const handle = (mutation: boolean, action: (ctx: Context & { user: Principal }, request: Request) => Promise<Response>) => {
    const wrapped = route(async request => {
      const ctx = context(request);
      if (mutation) checkOrigin(request, ctx.appUrl);
      const user = requireRole(await ctx.principal(), "BUYER");
      return action({ ...ctx, user }, request);
    });
    return async (request: Request) => { const response = await wrapped(request); response.headers.set("Vary", "Cookie"); return response; };
  };
  const body = (request: Request) => jsonBody(request, z.unknown());
  return {
    addresses: handle(false, async (ctx, request) => { const result = await ctx.service.addresses(ctx.user, queryParameters(request.url)); return success(result.data, { pagination: result.pagination }); }),
    createAddress: handle(true, async (ctx, request) => success(await ctx.service.createAddress(ctx.user, await body(request)), { status: 201 })),
    updateAddress: (request: Request, id: string) => handle(true, async (ctx, req) => success(await ctx.service.updateAddress(ctx.user, id, await body(req))))(request),
    deleteAddress: (request: Request, id: string) => handle(true, async (ctx, req) => { await jsonBody(req, emptyObjectSchema); await ctx.service.deleteAddress(ctx.user, id); return success(null); })(request),
    cart: handle(false, async ctx => success(await ctx.service.cart(ctx.user))),
    addItem: handle(true, async (ctx, request) => success(await ctx.service.addItem(ctx.user, await body(request)), { status: 201 })),
    setItem: (request: Request, id: string) => handle(true, async (ctx, req) => success(await ctx.service.setItem(ctx.user, id, await body(req))))(request),
    deleteItem: (request: Request, id: string) => handle(true, async (ctx, req) => { await jsonBody(req, emptyObjectSchema); return success(await ctx.service.deleteItem(ctx.user, id)); })(request),
  };
}
