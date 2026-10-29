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
  getJobCounts,
  getJobDetail,
  getJobListRow,
  getJobSheet,
  getJobStatusCounts,
  getKmFloor,
  getVehicleOwner,
  listJobs,
  listServiceOptions,
} from "./queries";

const ROW = {
  id: "j1",
  number: 123,
  vehicle_id: "v1",
  client_id: "c1",
  appointment_id: null,
  status: "pendiente",
  observations: null,
  kilometers: 120000,
  quoted_total: 60000,
  final_total: null,
  enabled: true,
  created_at: "2026-10-13T15:00:00+00:00",
  updated_at: "2026-10-14T15:00:00+00:00",
  plate: "AE482KD",
  vehicle_year: 2021,
  brand_name: "Fiat",
  model_name: "Cronos",
  vehicle_enabled: true,
  client_name: "Martín",
  client_surname: "Suárez",
  client_phone_number: "11 5555-0101",
  client_enabled: true,
  appointment_date: null,
  appointment_time: null,
  appointment_enabled: null,
};

function setup(respond: (query: FakeQuery) => FakeResult) {
  const fake = createFakeSupabase(respond);
  mocks.supabase = fake.supabase;
  return fake.queries;
}

function params(overrides: Partial<typeof DEFAULT_LIST_PARAMS> = {}) {
  return { ...DEFAULT_LIST_PARAMS, ...overrides };
}

beforeEach(() => {
  mocks.requireSession.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listJobs", () => {
  it("reads job_list: active jobs, the last update first, 25 a page", async () => {
    const queries = setup(() => ({ data: [ROW], count: 1 }));
    const result = await listJobs(params());

    expect(result).toMatchObject({ ok: true, matching: 1, rows: [{ id: "j1", vehicle: { plate: "AE482KD" } }] });
    expect(mocks.requireSession).toHaveBeenCalled();
    const [query] = queries;
    expect(query.table).toBe("job_list");
    expect(query.calls[0]).toEqual(["select", expect.stringContaining("plate"), { count: "exact" }]);
    expect(query.calls).toContainEqual(["eq", "enabled", true]);
    expect(query.calls).toContainEqual(["order", "updated_at", { ascending: false, nullsFirst: false }]);
    expect(query.calls).toContainEqual(["order", "id", { ascending: false }]);
    expect(query.calls).toContainEqual(["range", 0, 24]);
    expect(query.calls.some(([name]) => name === "in" || name === "gte" || name === "lt")).toBe(false);
  });

  it("searches the normalized text, archived jobs included", async () => {
    const queries = setup(() => ({ data: [] }));
    await listJobs(params({ search: "AE 482" }));
    expect(filterValue(queries[0], "like", "search_text")).toBe("%ae482%");
    expect(filterValue(queries[0], "eq", "enabled")).toBeUndefined();
  });

  it("filters by status and by the days of the last update, in Argentina time", async () => {
    const queries = setup(() => ({ data: [] }));
    await listJobs(
      params({ filters: { estado: "pendiente,entregado", desde: "2026-09-01", hasta: "2026-09-30" } }),
    );
    const calls = queries[0].calls;
    expect(calls).toContainEqual(["in", "status", ["pendiente", "entregado"]]);
    expect(calls).toContainEqual(["gte", "updated_at", "2026-09-01T03:00:00.000Z"]);
    expect(calls).toContainEqual(["lt", "updated_at", "2026-10-01T03:00:00.000Z"]);
  });

  it("ignores a filter the URL got wrong", async () => {
    const queries = setup(() => ({ data: [] }));
    await listJobs(params({ filters: { estado: "nada", desde: "2026-09-30", hasta: "2026-09-01" } }));
    expect(queries[0].calls.some(([name]) => name === "in" || name === "gte" || name === "lt")).toBe(false);
  });

  it("sorts by the chosen column through its sort key", async () => {
    const queries = setup(() => ({ data: [] }));
    await listJobs(params({ sortBy: "estado" }));
    expect(queries[0].calls).toContainEqual(["order", "status_order", { ascending: true, nullsFirst: false }]);
    await listJobs(params({ sortBy: "total", sort: "desc" }));
    expect(queries[1].calls).toContainEqual(["order", "total_amount", { ascending: false, nullsFirst: false }]);
  });

  it("fails without leaking the error", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await listJobs(params())).toEqual({ ok: false });
  });
});

describe("getJobCounts", () => {
  it("counts all jobs and the archived ones on the table", async () => {
    const queries = setup((query) => ({ count: query.calls.some(([name]) => name === "eq") ? 3 : 35 }));
    expect(await getJobCounts()).toEqual({ ok: true, total: 35, archived: 3 });
    expect(queries.map((query) => query.table)).toEqual(["job", "job"]);
  });

  it("fails when a count fails", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await getJobCounts()).toEqual({ ok: false });
  });
});

