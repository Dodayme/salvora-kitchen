import { route, success } from "@/lib/api/response";
import { requireSessionUser } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db";
import { createVoucherService } from "@/services/vouchers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const read = route(async request => success(await createVoucherService(getDatabase()).mine(await requireSessionUser(request, "BUYER"))));
export async function GET(request: Request) {
  const response = await read(request);
  response.headers.set("Vary", "Cookie");
  return response;
}
