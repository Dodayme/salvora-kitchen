import "server-only";
import { getAppConfig } from "../config/server";
import { getDatabase } from "../db";
import { authContext } from "../auth/server";
import { sessionToken } from "../auth/session";
import { createOrderService } from "../../services/orders";
import { orderHandlers } from "./http";

export const orders = orderHandlers(request => ({
  appUrl: getAppConfig().appUrl,
  service: createOrderService(getDatabase(), { completionEnabled: true }),
  principal: () => authContext().service.currentUser(sessionToken(request)),
}));
