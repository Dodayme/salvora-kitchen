import { authContext } from "@/lib/auth/server";
import { authHandlers } from "@/lib/auth/http";
export const runtime = "nodejs";
export const POST = authHandlers(authContext).register;
