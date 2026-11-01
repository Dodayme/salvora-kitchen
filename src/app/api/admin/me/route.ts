import { authContext } from "@/lib/auth/server";
import { authHandlers } from "@/lib/auth/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handlers = authHandlers(authContext);
export const GET = handlers.adminGet;
export const PATCH = handlers.adminPatch;
