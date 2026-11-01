import "server-only";
import { getAppConfig } from "../config/server";
import { getDatabase } from "../db";
import { authContext } from "../auth/server";
import { sessionToken } from "../auth/session";
import { createCheckoutService } from "../../services/checkout";
import { checkoutHandlers } from "./http";

export const checkout = checkoutHandlers(request => ({
  appUrl: getAppConfig().appUrl, service: createCheckoutService(getDatabase()),
  principal: () => authContext().service.currentUser(sessionToken(request)),
}));
