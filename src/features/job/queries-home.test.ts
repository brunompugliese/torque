import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { getJobStatusCounts, getOpenJobCount, listJobs } from "./queries";

// 12:00 in Argentina on 2026-10-25: the window starts on 2026-09-26.
const FROM = "2026-09-26T03:00:00.000Z";

function setup(respond: (query: FakeQuery) => FakeResult) {
  const fake = createFakeSupabase(respond);
  mocks.supabase = fake.supabase;
  return fake.queries;
}

function params(overrides: Partial<typeof DEFAULT_LIST_PARAMS> = {}) {
  return { ...DEFAULT_LIST_PARAMS, ...overrides };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-25T15:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("listJobs, home scope", () => {
  it("lists the open statuses of any age, active only, when nothing is ticked", async () => {
    const queries = setup(() => ({ data: [], count: 0 }));
    await listJobs(params(), "home");
    const [query] = queries;
    expect(filterValue(query, "in", "status")).toEqual([
      "pendiente",
      "presupuesto_enviado",
      "presupuesto_aceptado",
      "en_progreso",
      "completado",
    ]);
    expect(query.calls.some(([name, column]) => name === "gte" && column === "updated_at")).toBe(false);
    expect(query.calls).toContainEqual(["eq", "enabled", true]);
  });

  it("limits ticked closed statuses to the last 30 days by last update", async () => {
    const queries = setup(() => ({ data: [], count: 0 }));
    await listJobs(params({ filters: { estado: "entregado,cancelado" } }), "home");
    expect(filterValue(queries[0], "in", "status")).toEqual(["entregado", "cancelado"]);
    expect(filterValue(queries[0], "gte", "updated_at")).toBe(FROM);
  });

  it("mixes open statuses of any age with the closed ones in the window", async () => {
    const queries = setup(() => ({ data: [], count: 0 }));
    await listJobs(params({ filters: { estado: "pendiente,entregado" } }), "home");
    expect(queries[0].calls).toContainEqual([
      "or",
      `status.in.(pendiente),and(status.in.(entregado),updated_at.gte.${FROM})`,
    ]);
  });

  it("ignores the dates and the archived switch of the URL, and keeps archived jobs out of a search", async () => {
    const queries = setup(() => ({ data: [], count: 0 }));
    await listJobs(
      params({ search: "AE 482", showArchived: true, filters: { desde: "2020-01-01", hasta: "2020-02-01" } }),
      "home",
    );
    const [query] = queries;
    expect(filterValue(query, "like", "search_text")).toBe("%ae482%");
    expect(query.calls).toContainEqual(["eq", "enabled", true]);
    expect(query.calls.some(([name]) => name === "lt")).toBe(false);
    expect(query.calls.some(([name, column]) => name === "gte" && column === "updated_at")).toBe(false);
  });
});

describe("getJobStatusCounts, home scope", () => {
  it("asks for the closed window and active jobs only, ignoring dates and the archived switch", async () => {
    const queries = setup(() => ({ data: [] }));
    await getJobStatusCounts(params({ search: "AE 482", showArchived: true, filters: { desde: "2020-01-01" } }), "home");
    expect(queries[0].calls[0]).toEqual([
      "rpc",
      "job_status_counts",
      {
        p_pattern: "%ae482%",
        p_show_archived: false,
        p_from: null,
        p_to: null,
        p_closed_from: FROM,
        p_enabled_only: true,
      },
    ]);
  });
});

describe("getOpenJobCount", () => {
  it("counts the active jobs in open statuses on the table", async () => {
    const queries = setup(() => ({ count: 9 }));
    expect(await getOpenJobCount()).toEqual({ ok: true, total: 9 });
    expect(queries[0].table).toBe("job");
    expect(filterValue(queries[0], "eq", "enabled")).toBe(true);
    expect(filterValue(queries[0], "in", "status")).toHaveLength(5);
  });

  it("is not ok when the query fails", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await getOpenJobCount()).toEqual({ ok: false });
  });
});
