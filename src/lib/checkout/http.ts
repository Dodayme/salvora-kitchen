import { jsonBody } from "../api/input";
import { route, success } from "../api/response";
import { checkOrigin, requireRole, type Principal } from "../auth/access";
import { quoteInputSchema, orderInputSchema, idempotencyKeySchema } from "./validation";
import type { createCheckoutService } from "../../services/checkout";

type Context = { service: ReturnType<typeof createCheckoutService>; principal: () => Promise<Principal | null>; appUrl: string };
export function checkoutHandlers(context: (request: Request) => Context) {
  const handle = (action: (ctx: Context & { user: Principal }, request: Request) => Promise<Response>) => {
    const wrapped = route(async request => {
      const ctx = context(request); checkOrigin(request, ctx.appUrl);
      const user = requireRole(await ctx.principal(), "BUYER");
      return action({ ...ctx, user }, request);
    });
    return async (request: Request) => { const result = await wrapped(request); result.headers.set("Vary", "Cookie"); return result; };
  };
  return {
    quote: handle(async (ctx, request) => success(await ctx.service.quote(ctx.user, await jsonBody(request, quoteInputSchema)), { status: 201 })),
    order: handle(async (ctx, request) => {
      const key = idempotencyKeySchema.parse(request.headers.get("Idempotency-Key"));
      const result = await ctx.service.order(ctx.user, await jsonBody(request, orderInputSchema), key);
      return success(result.data, { status: result.replayed ? 200 : 201 });
    }),
  };
}
