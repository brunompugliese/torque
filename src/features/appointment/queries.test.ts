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

import { getAppointmentCounts, getAppointmentListRow, listAppointments } from "./queries";

const ROW = {
  id: "a1",
  vehicle_id: "v1",
  client_id: "c1",
  date: "2026-10-14",
  time: "09:00:00",
  reason: "Ruido al frenar",
  status: "pendiente",
  enabled: true,
  created_at: "2026-10-13T15:00:00+00:00",
  plate: "AE482KD",
  vehicle_year: 2021,
  brand_name: "Fiat",
  model_name: "Cronos",
  vehicle_enabled: true,
  client_name: "Martín",
  client_surname: null,
  client_phone_number: "11 5555-0101",
  client_enabled: true,
  job_id: null,
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

describe("listAppointments", () => {
  it("reads the days of the range from the list view, active ones, in a day's order", async () => {
    const queries = setup(() => ({ data: [ROW] }));
    const result = await listAppointments("2026-09-28", "2026-11-01");

    expect(result).toMatchObject({ ok: true, rows: [{ id: "a1", time: "09:00" }] });
    expect(queries[0].table).toBe("appointment_list");
    expect(filterValue(queries[0], "gte", "date")).toBe("2026-09-28");
    expect(filterValue(queries[0], "lte", "date")).toBe("2026-11-01");
    expect(filterValue(queries[0], "eq", "enabled")).toBe(true);
    expect(queries[0].calls.filter(([name]) => name === "order").map(([, column]) => column)).toEqual([
      "date",
      "time",
      "created_at",
      "id",
    ]);
    expect(mocks.requireSession).toHaveBeenCalled();
  });

  it("fails quietly when the query fails", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await listAppointments("2026-08-01", "2026-09-01")).toEqual({ ok: false });
  });
});

describe("getAppointmentCounts", () => {
  it("counts the active appointments on the table, without decrypting anything", async () => {
    const queries = setup(() => ({ count: 7 }));
    expect(await getAppointmentCounts()).toEqual({ ok: true, total: 7 });
    expect(queries[0].table).toBe("appointment");
    expect(filterValue(queries[0], "eq", "enabled")).toBe(true);
  });
});

describe("getAppointmentListRow", () => {
  it("reads one appointment as the calendar shows it", async () => {
    const queries = setup(() => ({ data: ROW }));
    expect(await getAppointmentListRow("a1")).toMatchObject({ ok: true, row: { id: "a1", jobId: null } });
    expect(filterValue(queries[0], "eq", "id")).toBe("a1");
  });

  it("is not ok when it does not exist or the query fails", async () => {
    setup(() => ({ data: null }));
    expect(await getAppointmentListRow("a2")).toEqual({ ok: false });
    setup(() => ({ error: { code: "XX000" } }));
    expect(await getAppointmentListRow("a3")).toEqual({ ok: false });
  });
});
