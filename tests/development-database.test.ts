import { describe, expect, it, vi } from "vitest";
// @ts-expect-error The startup entry point is a JavaScript CLI, tested with injected process and database adapters.
import { ensureDevelopmentDatabase } from "../scripts/ensure-development-database.mjs";
function fixture(status = 0) {
  const root = process.cwd(), run = vi.fn().mockReturnValue({ status }), connect = vi.fn().mockResolvedValue(undefined), query = vi.fn().mockResolvedValue({}), end = vi.fn().mockResolvedValue(undefined);
  const options = { root, source: { DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:55433/salvora_kitchen_dev" }, exists: () => true, read: () => JSON.stringify({ root, port: 55433, owner: "salvora_bootstrap" }), run, Client: class { connect = connect; query = query; end = end; } };
  return { options, run, connect, query, end };
}
describe("development database startup", () => {
  it("checks an existing running cluster without starting it again", async () => {
    const f = fixture(); await ensureDevelopmentDatabase(f.options);
    expect(f.run).toHaveBeenCalledTimes(1); expect(f.query).toHaveBeenCalledWith("SELECT 1"); expect(f.end).toHaveBeenCalledOnce();
  });
  it("starts only a verified stopped cluster and waits for readiness", async () => {
    const f = fixture(3); f.run.mockReturnValueOnce({ status: 3 }).mockReturnValueOnce({ status: 0 });
    await ensureDevelopmentDatabase(f.options);
    expect(f.run.mock.calls[1][1]).toContain("start"); expect(f.run.mock.calls[1][1]).toContain("-w"); expect(f.connect).toHaveBeenCalledOnce();
  });
  it("rejects missing markers without creating or resetting data", async () => {
    const f = fixture(); f.options.exists = () => false;
    await expect(ensureDevelopmentDatabase(f.options)).rejects.toThrow(); expect(f.run).not.toHaveBeenCalled();
  });
  it("fails startup if the database connection is unavailable", async () => {
    const f = fixture(); f.connect.mockRejectedValueOnce(new Error("private connection error"));
    await expect(ensureDevelopmentDatabase(f.options)).rejects.toThrow("Database belum dapat dihubungi"); expect(f.end).toHaveBeenCalledOnce();
  });
  it("does not operate on another cluster", async () => {
    const f = fixture(); f.options.source.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:5432/salvora_kitchen_dev";
    await ensureDevelopmentDatabase(f.options); expect(f.run).not.toHaveBeenCalled();
  });
});
