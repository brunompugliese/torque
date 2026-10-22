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

import { getVehicleJobs } from "./actions";

const VEHICLE_ID = "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

function setup(respond: (query: FakeQuery) => FakeResult) {
  const fake = createFakeSupabase(respond);
  mocks.supabase = fake.supabase;
  return fake.queries;
}

beforeEach(() => {
  mocks.requireSession.mockClear();
});

describe("getVehicleJobs", () => {
  it("reads the jobs of a valid vehicle id", async () => {
    const queries = setup(() => ({ data: [] }));
    expect(await getVehicleJobs(VEHICLE_ID)).toEqual({ ok: true, rows: [] });
    expect(mocks.requireSession).toHaveBeenCalled();
    expect(filterValue(queries[0], "eq", "vehicle_id")).toBe(VEHICLE_ID);
  });

  it.each([["nope"], [undefined], [42], [""]])("fails without querying when the id is %j", async (id) => {
    const queries = setup(() => ({ data: [] }));
    expect(await getVehicleJobs(id)).toEqual({ ok: false });
    expect(queries).toHaveLength(0);
  });
});