describe("getJobStatusCounts", () => {
  it("asks the database for the counts of the current search, archived switch and dates", async () => {
    const queries = setup(() => ({ data: [{ status: "pendiente", total: 4 }, { status: "entregado", total: "12" }] }));
    const result = await getJobStatusCounts(
      params({ search: "AE 482", showArchived: true, filters: { estado: "cancelado", desde: "2026-09-01" } }),
    );

    expect(queries[0].calls[0]).toEqual([
      "rpc",
      "job_status_counts",
      { p_pattern: "%ae482%", p_show_archived: true, p_from: "2026-09-01T03:00:00.000Z", p_to: null },
    ]);
    expect(result).toEqual({
      ok: true,
      counts: {
        pendiente: 4,
        presupuesto_enviado: 0,
        presupuesto_aceptado: 0,
        en_progreso: 0,
        completado: 0,
        entregado: 12,
        cancelado: 0,
      },
    });
  });

  it("sends no search and no dates when there are none", async () => {
    const queries = setup(() => ({ data: [] }));
    await getJobStatusCounts(params());
    expect(queries[0].calls[0]).toEqual([
      "rpc",
      "job_status_counts",
      { p_pattern: null, p_show_archived: false, p_from: null, p_to: null },
    ]);
  });

  it("fails when the function fails", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await getJobStatusCounts(params())).toEqual({ ok: false });
  });
});

describe("getJobListRow", () => {
  it("reads one job from the list view", async () => {
    const queries = setup(() => ({ data: ROW }));
    expect(await getJobListRow("j1")).toMatchObject({ ok: true, row: { id: "j1" } });
    expect(queries[0].table).toBe("job_list");
    expect(filterValue(queries[0], "eq", "id")).toBe("j1");
  });

  it("fails when the job is not visible", async () => {
    setup(() => ({ data: null }));
    expect(await getJobListRow("j1")).toEqual({ ok: false });
  });
});

describe("getJobDetail", () => {
  it("reads the services and the history, newest change first", async () => {
    const queries = setup((query) =>
      query.table === "job_item"
        ? {
            data: [
              {
                id: "i1",
                service_id: "s1",
                quantity: 1,
                quoted_unit_price: 100,
                final_unit_price: null,
                created_at: "2026-10-13T15:00:00+00:00",
                service: { name: "Cambio de aceite", enabled: true },
              },
            ],
          }
        : {
            data: [
              {
                id: "h1",
                old_status: null,
                new_status: "pendiente",
                changed_at: "2026-10-13T15:00:00+00:00",
                profile: { full_name: "Usuario A" },
              },
            ],
          },
    );
    const result = await getJobDetail("j1");

    expect(result).toMatchObject({
      ok: true,
      items: [{ id: "i1", serviceName: "Cambio de aceite" }],
      history: [{ id: "h1", newStatus: "pendiente", changedBy: "Usuario A" }],
    });
    const history = queries.find((query) => query.table === "job_status_history");
    expect(filterValue(history!, "eq", "job_id")).toBe("j1");
    expect(history!.calls).toContainEqual(["order", "changed_at", { ascending: false }]);
  });

  it("fails when either read fails", async () => {
    setup((query) => (query.table === "job_item" ? { data: [] } : { error: { code: "XX000" } }));
    expect(await getJobDetail("j1")).toEqual({ ok: false });
  });
});

describe("getKmFloor", () => {
  it("is the highest km of the vehicle's non-archived jobs", async () => {
    const queries = setup(() => ({ data: [{ kilometers: 68400 }] }));
    expect(await getKmFloor("v1")).toEqual({ ok: true, floor: 68400 });
    const [query] = queries;
    expect(query.table).toBe("job");
    expect(filterValue(query, "eq", "vehicle_id")).toBe("v1");
    expect(filterValue(query, "eq", "enabled")).toBe(true);
    expect(query.calls).toContainEqual(["not", "kilometers", "is", null]);
    expect(query.calls).toContainEqual(["order", "kilometers", { ascending: false }]);
    expect(query.calls).toContainEqual(["limit", 1]);
  });

  it("is none when the vehicle has no km", async () => {
    setup(() => ({ data: [] }));
    expect(await getKmFloor("v1")).toEqual({ ok: true, floor: null });
  });

  it("counts only the jobs created before the one being edited, and not itself", async () => {
    const queries = setup((query) =>
      query.calls.some(([name]) => name === "maybeSingle") || query.operation === "select" && query.calls.length === 2
        ? { data: { created_at: "2026-10-10T12:00:00+00:00" } }
        : { data: [{ kilometers: 90000 }] },
    );
    expect(await getKmFloor("v1", "j1")).toEqual({ ok: true, floor: 90000 });
    const floor = queries[1];
    expect(filterValue(floor, "neq", "id")).toBe("j1");
    expect(filterValue(floor, "lt", "created_at")).toBe("2026-10-10T12:00:00+00:00");
  });

  it("fails when the read fails", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await getKmFloor("v1")).toEqual({ ok: false });
  });
});

