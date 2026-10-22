import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_LIST_PARAMS } from "@/lib/list/params";
import { createFakeSupabase, filterValue, type FakeQuery, type FakeResult } from "@/test/supabase";

const mocks = vi.hoisted(() => ({
  supabase: null as unknown,
  requireSession: vi.fn(async () => ({ userId: "u1", shopId: "shop-a" })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ supabase: mocks.supabase }),
}));
vi.mock("@/lib/auth/session", () => ({ requireSession: mocks.requireSession }));

import {
  getVehicleCounts,
  listBrandOptions,
  listClientVehicles,
  listModelOptions,
  listUnassignedVehicles,
  listVehicles,
} from "./queries";

const ROW = { id: "v1", plate: "AB123CD", brand_name: "Fiat", model_name: "Cronos", year: 2021, vin: "VIN1", enabled: false };
const VEHICLE = { id: "v1", plate: "AB123CD", brandName: "Fiat", modelName: "Cronos", year: 2021, vin: "VIN1", enabled: false };

const LIST_ROW = {
  ...ROW,
  brand_id: "b1",
  model_id: "m1",
  created_at: "2026-10-13T15:00:00+00:00",
  client_id: "c1",
  client_name: "Ana",
  client_surname: null,
  client_phone_number: "11 1234-5678",
  client_enabled: true,
  last_km: 90000,
};
const LIST_ITEM = {
  id: "v1",
  plate: "AB123CD",
  brandId: "b1",
  modelId: "m1",
  brandName: "Fiat",
  modelName: "Cronos",
  year: 2021,
  vin: "VIN1",
  enabled: false,
  createdAt: "2026-10-13T15:00:00+00:00",
  lastKm: 90000,
  client: { id: "c1", name: "Ana", surname: null, phoneNumber: "11 1234-5678", enabled: true },
};

function setup(respond: (query: FakeQuery) => FakeResult) {
  const fake = createFakeSupabase(respond);
  mocks.supabase = fake.supabase;
  return fake.queries;
}

const orders = (query: FakeQuery) => query.calls.filter(([name]) => name === "order");

beforeEach(() => {
  mocks.requireSession.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listVehicles", () => {
  it("checks the session and reads one page from the decrypted view with the shared list rules", async () => {
    const queries = setup(() => ({ data: [LIST_ROW], count: 40 }));
    const page = await listVehicles({ ...DEFAULT_LIST_PARAMS, search: "ae 482" });

    expect(mocks.requireSession).toHaveBeenCalled();
    expect(page).toEqual({ ok: true, matching: 40, rows: [LIST_ITEM] });
    const [query] = queries;
    expect(queries).toHaveLength(1);
    expect(query.table).toBe("vehicle_decrypted");
    expect(query.calls[0]).toEqual([
      "select",
      "id, plate, brand_id, model_id, brand_name, model_name, year, vin, enabled, created_at, " +
        "client_id, client_name, client_surname, client_phone_number, client_enabled, last_km",
      { count: "exact" },
    ]);
    expect(filterValue(query, "like", "search_text")).toBe("%ae482%");
    expect(query.calls).toContainEqual(["range", 0, 24]);
  });

  it("lists the active vehicles unless archived ones are asked for", async () => {
    const active = setup(() => ({ data: [], count: 0 }));
    await listVehicles(DEFAULT_LIST_PARAMS);
    expect(filterValue(active[0], "eq", "enabled")).toBe(true);

    const all = setup(() => ({ data: [], count: 0 }));
    await listVehicles({ ...DEFAULT_LIST_PARAMS, showArchived: true });
    expect(filterValue(all[0], "eq", "enabled")).toBeUndefined();
  });

  it("opens in plate order with no column chosen", async () => {
    const queries = setup(() => ({ data: [], count: 0 }));
    await listVehicles(DEFAULT_LIST_PARAMS);
    expect(orders(queries[0])).toEqual([
      ["order", "plate", { ascending: true, nullsFirst: false }],
      ["order", "id", { ascending: true }],
    ]);
  });

  it.each([
    ["patente", "plate"],
    ["vehiculo", "vehicle_key"],
    ["anio", "year"],
    ["vin", "vin"],
    ["cliente", "client_name_key"],
    ["km", "last_km"],
    ["creado", "created_at"],
  ])("sorts the %s column by %s, empty values last", async (sortBy, column) => {
    const queries = setup(() => ({ data: [], count: 0 }));
    await listVehicles({ ...DEFAULT_LIST_PARAMS, sortBy, sort: "desc" });
    expect(queries[0].calls).toContainEqual(["order", column, { ascending: false, nullsFirst: false }]);
  });

  it("falls back to the default order for an unknown column", async () => {
    const queries = setup(() => ({ data: [], count: 0 }));
    await listVehicles({ ...DEFAULT_LIST_PARAMS, sortBy: "otro" });
    expect(queries[0].calls).toContainEqual(["order", "plate", { ascending: true, nullsFirst: false }]);
  });

  it("reports a failure without throwing", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await listVehicles(DEFAULT_LIST_PARAMS)).toEqual({ ok: false });
  });
});

