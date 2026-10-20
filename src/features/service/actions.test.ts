import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeSupabase, filterValue, type FakeQuery, type FakeResult } from "@/test/supabase";

const mocks = vi.hoisted(() => ({
  supabase: null as unknown,
  revalidatePath: vi.fn(),
  requireSession: vi.fn(async () => ({ userId: "u1", shopId: "shop-a" })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ supabase: mocks.supabase }),
}));
vi.mock("@/lib/auth/session", () => ({ requireSession: mocks.requireSession }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createService, setServiceArchived, updateService } from "./actions";

const ID = "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const OTHER_ID = "7a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const ROW = {
  id: ID,
  name: "Cambio de aceite",
  description: null,
  enabled: true,
  created_at: "2026-10-13T15:00:00+00:00",
};

type Responder = (query: FakeQuery) => FakeResult | undefined;

// Default database: no name clash, service unused, writes echo ROW.
function setup(overrides: Responder = () => undefined) {
  const fake = createFakeSupabase((query) => {
    const custom = overrides(query);
    if (custom) return custom;
    if (query.table === "job_item") return { data: [] };
    if (query.operation === "select" && filterValue(query, "eq", "name_key") !== undefined) return { data: null };
    if (query.operation === "select") return { data: { name: ROW.name } };
    return { data: ROW };
  });
  mocks.supabase = fake.supabase;
  return fake.queries;
}

const writes = (queries: FakeQuery[]) => queries.filter((q) => q.operation === "insert" || q.operation === "update");

beforeEach(() => {
  mocks.revalidatePath.mockReset();
  mocks.requireSession.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createService", () => {
  it("validates on the server with the shared schema and writes nothing when invalid", async () => {
    const queries = setup();
    expect(await createService({ name: "   ", description: "" })).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { name: "nameRequired" },
    });
    expect(queries).toHaveLength(0);
  });

  it("creates the service with the tidied values in the user's shop", async () => {
    const queries = setup();
    const result = await createService({ name: "  Cambio  de aceite ", description: "  " });

    expect(result).toEqual({
      ok: true,
      data: { id: ID, name: ROW.name, description: null, enabled: true, createdAt: ROW.created_at },
    });
    const [lookup, insert] = queries;
    expect(filterValue(lookup, "eq", "name_key")).toBe("cambiodeaceite");
    expect(insert.calls[0]).toEqual([
      "insert",
      { shop_id: "shop-a", name: "Cambio de aceite", description: null },
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/servicios");
  });

  it.each([
    [true, "nameTaken"],
    [false, "nameTakenArchived"],
  ])("rejects a name already used (enabled: %s) with %s on Nombre", async (enabled, error) => {
    const queries = setup((query) =>
      filterValue(query, "eq", "name_key") !== undefined ? { data: { id: OTHER_ID, enabled } } : undefined,
    );
    expect(await createService({ name: "CAMBIO DE ACEÍTE" })).toEqual({ ok: false, error, fieldErrors: { name: error } });
    expect(writes(queries)).toHaveLength(0);
  });

  it("returns unexpected when the database fails", async () => {
    setup((query) => (query.operation === "insert" ? { error: { code: "XX000" } } : undefined));
    expect(await createService({ name: "Lavado" })).toEqual({ ok: false, error: "unexpected" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateService", () => {
  it("rejects an invalid id without querying", async () => {
    const queries = setup();
    expect(await updateService("not-a-uuid", { name: "Lavado" })).toEqual({ ok: false, error: "notFound" });
    expect(queries).toHaveLength(0);
  });

  it("saves a description-only change without lookups or confirmation", async () => {
    const queries = setup();
    const result = await updateService(ID, { name: "Cambio de aceite", description: "Incluye filtro." });

    expect(result.ok).toBe(true);
    expect(queries.map((q) => q.table)).toEqual(["service", "service"]);
    expect(writes(queries)[0].calls[0]).toEqual(["update", { name: "Cambio de aceite", description: "Incluye filtro." }]);
    expect(filterValue(writes(queries)[0], "eq", "id")).toBe(ID);
  });

  it("treats a change of case, accents or spacing as no rename", async () => {
    const queries = setup((query) => (query.table === "job_item" ? { data: [{ id: "i1" }] } : undefined));
    const result = await updateService(ID, { name: "cambio  de ACEÍTE" });
    expect(result.ok).toBe(true);
    expect(queries.some((q) => q.table === "job_item")).toBe(false);
  });

  it("asks for confirmation when renaming a service that is on jobs", async () => {
    const queries = setup((query) => (query.table === "job_item" ? { data: [{ id: "i1" }] } : undefined));
    expect(await updateService(ID, { name: "Service completo" })).toEqual({
      ok: false,
      error: "renameNeedsConfirmation",
    });
    const usage = queries.find((q) => q.table === "job_item")!;
    expect(filterValue(usage, "eq", "service_id")).toBe(ID);
    expect(usage.calls).toContainEqual(["limit", 1]);
    expect(writes(queries)).toHaveLength(0);
  });

  it("renames once confirmed", async () => {
    const queries = setup((query) => (query.table === "job_item" ? { data: [{ id: "i1" }] } : undefined));
    const result = await updateService(ID, { name: "Service completo" }, { confirmRename: true });
    expect(result.ok).toBe(true);
    expect(queries.some((q) => q.table === "job_item")).toBe(false);
    expect(writes(queries)).toHaveLength(1);
  });

  it("renames an unused service without confirmation", async () => {
    const queries = setup();
    expect((await updateService(ID, { name: "Service completo" })).ok).toBe(true);
    expect(writes(queries)).toHaveLength(1);
  });

  it("checks the new name against other services, excluding itself", async () => {
    const queries = setup((query) =>
      filterValue(query, "eq", "name_key") !== undefined ? { data: { id: OTHER_ID, enabled: false } } : undefined,
    );
    expect(await updateService(ID, { name: "Lavado de motor" })).toEqual({
      ok: false,
      error: "nameTakenArchived",
      fieldErrors: { name: "nameTakenArchived" },
    });
    const lookup = queries.find((q) => filterValue(q, "eq", "name_key") !== undefined)!;
    expect(filterValue(lookup, "neq", "id")).toBe(ID);
  });

  it("returns notFound for a service the user can't see", async () => {
    setup((query) => (query.operation === "select" && !filterValue(query, "eq", "name_key") ? { data: null } : undefined));
    expect(await updateService(ID, { name: "Lavado" })).toEqual({ ok: false, error: "notFound" });
  });

  it("returns unexpected when a lookup fails", async () => {
    setup((query) => (query.table === "job_item" ? { error: { code: "XX000" } } : undefined));
    expect(await updateService(ID, { name: "Otro nombre" })).toEqual({ ok: false, error: "unexpected" });
  });
});

describe("setServiceArchived", () => {
  it.each([
    [true, false],
    [false, true],
  ])("archived=%s writes enabled=%s", async (archived, enabled) => {
    const queries = setup();
    expect((await setServiceArchived(ID, archived)).ok).toBe(true);
    expect(writes(queries)[0].calls[0]).toEqual(["update", { enabled }]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/servicios");
  });

  it("returns notFound when no row was updated", async () => {
    setup((query) => (query.operation === "update" ? { data: null } : undefined));
    expect(await setServiceArchived(ID, true)).toEqual({ ok: false, error: "notFound" });
  });
});
