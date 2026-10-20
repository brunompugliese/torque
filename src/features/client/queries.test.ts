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

import { getClientCounts, listClients } from "./queries";

const ROW = {
  id: "c1",
  name: "Ana",
  surname: "Gómez",
  dni: "28456123",
  phone_number: "11 12345678",
  email: null,
  enabled: false,
  created_at: "2026-10-13T15:00:00+00:00",
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

describe("listClients", () => {
  it("checks the session and reads one page from the decrypted view with the shared list rules", async () => {
    const queries = setup(() => ({ data: [ROW], count: 30 }));
    const page = await listClients({ ...DEFAULT_LIST_PARAMS, search: "35.123" });

    expect(mocks.requireSession).toHaveBeenCalled();
    expect(page).toEqual({
      ok: true,
      matching: 30,
      rows: [
        {
          id: "c1",
          name: "Ana",
          surname: "Gómez",
          dni: "28456123",
          phoneNumber: "11 12345678",
          email: null,
          enabled: false,
          createdAt: ROW.created_at,
        },
      ],
    });
    const [query] = queries;
    expect(queries).toHaveLength(1);
    expect(query.table).toBe("client_decrypted");
    expect(query.calls[0]).toEqual([
      "select",
      "id, name, surname, dni, phone_number, email, enabled, created_at",
      { count: "exact" },
    ]);
    expect(filterValue(query, "like", "search_text")).toBe("%35123%");
    expect(query.calls).toContainEqual(["order", "name_key", { ascending: true, nullsFirst: false }]);
  });

  it.each([
    ["cliente", "name_key"],
    ["dni", "dni_number"],
    ["telefono", "phone_key"],
    ["email", "email_key"],
    ["creado", "created_at"],
  ])("sorts the %s column by %s", async (sortBy, column) => {
    const queries = setup(() => ({ data: [], count: 0 }));
    await listClients({ ...DEFAULT_LIST_PARAMS, sortBy, sort: "desc" });
    expect(queries[0].calls).toContainEqual(["order", column, { ascending: false, nullsFirst: false }]);
  });

  it("falls back to the default order for an unknown column", async () => {
    const queries = setup(() => ({ data: [], count: 0 }));
    await listClients({ ...DEFAULT_LIST_PARAMS, sortBy: "otro" });
    expect(queries[0].calls).toContainEqual(["order", "name_key", { ascending: true, nullsFirst: false }]);
  });

  it("reports a failure without throwing", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await listClients(DEFAULT_LIST_PARAMS)).toEqual({ ok: false });
  });
});

describe("getClientCounts", () => {
  it("counts all and archived clients with head-only queries on the table, not the view", async () => {
    const queries = setup((query) => ({ count: filterValue(query, "eq", "enabled") === false ? 1 : 10 }));
    expect(await getClientCounts()).toEqual({ ok: true, total: 10, archived: 1 });
    for (const query of queries) {
      expect(query.table).toBe("client");
      expect(query.calls[0]).toEqual(["select", "id", { count: "exact", head: true }]);
    }
  });

  it("reports a failure without throwing", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await getClientCounts()).toEqual({ ok: false });
  });
});
