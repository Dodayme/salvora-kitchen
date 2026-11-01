import { z } from "zod";
import { jsonBody } from "../api/input";
import { route, success } from "../api/response";
import { checkOrigin, requirePrincipal, requireRole, type Principal } from "../auth/access";
import { queryParameters } from "../catalog/validation";
import type { createOrderService } from "../../services/orders";

type Context = { service: ReturnType<typeof createOrderService>; principal: () => Promise<Principal | null>; appUrl: string };
export function orderHandlers(context: (request: Request) => Context) {
  const handle = (access: "BUYER" | "ADMIN" | "OWNER", mutation: boolean, action: (ctx: Context & { user: Principal }, req: Request) => Promise<Response>) => {
    const wrapped = route(async req => {
      const ctx = context(req); if (mutation) checkOrigin(req, ctx.appUrl);
      const principal = await ctx.principal(), user = access === "OWNER" ? requirePrincipal(principal) : requireRole(principal, access);
      return action({ ...ctx, user }, req);
    });
    return async (request: Request) => { const response = await wrapped(request); response.headers.set("Vary", "Cookie"); return response; };
  };
  return {
    buyerOrders: handle("BUYER", false, async (ctx, req) => { const result = await ctx.service.buyerOrders(ctx.user, queryParameters(req.url)); return success(result.data, { pagination: result.pagination }); }),
    detail: (req: Request, id: string) => handle("OWNER", false, async ctx => success(await ctx.service.detail(ctx.user, id)))(req),
    adminDetail: (req: Request, id: string) => handle("ADMIN", false, async ctx => success(await ctx.service.detail(ctx.user, id)))(req),
    adminOrders: handle("ADMIN", false, async (ctx, req) => { const result = await ctx.service.adminOrders(ctx.user, queryParameters(req.url)); return success(result.data, { pagination: result.pagination }); }),
    adminPayments: handle("ADMIN", false, async (ctx, req) => { const result = await ctx.service.adminPayments(ctx.user, queryParameters(req.url)); return success(result.data, { pagination: result.pagination }); }),
    fulfill: (req: Request, id: string) => handle("ADMIN", true, async (ctx, request) => success(await ctx.service.fulfill(ctx.user, id, await jsonBody(request, z.unknown()))))(req),
    addNote: (req: Request, id: string) => handle("ADMIN", true, async (ctx, request) => success(await ctx.service.addNote(ctx.user, id, await jsonBody(request, z.unknown())), { status: 201 }))(req),
  };
}
