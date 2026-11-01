import "server-only";
import { appConfig, paymentConfig, snapConfig } from "./schema";

// Lazy validation keeps build/static pages independent of DB and merchant credentials.
export const getAppConfig = () => appConfig(process.env);
export const getPaymentConfig = () => paymentConfig(process.env);
export const getSnapConfig = () => snapConfig(process.env);
