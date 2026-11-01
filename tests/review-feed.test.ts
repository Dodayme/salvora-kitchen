import { describe, expect, it, vi } from "vitest";
import { createReviewFeed } from "../src/lib/catalog-client/review-feed";
import { ApiClientError, type apiRequest } from "../src/lib/http/client";
function fixture(count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({ id: `r-${i}`, productId: "risol", rating: 5, comment: `Review ${i}`, author: { displayName: "Pembeli" }, createdAt: "2026-10-25T00:00:00Z" }));
  const request = vi.fn(async (path: string) => {
    const query = new URL(path, "https://example.test").searchParams, page = Number(query.get("page")), size = Number(query.get("pageSize"));
    return { data: rows.slice((page - 1) * size, page * size), meta: { requestId: "test", pagination: { page, pageSize: size, total: rows.length, totalPages: Math.ceil(rows.length / size) }, ratingSummary: { averageRating: rows.length ? 5 : null, reviewCount: rows.length } } };
  });
  const feed = createReviewFeed("risol", request as unknown as typeof apiRequest); feed.activate();
  return { feed, request, rows };
}
describe("incremental product reviews", () => {
  it("shows 2, then 7, then 12 and the final remainder without gaps or duplicates", async () => {
    const { feed, request, rows } = fixture(14);
    await feed.initial(); expect(feed.getSnapshot().reviews).toEqual(rows.slice(0, 2));
    await feed.more(); expect(feed.getSnapshot().reviews).toEqual(rows.slice(0, 7));
    await feed.more(); expect(feed.getSnapshot().reviews).toEqual(rows.slice(0, 12));
    await feed.more(); expect(feed.getSnapshot().reviews).toEqual(rows); expect(feed.getSnapshot().hasMore).toBe(false);
    expect(request).toHaveBeenCalledTimes(3);
    await feed.more(); expect(request).toHaveBeenCalledTimes(3);
  });
  it.each([0, 1, 2])("hides the expand button for %i reviews", async count => {
    const { feed } = fixture(count); await feed.initial(); expect(feed.getSnapshot().reviews).toHaveLength(count); expect(feed.getSnapshot().hasMore).toBe(false);
  });
  it("expands cached reviews without another request when only five exist", async () => {
    const { feed, request } = fixture(5); await feed.initial(); await feed.more(); expect(feed.getSnapshot().reviews).toHaveLength(5); expect(request).toHaveBeenCalledOnce();
  });
  it("keeps previous reviews on failure and retries the same page", async () => {
    const { feed, request, rows } = fixture(9); await feed.initial();
    request.mockRejectedValueOnce(new ApiClientError(429, "RATE_LIMITED", "Try later"));
    await feed.more(); expect(feed.getSnapshot().reviews).toEqual(rows.slice(0, 2)); expect(feed.getSnapshot().error).toBeTruthy();
    await feed.retry(); expect(feed.getSnapshot().reviews).toEqual(rows.slice(0, 7)); expect(request.mock.calls[1][0]).toBe(request.mock.calls[2][0]);
  });
  it("does not duplicate requests on rapid clicks", async () => {
    const { feed, request } = fixture(14); await feed.initial(); await Promise.all([feed.more(), feed.more()]); expect(feed.getSnapshot().reviews).toHaveLength(7); expect(request).toHaveBeenCalledTimes(2);
  });
});

it("reloads shifted pages when a new review arrives during expansion", async () => {
  const { feed, rows } = fixture(8);
  await feed.initial();
  rows.unshift({ ...rows[0], id: "new-review" });
  await feed.more(); await feed.more();
  expect(feed.getSnapshot().reviews).toEqual(rows);
  expect(feed.getSnapshot()).toMatchObject({ total: 9, hasMore: false });
});
it("reloads shifted pages when a review is removed during expansion", async () => {
  const { feed, rows } = fixture(9);
  await feed.initial(); rows.shift();
  await feed.more(); await feed.more();
  expect(feed.getSnapshot().reviews).toEqual(rows);
  expect(feed.getSnapshot()).toMatchObject({ total: 8, hasMore: false });
});
