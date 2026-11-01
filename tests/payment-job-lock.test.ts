import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ calls: [] as string[], failConnect: false, failLock: false, locked: true, connectionError: () => {} }));
vi.mock("pg", () => ({ default: { Client: class {
  on(_name: string, callback: () => void) { state.connectionError = callback; }
  async connect() { state.calls.push("connect"); if (state.failConnect) throw Object.assign(new Error("private connection details"), { code: "ECONNREFUSED" }); }
  async query(sql: string) {
    if (sql.includes("try_advisory_lock")) { state.calls.push("lock"); if (state.failLock) throw Object.assign(new Error("private SQL"), { code: "42501" }); return { rows: [{ locked: state.locked }] }; }
    state.calls.push("unlock"); return { rows: [] };
  }
  async end() { state.calls.push("end"); }
} } }));
import { withPaymentJobLock } from "../src/lib/payments/job-lock";
beforeEach(() => { state.calls = []; state.failConnect = false; state.failLock = false; state.locked = true; });
describe("Observer fase worker memakai pg mock, tanpa koneksi nyata", () => {
  it("menandai connect dan lock terpisah, lalu melepas lock", async () => {
    const phases: string[] = [];
    expect(await withPaymentJobLock("fixture-only", async held => { held(); return 1; }, stage => phases.push(stage))).toEqual({ skipped: false, value: 1 });
    expect(phases).toEqual(["database_connection", "lock"]); expect(state.calls).toEqual(["connect", "lock", "unlock", "end"]);
  });
  it("connection refused tidak pernah ditandai sudah mencapai query lock", async () => {
    state.failConnect = true; const phases: string[] = [], action = vi.fn();
    await expect(withPaymentJobLock("fixture-only", action, stage => phases.push(stage))).rejects.toMatchObject({ code: "ECONNREFUSED" });
    expect(phases).toEqual(["database_connection"]); expect(action).not.toHaveBeenCalled(); expect(state.calls).toEqual(["connect", "end"]);
  });
  it("query lock gagal setelah connect tidak memanggil batch", async () => {
    state.failLock = true; const phases: string[] = [], action = vi.fn();
    await expect(withPaymentJobLock("fixture-only", action, stage => phases.push(stage))).rejects.toMatchObject({ code: "42501" });
    expect(phases).toEqual(["database_connection", "lock"]); expect(action).not.toHaveBeenCalled(); expect(state.calls).toEqual(["connect", "lock", "end"]);
  });
  it("lock dipakai worker lain adalah skip, bukan error atau pemrosesan batch", async () => {
    state.locked = false; const action = vi.fn();
    expect(await withPaymentJobLock("fixture-only", action)).toEqual({ skipped: true }); expect(action).not.toHaveBeenCalled(); expect(state.calls).toEqual(["connect", "lock", "end"]);
  });
  it("lock yang putus menghasilkan kode aman dan tidak dipakai meneruskan batch", async () => {
    await expect(withPaymentJobLock("fixture-only", async held => { state.connectionError(); held(); })).rejects.toMatchObject({ code: "PAYMENT_JOB_LOCK_LOST" });
    expect(state.calls).toEqual(["connect", "lock", "end"]);
  });
});
