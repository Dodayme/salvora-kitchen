import "server-only";
import { getAppConfig } from "../config/server";
import { getDatabase } from "../db";
import { authContext } from "../auth/server";
import { sessionToken } from "../auth/session";
import { createBuyerService } from "../../services/buyer";
import { buyerHandlers } from "./http";

export const buyer = buyerHandlers(request => ({
  appUrl: getAppConfig().appUrl, service: createBuyerService(getDatabase()),
  principal: () => authContext().service.currentUser(sessionToken(request)),
}));
