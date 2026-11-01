import { NextResponse } from "next/server";
import { success, route } from "../api/response";
import { jsonBody } from "../api/input";
import { checkOrigin } from "./access";
import { sessionToken, SESSION_COOKIE } from "./session";
import { adminProfileSchema, emptyObjectSchema, loginSchema, registerSchema } from "./validation";
import type { AuthResult, AuthService, AuthSettings } from "../../services/auth";

type Context = { service: AuthService; settings: AuthSettings };

export function sessionResponse(response: Response, settings: AuthSettings, session: AuthResult["session"] | null) {
  const result = new NextResponse(response.body, { status: response.status, headers: response.headers });
  result.headers.set("Vary", "Cookie");
  result.cookies.set(SESSION_COOKIE, session?.token ?? "", {
    httpOnly: true, secure: new URL(settings.appUrl).protocol === "https:", sameSite: "lax", path: "/",
    expires: session?.expiresAt ?? new Date(0), maxAge: session ? settings.sessionTtlDays * 86400 : 0,
  });
  return result;
}

const privateResponse = (data: unknown) => {
  const response = success(data);
  response.headers.set("Vary", "Cookie");
  return response;
};

// Context resolves lazily inside the error wrapper, so missing config is a safe 503.
export function authHandlers(context: () => Context) {
  return {
    register: route(async request => {
      const { service, settings } = context();
      checkOrigin(request, settings.appUrl);
      const input = await jsonBody(request, registerSchema);
      const result = await service.register(input, sessionToken(request));
      return sessionResponse(success({ user: result.user }, { status: 201 }), settings, result.session);
    }),
    login: route(async request => {
      const { service, settings } = context();
      checkOrigin(request, settings.appUrl);
      const input = await jsonBody(request, loginSchema);
      const result = await service.login(input, sessionToken(request));
      return sessionResponse(success({ user: result.user }), settings, result.session);
    }),
    logout: route(async request => {
      const { service, settings } = context();
      checkOrigin(request, settings.appUrl);
      await jsonBody(request, emptyObjectSchema);
      await service.logout(sessionToken(request));
      return sessionResponse(success(null), settings, null);
    }),
    session: route(async request => privateResponse({ user: await context().service.currentUser(sessionToken(request)) })),
    adminGet: route(async request => privateResponse(await context().service.adminProfile(sessionToken(request)))),
    adminPatch: route(async request => {
      const { service, settings } = context();
      checkOrigin(request, settings.appUrl);
      // Reject unauthenticated/non-admin requests before processing profile input.
      await service.adminProfile(sessionToken(request));
      const input = await jsonBody(request, adminProfileSchema);
      return privateResponse(await service.updateAdminProfile(sessionToken(request), input));
    }),
  };
}
