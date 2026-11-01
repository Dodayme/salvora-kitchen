import { requireRole, type Principal } from "../auth/access";
import { route, success } from "../api/response";
import { queryParameters } from "../catalog/validation";
import type { createDashboardService } from "../../services/dashboard";

type Context = { service: ReturnType<typeof createDashboardService>; principal: () => Promise<Principal | null> };
export function dashboardHandlers(context: (request: Request) => Context) {
  const handle = (action: (ctx: Context, user: Principal, query: Record<string, string>) => Promise<Response>) => {
    const wrapped = route(async request => {
      const ctx = context(request), user = requireRole(await ctx.principal(), "ADMIN");
      return action(ctx, user, queryParameters(request.url));
    });
    return async (request: Request) => { const response = await wrapped(request); response.headers.set("Vary", "Cookie"); return response; };
  };
  return {
    dashboard: handle(async (ctx, user, query) => success(await ctx.service.dashboard(user, query))),
    vouchers: handle(async (ctx, user, query) => { const result = await ctx.service.vouchers(user, query); return success(result.data, { pagination: result.pagination }); }),
    policy: handle(async (ctx, user, query) => success(await ctx.service.policy(user, query))),
  };
}
