import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), constructor: class Client {} }));
vi.mock("../src/lib/db/client", () => ({ createDatabaseClient: mocks.create }));
vi.mock("../src/generated/prisma/client", () => ({ PrismaClient: mocks.constructor }));
import { getDatabase } from "../src/lib/db";
const cache = globalThis as unknown as { salvoraDatabase?: unknown; salvoraDatabaseConstructor?: unknown };
afterEach(() => { delete cache.salvoraDatabase; delete cache.salvoraDatabaseConstructor; vi.clearAllMocks(); });
describe("database client refresh after schema regeneration", () => {
  it("replaces a client preserved before the new generated schema and disconnects it", () => {
    const old = { $disconnect: vi.fn().mockResolvedValue(undefined) }, fresh = {};
    cache.salvoraDatabase = old; mocks.create.mockReturnValue(fresh);
    expect(getDatabase()).toBe(fresh);
    expect(old.$disconnect).toHaveBeenCalledOnce();
    expect(getDatabase()).toBe(fresh);
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("replaces a different generated constructor after hot reload", () => {
    const old = { $disconnect: vi.fn().mockResolvedValue(undefined) }, fresh = {};
    cache.salvoraDatabase = old; cache.salvoraDatabaseConstructor = class OldClient {};
    mocks.create.mockReturnValue(fresh);
    expect(getDatabase()).toBe(fresh);
    expect(old.$disconnect).toHaveBeenCalledOnce();
  });
  it("keeps a client with the current generated constructor", () => {
    const current = {};
    cache.salvoraDatabase = current; cache.salvoraDatabaseConstructor = mocks.constructor;
    expect(getDatabase()).toBe(current);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
