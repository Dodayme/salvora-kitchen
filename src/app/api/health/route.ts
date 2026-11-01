import { route, success } from "@/lib/api/response";
import { configurationHealth } from "@/services/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = route(async () => success(configurationHealth()));
