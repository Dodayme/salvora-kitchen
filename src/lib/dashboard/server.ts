import "server-only";
import { getDatabase } from "../db";
import { authContext } from "../auth/server";
import { sessionToken } from "../auth/session";
import { createDashboardService } from "../../services/dashboard";
import { dashboardHandlers } from "./http";

export const dashboard = dashboardHandlers(request => ({
  service: createDashboardService(getDatabase()),
  principal: () => authContext().service.currentUser(sessionToken(request)),
}));
