import { notFound } from "next/navigation";
import { validProductId } from "@/lib/catalog-client/model";
import { ProductDetail } from "@/components/catalog/product-detail";
export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) { const { productId } = await params; if (!validProductId(productId)) notFound(); return <ProductDetail key={productId} id={productId} />; }
