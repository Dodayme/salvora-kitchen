import "server-only";
import { getAppConfig } from "../config/server";
import { getDatabase } from "../db";
import { authContext } from "../auth/server";
import { sessionToken } from "../auth/session";
import { createReviewService } from "../../services/reviews";
import { reviewHandlers } from "./http";

export const reviews = reviewHandlers(request => ({
  service: createReviewService(getDatabase()), appUrl: getAppConfig().appUrl,
  principal: () => authContext().service.currentUser(sessionToken(request)),
}));
