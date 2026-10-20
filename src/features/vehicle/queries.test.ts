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

import { listClientVehicles, listUnassignedVehicles } from "./queries";

const ROW = { id: "v1", plate: "AB123CD", brand_name: "Fiat", model_name: "Cronos", year: 2021, vin: "VIN1", enabled: false };
const VEHICLE = { id: "v1", plate: "AB123CD", brandName: "Fiat", modelName: "Cronos", year: 2021, vin: "VIN1", enabled: false };

function setup(respond: (query: FakeQuery) => FakeResult) {
  const fake = createFakeSupabase(respond);
  mocks.supabase = fake.supabase;
  return fake.queries;
}

beforeEach(() => {
  mocks.requireSession.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listClientVehicles", () => {
  it("checks the session and reads the client's vehicles from the decrypted view, steadily ordered", async () => {
    const queries = setup(() => ({ data: [ROW] }));
    expect(await listClientVehicles("c1")).toEqual({ ok: true, rows: [VEHICLE] });

    expect(mocks.requireSession).toHaveBeenCalled();
    expect(queries).toHaveLength(1);
    const [query] = queries;
    expect(query.table).toBe("vehicle_decrypted");
    expect(query.calls[0]).toEqual(["select", "id, plate, brand_name, model_name, year, vin, enabled"]);
    expect(filterValue(query, "eq", "client_id")).toBe("c1");
    expect(query.calls.filter(([name]) => name === "order").map(([, column]) => column)).toEqual(["created_at", "id"]);
  });

  it("includes archived vehicles and doesn't page", async () => {
    const queries = setup(() => ({ data: [] }));
    await listClientVehicles("c1");
    expect(queries[0].calls.map(([name]) => name)).not.toContain("range");
    expect(filterValue(queries[0], "eq", "enabled")).toBeUndefined();
  });

  it("reports a failure without throwing", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await listClientVehicles("c1")).toEqual({ ok: false });
  });
});

describe("listUnassignedVehicles", () => {
  it("reads the vehicles with no client, archived ones included", async () => {
    const queries = setup(() => ({ data: [ROW] }));
    expect(await listUnassignedVehicles()).toEqual({ ok: true, rows: [VEHICLE] });

    const [query] = queries;
    expect(query.table).toBe("vehicle_decrypted");
    expect(query.calls).toContainEqual(["is", "client_id", null]);
    expect(filterValue(query, "eq", "enabled")).toBeUndefined();
    expect(query.calls.filter(([name]) => name === "order").map(([, column]) => column)).toEqual(["created_at", "id"]);
  });

  it("is an empty list when there are none", async () => {
    setup(() => ({ data: null }));
    expect(await listUnassignedVehicles()).toEqual({ ok: true, rows: [] });
  });

  it("reports a failure without throwing", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await listUnassignedVehicles()).toEqual({ ok: false });
  });
});
