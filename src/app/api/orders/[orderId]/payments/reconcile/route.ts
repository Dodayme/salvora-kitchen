import { getAppConfig, getSnapConfig } from "@/lib/config/server";
import { getDatabase } from "@/lib/db";
import { requireSessionUser } from "@/lib/auth/server";
import { checkOrigin } from "@/lib/auth/access";
import { jsonBody } from "@/lib/api/input";
import { route, success } from "@/lib/api/response";
import { emptyObjectSchema } from "@/lib/auth/validation";
import { createStatusGateway } from "@/lib/payments/status";
import { createReconciliationService } from "@/services/reconciliation";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const response = await route(async req => {
    const app = getAppConfig(); checkOrigin(req, app.appUrl);
    const user = await requireSessionUser(req);
    await jsonBody(req, emptyObjectSchema);
    const settings = getSnapConfig();
    const service = createReconciliationService(getDatabase(), { ...settings, authSecret: app.authSecret, gateway: createStatusGateway(settings.serverKey) });
    return success(await service.reconcile(user, (await context.params).orderId));
  })(request);
  response.headers.set("Vary", "Cookie");
  return response;
}
