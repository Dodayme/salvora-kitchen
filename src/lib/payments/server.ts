import "server-only";
import { getAppConfig, getSnapConfig } from "../config/server";
import { getDatabase } from "../db";
import { authContext } from "../auth/server";
import { sessionToken } from "../auth/session";
import { createPaymentService } from "../../services/payments";
import { createSnapGateway } from "./snap";
import { paymentHandler } from "./http";

export const payOrder = paymentHandler(request => ({
  appUrl: getAppConfig().appUrl,
  principal: () => authContext().service.currentUser(sessionToken(request)),
  service: createPaymentService(getDatabase(), () => createSnapGateway(getSnapConfig())),
}));
