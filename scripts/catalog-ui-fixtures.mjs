import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
export const catalogCommands = ["stock-low", "hide-product", "catalog-error", "catalog-recover", "reviews-mock", "cart-response-lost", "address-response-lost", "voucher-reserved-mock", "voucher-used-mock", "voucher-null-mock", "addresses-page", "price-change", "price-overflow"];
export async function createCatalogFixtures(db, run, emails, { buyerMode = false, directory = ".local/fe03" } = {}) {
  const categoryId = `fe03-${run}-category`, emptyCategoryId = `fe03-${run}-empty`, hiddenCategoryId = `fe03-${run}-hidden`;
  const productIds = Array.from({ length: 13 }, (_, i) => `fe03-${run}-product-${i}`);
  const tables = ["Category", "Product", "Order", "Payment", "Rating", ...(buyerMode ? ["Address", "Cart", "CartItem"] : [])];
  async function fingerprint() {
    const result = {};
    for (const table of tables) result[table] = await db.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY t.id),'')) AS digest FROM "${table}" t`);
    return result;
  }
  const baseline = await fingerprint();
  await db.$transaction(async tx => {
    await tx.category.createMany({ data: [{ id: categoryId, name: "FE03 Risol Demo", isActive: true, isDemo: true }, { id: emptyCategoryId, name: "FE03 Kategori Kosong", isActive: true, isDemo: true }, { id: hiddenCategoryId, name: "FE03 Kategori Nonaktif", isActive: false, isDemo: true }] });
    await tx.product.createMany({ data: productIds.map((id, i) => ({ id, categoryId: i === 12 ? hiddenCategoryId : categoryId, name: `FE03 Risol ${String(i + 1).padStart(2, "0")}`, description: "Produk fixture UI terisolasi; bukan katalog resmi.", price: 3500 + i * 100, physicalStock: i === 1 ? 0 : 8, isActive: i !== 11, isDemo: true, imageUrl: i === 2 ? "/images/fe03-missing-photo.png" : null })) });
  });
  let listError = false, mockReviews = false, loseCartResponse = false, loseAddressResponse = false, voucherMock, lostCommittedResponses = 0, mockCalls = 0;
  function intercept(req, res, path) {
    if (buyerMode && voucherMock && path === "/api/me/voucher") {
      mockCalls++;
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ success: true, data: { voucher: voucherMock === "null" ? null : { id: "mock-voucher", type: "NEW_BUYER", percentage: 20, maxDiscount: 100000, status: voucherMock, reservedOrderId: voucherMock === "RESERVED" ? "mock-order" : null, usedAt: voucherMock === "USED" ? "2026-10-24T03:00:00Z" : null } }, meta: { requestId: randomUUID() } })); return true;
    }
    if (!(listError && path === "/api/products" || mockReviews && /^\/api\/products\/[^/]+\/reviews$/.test(path))) return false;
    mockCalls++;
    const requestId = randomUUID();
    res.writeHead(listError && path === "/api/products" ? 503 : 200, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-Id": requestId });
    res.end(JSON.stringify(listError && path === "/api/products" ? { success: false, error: { code: "FIXTURE_UNAVAILABLE", message: "Katalog fixture sementara tidak tersedia." }, meta: { requestId } } : { success: true, data: [{ id: "mock-review-1", productId: productIds[0], rating: 5, comment: "<script>fixture tidak dieksekusi</script>", author: { displayName: "Pembeli fixture mock" }, createdAt: "2026-10-24T03:00:00Z" }, { id: "mock-review-2", productId: productIds[0], rating: 1, comment: "Ulasan fixture kedua untuk halaman ini.", author: { displayName: "Pembeli fixture mock kedua" }, createdAt: "2026-10-23T03:00:00Z" }], meta: { requestId, pagination: { page: 1, pageSize: 5, total: 10, totalPages: 2 }, ratingSummary: { averageRating: 4.6, reviewCount: 10 } } }));
    return true;
  }
  return {
    manifest: { categoryId, emptyCategoryId, hiddenCategoryId, productIds }, intercept,
    allowed(path, method) { return buyerMode && (path === "/api/me/voucher" && method === "GET" || /^\/api\/addresses(?:\/[A-Za-z0-9_-]+)?$/.test(path) && ["GET", "POST", "PATCH", "DELETE"].includes(method) || /^\/api\/cart\/items\/[A-Za-z0-9_-]+$/.test(path) && ["PATCH", "DELETE"].includes(method)) || method === "GET" && (/^\/api\/(categories|products)(?:\/[A-Za-z0-9_-]+(?:\/reviews)?)?$/.test(path) || path === "/api/cart") || method === "POST" && path === "/api/cart/items"; },
    async control(command) {
      if (command === "stock-low") await db.product.update({ where: { id: productIds[0] }, data: { physicalStock: 1 } });
      if (command === "hide-product") await db.product.update({ where: { id: productIds[0] }, data: { isActive: false } });
      if (command === "catalog-error") listError = true;
      if (command === "catalog-recover") { listError = false; mockReviews = false; voucherMock = undefined; }
      if (command === "reviews-mock") mockReviews = true;
      if (command === "cart-response-lost") loseCartResponse = true;
      if (buyerMode && command === "address-response-lost") loseAddressResponse = true;
      if (buyerMode && command === "voucher-reserved-mock") voucherMock = "RESERVED";
      if (buyerMode && command === "voucher-used-mock") voucherMock = "USED";
      if (buyerMode && command === "voucher-null-mock") voucherMock = "null";
      if (buyerMode && command === "price-change") await db.product.update({ where: { id: productIds[0] }, data: { price: 4500 } });
      if (buyerMode && command === "price-overflow") await db.product.update({ where: { id: productIds[0] }, data: { price: 2147483647 } });
      if (buyerMode && command === "addresses-page") {
        const user = await db.user.findUniqueOrThrow({ where: { email: emails[0] }, select: { id: true } });
        await db.address.createMany({ data: Array.from({ length: 7 }, (_, i) => ({ id: `fe04-${run}-address-${i}`, userId: user.id, recipientName: `Fixture Halaman ${i + 1}`, phone: "0800000000", addressLine: "Alamat fiktif pagination", city: "Tanjungpinang", province: "Kepulauan Riau" })), skipDuplicates: true });
      }
    },
    loseResponse(path, method, status) { if (buyerMode && loseAddressResponse && path === "/api/addresses" && method === "POST" && status < 300) { loseAddressResponse = false; lostCommittedResponses++; return true; } if (loseCartResponse && (path === "/api/cart/items" && method === "POST" || buyerMode && /^\/api\/cart\/items\//.test(path) && method === "PATCH") && status < 300) { loseCartResponse = false; lostCommittedResponses++; return true; } return false; },
    async cleanup() {
      if (await db.orderItem.count({ where: { productId: { in: productIds } } })) throw Error("Fixture acquired order references; cleanup refused");
      await db.cartItem.deleteMany({ where: { cart: { user: { email: { in: emails } } } } });
      await db.cart.deleteMany({ where: { user: { email: { in: emails } } } });
      await db.product.deleteMany({ where: { id: { in: productIds }, categoryId: { in: [categoryId, hiddenCategoryId] } } });
      await db.category.deleteMany({ where: { id: { in: [categoryId, emptyCategoryId, hiddenCategoryId] } } });
    },
    async verifyCleanup() {
      const unchanged = JSON.stringify(baseline) === JSON.stringify(await fingerprint());
      const remainingUsers = await db.user.count({ where: { email: { in: emails } } });
      await writeFile(`${directory}/cleanup-result.json`, JSON.stringify({ timestamp: new Date().toISOString(), status: unchanged && remainingUsers === 0 ? "PASS" : "FAILED", fingerprintTables: tables, baselineMatched: unchanged, remainingUsers, lostCommittedResponses, mockCalls, providerCalls: 0 }, null, 2));
      if (!unchanged || remainingUsers) throw Error("Cleanup verification failed");
      console.log(JSON.stringify({ status: "CATALOG_CLEANUP_PASS", baselineMatched: unchanged, remainingUsers, lostCommittedResponses, mockCalls }));
    },
  };
}
