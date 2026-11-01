import { authContext } from "@/lib/auth/server";
import { authHandlers } from "@/lib/auth/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = authHandlers(authContext).session;
