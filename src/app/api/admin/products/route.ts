import { catalog } from "@/lib/catalog/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = catalog.adminProducts;
export const POST = catalog.createProduct;
