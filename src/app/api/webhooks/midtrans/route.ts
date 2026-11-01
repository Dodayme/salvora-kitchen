import { getSnapConfig } from "@/lib/config/server";
import { getDatabase } from "@/lib/db";
import { jsonBody } from "@/lib/api/input";
import { route, success } from "@/lib/api/response";
import { notificationSchema, createStatusGateway } from "@/lib/payments/status";
import { createPaymentVerificationService } from "@/services/payment-verification";

export const runtime = "nodejs";
export const POST = route(async request => {
  const payload = await jsonBody(request, notificationSchema);
  const settings = getSnapConfig();
  const service = createPaymentVerificationService(getDatabase(), { serverKey: settings.serverKey, gateway: createStatusGateway(settings.serverKey) });
  return success(await service.notification(payload));
});