describe("getVehicleOwner", () => {
  const OWNER = {
    client_id: "c1",
    client_name: "Martín",
    client_surname: "Suárez",
    client_phone_number: "11 5555-0101",
    client_enabled: true,
  };

  it("is the vehicle's active owner", async () => {
    setup(() => ({ data: OWNER }));
    expect(await getVehicleOwner("v1")).toEqual({
      ok: true,
      owner: { id: "c1", name: "Martín", surname: "Suárez", phoneNumber: "11 5555-0101", enabled: true },
    });
  });

  it("says when the owner is archived, so the form can explain why it isn't used", async () => {
    setup(() => ({ data: { ...OWNER, client_enabled: false } }));
    expect(await getVehicleOwner("v1")).toMatchObject({ ok: true, owner: { id: "c1", enabled: false } });
  });

  it("is none for a vehicle without a client or one that is not visible", async () => {
    setup(() => ({ data: { client_id: null, client_name: null, client_surname: null, client_phone_number: null, client_enabled: null } }));
    expect(await getVehicleOwner("v1")).toEqual({ ok: true, owner: null });
    setup(() => ({ data: null }));
    expect(await getVehicleOwner("v1")).toEqual({ ok: true, owner: null });
  });
});

describe("listServiceOptions", () => {
  it("lists the active services by name", async () => {
    const queries = setup(() => ({ data: [{ id: "s1", name: "Alineación", enabled: true }] }));
    expect(await listServiceOptions()).toEqual({ ok: true, rows: [{ id: "s1", name: "Alineación", enabled: true }] });
    expect(filterValue(queries[0], "eq", "enabled")).toBe(true);
    expect(queries[0].calls).toContainEqual(["order", "name_key"]);
  });

  it("keeps the services already on the job even if archived", async () => {
    const queries = setup(() => ({ data: [] }));
    await listServiceOptions(["s1", "s2"]);
    expect(queries[0].calls).toContainEqual(["or", "enabled.eq.true,id.in.(s1,s2)"]);
  });
});

describe("getJobSheet", () => {
  const ITEM = {
    id: "i1",
    service_id: "s1",
    quantity: 2,
    quoted_unit_price: 100,
    final_unit_price: null,
    created_at: "2026-10-13T15:00:00+00:00",
    service: { name: "Cambio de aceite", enabled: true },
  };
  const SHOP = { name: "Taller Ejemplo", address: "Calle Falsa 123", phone: "1112345678", logo_path: null };

  function respond(query: FakeQuery): FakeResult {
    if (query.table === "job_list") return { data: ROW };
    if (query.table === "job_item") return { data: [ITEM] };
    if (query.table === "shop") return { data: SHOP };
    return { data: [] };
  }

  it("builds the sheet from the job, its services and the shop", async () => {
    setup(respond);
    expect(await getJobSheet("j1")).toMatchObject({
      ok: true,
      sheet: {
        number: "N° 000123",
        shop: { name: "Taller Ejemplo", address: "Calle Falsa 123", phone: "11 1234-5678", hasLogo: false },
        plate: "AE 482 KD",
        services: [{ id: "i1", name: "Cambio de aceite", quantity: 2 }],
      },
    });
  });

  it("is not found when the job is not visible to the user", async () => {
    setup((query) => (query.table === "job_list" ? { data: null } : respond(query)));
    expect(await getJobSheet("j1")).toEqual({ ok: false, reason: "notFound" });
  });

  it("fails when the services can't be read", async () => {
    setup((query) => (query.table === "job_item" ? { error: { code: "XX000" } } : respond(query)));
    expect(await getJobSheet("j1")).toEqual({ ok: false, reason: "error" });
  });

  it("still builds the sheet when the shop can't be read", async () => {
    setup((query) => (query.table === "shop" ? { error: { code: "XX000" } } : respond(query)));
    expect(await getJobSheet("j1")).toMatchObject({ ok: true, sheet: { shop: { name: null, hasLogo: false } } });
  });
});