describe("getVehicleCounts", () => {
  it("counts all and archived vehicles with head-only queries on the table, not the view", async () => {
    const queries = setup((query) => ({ count: filterValue(query, "eq", "enabled") === false ? 2 : 15 }));
    expect(await getVehicleCounts()).toEqual({ ok: true, total: 15, archived: 2 });
    for (const query of queries) {
      expect(query.table).toBe("vehicle");
      expect(query.calls[0]).toEqual(["select", "id", { count: "exact", head: true }]);
    }
  });

  it("reports a failure without throwing", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await getVehicleCounts()).toEqual({ ok: false });
  });
});

describe("listClientVehicles", () => {
  it("checks the session and reads the client's vehicles with their modal data, steadily ordered", async () => {
    const queries = setup(() => ({ data: [LIST_ROW] }));
    expect(await listClientVehicles("c1")).toEqual({ ok: true, rows: [LIST_ITEM] });

    expect(mocks.requireSession).toHaveBeenCalled();
    expect(queries).toHaveLength(1);
    const [query] = queries;
    expect(query.table).toBe("vehicle_decrypted");
    expect(query.calls[0][1]).toContain("last_km");
    expect(filterValue(query, "eq", "client_id")).toBe("c1");
    expect(orders(query).map(([, column]) => column)).toEqual(["created_at", "id"]);
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
    expect(query.calls[0]).toEqual(["select", "id, plate, brand_name, model_name, year, vin, enabled"]);
    expect(query.calls).toContainEqual(["is", "client_id", null]);
    expect(filterValue(query, "eq", "enabled")).toBeUndefined();
    expect(orders(query).map(([, column]) => column)).toEqual(["created_at", "id"]);
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

describe("listBrandOptions", () => {
  it("lists the enabled brands by name", async () => {
    const queries = setup(() => ({ data: [{ id: "b1", name: "Fiat" }] }));
    expect(await listBrandOptions()).toEqual({ ok: true, rows: [{ id: "b1", name: "Fiat" }] });

    const [query] = queries;
    expect(mocks.requireSession).toHaveBeenCalled();
    expect(query.table).toBe("brand");
    expect(query.calls[0]).toEqual(["select", "id, name"]);
    expect(filterValue(query, "eq", "enabled")).toBe(true);
    expect(orders(query).map(([, column]) => column)).toEqual(["name", "id"]);
  });

  it("also lists the brand the vehicle has, even if it was archived in the catalog", async () => {
    const queries = setup(() => ({ data: [] }));
    await listBrandOptions("b9");
    expect(queries[0].calls).toContainEqual(["or", "enabled.eq.true,id.eq.b9"]);
    expect(filterValue(queries[0], "eq", "enabled")).toBeUndefined();
  });

  it("reports a failure without throwing", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await listBrandOptions()).toEqual({ ok: false });
  });
});

describe("listModelOptions", () => {
  it("lists the enabled models of the brand by name", async () => {
    const queries = setup(() => ({ data: [{ id: "m1", name: "Cronos" }] }));
    expect(await listModelOptions("b1")).toEqual({ ok: true, rows: [{ id: "m1", name: "Cronos" }] });

    const [query] = queries;
    expect(query.table).toBe("model");
    expect(filterValue(query, "eq", "brand_id")).toBe("b1");
    expect(filterValue(query, "eq", "enabled")).toBe(true);
    expect(orders(query).map(([, column]) => column)).toEqual(["name", "id"]);
  });

  it("also lists the model the vehicle has, even if it was archived in the catalog", async () => {
    const queries = setup(() => ({ data: [] }));
    await listModelOptions("b1", "m9");
    expect(queries[0].calls).toContainEqual(["or", "enabled.eq.true,id.eq.m9"]);
    expect(filterValue(queries[0], "eq", "brand_id")).toBe("b1");
  });

  it("reports a failure without throwing", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await listModelOptions("b1")).toEqual({ ok: false });
  });
});
