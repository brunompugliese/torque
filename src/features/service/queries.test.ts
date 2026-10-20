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

import { getServiceCounts, listServices } from "./queries";

const ROW = { id: "s1", name: "Lavado", description: null, enabled: false, created_at: "2026-10-13T15:00:00+00:00" };

function setup(respond: (query: FakeQuery) => FakeResult) {
  const fake = createFakeSupabase(respond);
  mocks.supabase = fake.supabase;
  return fake.queries;
}

beforeEach(() => {
  mocks.requireSession.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listServices", () => {
  it("checks the session and queries one page with the shared list rules", async () => {
    const queries = setup(() => ({ data: [ROW], count: 30 }));
    const page = await listServices({ ...DEFAULT_LIST_PARAMS, search: "lav" });

    expect(mocks.requireSession).toHaveBeenCalled();
    expect(page).toEqual({
      ok: true,
      matching: 30,
      rows: [{ id: "s1", name: "Lavado", description: null, enabled: false, createdAt: ROW.created_at }],
    });
    const [query] = queries;
    expect(query.calls[0]).toEqual(["select", "id, name, description, enabled, created_at", { count: "exact" }]);
    expect(filterValue(query, "like", "search_text")).toBe("%lav%");
    expect(query.calls).toContainEqual(["order", "name_key", { ascending: true, nullsFirst: false }]);
  });

  it("reports a failure without throwing", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await listServices(DEFAULT_LIST_PARAMS)).toEqual({ ok: false });
  });
});

describe("getServiceCounts", () => {
  it("counts all and archived services with head-only queries", async () => {
    const queries = setup((query) => ({ count: filterValue(query, "eq", "enabled") === false ? 1 : 15 }));
    expect(await getServiceCounts()).toEqual({ ok: true, total: 15, archived: 1 });
    for (const query of queries) {
      expect(query.calls[0]).toEqual(["select", "id", { count: "exact", head: true }]);
    }
  });

  it("reports a failure without throwing", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await getServiceCounts()).toEqual({ ok: false });
  });
});
