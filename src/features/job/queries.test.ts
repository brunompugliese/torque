import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeSupabase, filterValue, type FakeQuery, type FakeResult } from "@/test/supabase";

const mocks = vi.hoisted(() => ({
  supabase: null as unknown,
  requireSession: vi.fn(async () => ({ userId: "u1", shopId: "shop-a" })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ supabase: mocks.supabase }),
}));
vi.mock("@/lib/auth/session", () => ({ requireSession: mocks.requireSession }));

import { listVehicleJobs } from "./queries";

const ROW = {
  id: "j1",
  status: "completado",
  kilometers: 120000,
  quoted_total: 60000,
  final_total: 65000,
  enabled: false,
  created_at: "2026-10-13T15:00:00+00:00",
  job_item: [{ created_at: "2026-10-13T15:00:01+00:00", service: { name: "Cambio de aceite" } }],
};

function setup(respond: (query: FakeQuery) => FakeResult) {
  const fake = createFakeSupabase(respond);
  mocks.supabase = fake.supabase;
  return fake.queries;
}

beforeEach(() => {
  mocks.requireSession.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listVehicleJobs", () => {
  it("checks the session and reads the vehicle's jobs, archived ones included, newest first", async () => {
    const queries = setup(() => ({ data: [ROW] }));
    const result = await listVehicleJobs("v1");

    expect(result).toMatchObject({ ok: true, rows: [{ id: "j1", services: ["Cambio de aceite"], enabled: false }] });
    expect(mocks.requireSession).toHaveBeenCalled();
    expect(queries).toHaveLength(1);
    const [query] = queries;
    expect(query.table).toBe("job");
    expect(filterValue(query, "eq", "vehicle_id")).toBe("v1");
    expect(filterValue(query, "eq", "enabled")).toBeUndefined();
    expect(query.calls.filter(([name]) => name === "order")).toEqual([
      ["order", "created_at", { ascending: false }],
      ["order", "id", { ascending: false }],
    ]);
    expect(query.calls.map(([name]) => name)).not.toContain("range");
  });

  it("is an empty list when the vehicle has no jobs", async () => {
    setup(() => ({ data: null }));
    expect(await listVehicleJobs("v1")).toEqual({ ok: true, rows: [] });
  });

  it("reports a failure without throwing or logging data", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await listVehicleJobs("v1")).toEqual({ ok: false });
    expect(console.error).toHaveBeenCalledWith("[job] vehicle jobs query failed", { code: "XX000" });
  });
});
