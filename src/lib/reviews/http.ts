import { z } from "zod";
import { jsonBody } from "../api/input";
import { route, success } from "../api/response";
import { checkOrigin, requireRole, type Principal } from "../auth/access";
import { queryParameters } from "../catalog/validation";
import type { createReviewService } from "../../services/reviews";

type Context = { service: ReturnType<typeof createReviewService>; principal: () => Promise<Principal | null>; appUrl: string };
export function reviewHandlers(context: (request: Request) => Context) {
  const privateHeaders = (handler: (request: Request) => Promise<Response>) => async (request: Request) => {
    const response = await handler(request); response.headers.set("Vary", "Cookie"); return response;
  };
  return {
    list: (request: Request, productId: string) => route(async req => {
      const result = await context(req).service.list(productId, queryParameters(req.url));
      return success(result.data, { pagination: result.pagination, ratingSummary: result.summary });
    })(request),
    create: (request: Request, itemId: string) => privateHeaders(route(async req => {
      const ctx = context(req); checkOrigin(req, ctx.appUrl);
      const user = requireRole(await ctx.principal(), "BUYER");
      return success(await ctx.service.create(user, itemId, await jsonBody(req, z.unknown())), { status: 201 });
    }))(request),
  };
}
