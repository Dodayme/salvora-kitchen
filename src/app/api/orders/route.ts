import { checkout } from "@/lib/checkout/server";
import { orders } from "@/lib/orders/server";
export const runtime = "nodejs";
export const POST = checkout.order;
export const GET = orders.buyerOrders;
