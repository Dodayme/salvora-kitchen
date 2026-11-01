import { jsonBody } from "../api/input";
import { route, success } from "../api/response";
import { checkOrigin, requireRole, type Principal } from "../auth/access";
import { emptyObjectSchema } from "../auth/validation";
import type { createPaymentService } from "../../services/payments";

type Context = { service: ReturnType<typeof createPaymentService>; principal: () => Promise<Principal | null>; appUrl: string };
export function paymentHandler(context: (request: Request) => Context) {
  return async (request: Request, orderId: string) => {
    const response = await route(async req => {
      const ctx = context(req); checkOrigin(req, ctx.appUrl);
      const principal = requireRole(await ctx.principal(), "BUYER");
      await jsonBody(req, emptyObjectSchema);
      const data = await ctx.service.pay(principal, orderId);
      const ready = !!data.snapToken && !!data.redirectUrl;
      return success(data, { status: ready ? data.reused ? 200 : 201 : 202 });
    })(request);
    response.headers.set("Vary", "Cookie");
    return response;
  };
}
