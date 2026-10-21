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

import { createClient, searchClients, setClientArchived, updateClient } from "./actions";

const ID = "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const OTHER_ID = "7a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const ROW = {
  id: ID,
  name: "Ana",
  surname: "Gómez",
  dni: "28456123",
  phone_number: "11 12345678",
  email: "ana@example.com",
  enabled: true,
  created_at: "2026-10-13T15:00:00+00:00",
};

const CLIENT = {
  id: ID,
  name: "Ana",
  surname: "Gómez",
  dni: "28456123",
  phoneNumber: "11 12345678",
  email: "ana@example.com",
  enabled: true,
  createdAt: ROW.created_at,
};

const INPUT = {
  name: "  Ana ",
  surname: "Gómez",
  phoneNumber: "11 1234-5678",
  dni: "28.456.123",
  email: "ana@example.com",
};

type Responder = (query: FakeQuery) => FakeResult | undefined;

const isLookup = (query: FakeQuery) => query.table === "client_decrypted" && filterValue(query, "eq", "dni") !== undefined;

// Default database: writes answer the id, the view answers the saved row, and
// the DNI lookup finds nothing.
function setup(overrides: Responder = () => undefined) {
  const fake = createFakeSupabase((query) => {
    const custom = overrides(query);
    if (custom) return custom;
    if (isLookup(query)) return { data: null };
    if (query.table === "client_decrypted") return { data: ROW };
    return { data: { id: ID } };
  });
  mocks.supabase = fake.supabase;
  return fake.queries;
}

const duplicateDni: Responder = (query) =>
  query.table === "client" && (query.operation === "insert" || query.operation === "update")
    ? { error: { code: "23505" } }
    : undefined;

const writes = (queries: FakeQuery[]) => queries.filter((q) => q.operation === "insert" || q.operation === "update");

beforeEach(() => {
  mocks.revalidatePath.mockReset();
  mocks.requireSession.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createClient", () => {
  it("validates on the server with the shared schema and writes nothing when invalid", async () => {
    const queries = setup();
    expect(await createClient({ name: " ", phoneNumber: "", dni: "abc", email: "x@" })).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { name: "nameRequired", phoneNumber: "phoneRequired", dni: "dniInvalid", email: "emailInvalid" },
    });
    expect(queries).toHaveLength(0);
  });

  it("inserts the tidied values into the table in the user's shop and reads the client back from the view", async () => {
    const queries = setup();
    const result = await createClient(INPUT);

    expect(result).toEqual({ ok: true, data: CLIENT });
    expect(queries.map((q) => q.table)).toEqual(["client", "client_decrypted"]);
    const [insert, readBack] = queries;
    expect(insert.calls[0]).toEqual([
      "insert",
      {
        shop_id: "shop-a",
        name: "Ana",
        surname: "Gómez",
        dni: "28456123",
        phone_number: "11 1234-5678",
        email: "ana@example.com",
      },
    ]);
    expect(filterValue(readBack, "eq", "id")).toBe(ID);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/clientes");
  });

  it("stores empty optional fields as null", async () => {
    const queries = setup();
    await createClient({ name: "Zoe", surname: "", phoneNumber: "1112345678", dni: "", email: "" });
    expect(queries[0].calls[0]).toEqual([
      "insert",
      { shop_id: "shop-a", name: "Zoe", surname: null, dni: null, phone_number: "11 1234-5678", email: null },
    ]);
  });

  it("says the DNI is taken by an active client, under DNI", async () => {
    const queries = setup((query) => duplicateDni(query) ?? (isLookup(query) ? { data: { id: OTHER_ID, enabled: true } } : undefined));
    expect(await createClient(INPUT)).toEqual({ ok: false, error: "dniTaken", fieldErrors: { dni: "dniTaken" } });
    expect(filterValue(queries[1], "eq", "dni")).toBe("28456123");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("says when the client with that DNI is archived", async () => {
    setup((query) => duplicateDni(query) ?? (isLookup(query) ? { data: { id: OTHER_ID, enabled: false } } : undefined));
    expect(await createClient(INPUT)).toEqual({
      ok: false,
      error: "dniTakenArchived",
      fieldErrors: { dni: "dniTakenArchived" },
    });
  });

  it("is unexpected when a duplicate can't be traced to a DNI", async () => {
    setup(duplicateDni);
    expect(await createClient(INPUT)).toEqual({ ok: false, error: "unexpected" });
    expect(await createClient({ ...INPUT, dni: "" })).toEqual({ ok: false, error: "unexpected" });
  });

  it("is unexpected when the DNI lookup fails", async () => {
    setup((query) => duplicateDni(query) ?? (isLookup(query) ? { error: { code: "XX000" } } : undefined));
    expect(await createClient(INPUT)).toEqual({ ok: false, error: "unexpected" });
  });

  it("is unexpected when the insert or the read back fails, logging only the code", async () => {
    setup((query) => (query.operation === "insert" ? { error: { code: "XX000" } } : undefined));
    expect(await createClient(INPUT)).toEqual({ ok: false, error: "unexpected" });
    expect(console.error).toHaveBeenCalledWith("[client] insert failed", { code: "XX000" });

    setup((query) => (query.table === "client_decrypted" ? { error: { code: "XX001" } } : undefined));
    expect(await createClient(INPUT)).toEqual({ ok: false, error: "unexpected" });
    expect(console.error).toHaveBeenCalledWith("[client] read back failed", { code: "XX001" });
  });

  it("never logs personal data", async () => {
    setup((query) => (query.operation === "insert" ? { error: { code: "XX000" } } : undefined));
    await createClient(INPUT);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/Ana|28456123|example\.com|1234-5678/);
  });
});

describe("updateClient", () => {
  it("treats an id that isn't a uuid as not found, without touching the database", async () => {
    const queries = setup();
    expect(await updateClient("nope", INPUT)).toEqual({ ok: false, error: "notFound" });
    expect(queries).toHaveLength(0);
  });

  it("validates on the server and writes nothing when invalid", async () => {
    const queries = setup();
    expect(await updateClient(ID, { ...INPUT, phoneNumber: "" })).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { phoneNumber: "phoneRequired" },
    });
    expect(queries).toHaveLength(0);
  });

  it("updates the client by id (not its shop, not its archive state) and reads it back", async () => {
    const queries = setup();
    const result = await updateClient(ID, INPUT);

    expect(result).toEqual({ ok: true, data: CLIENT });
    const [update, readBack] = queries;
    expect(update.table).toBe("client");
    expect(update.calls[0]).toEqual([
      "update",
      { name: "Ana", surname: "Gómez", dni: "28456123", phone_number: "11 1234-5678", email: "ana@example.com" },
    ]);
    expect(filterValue(update, "eq", "id")).toBe(ID);
    expect(readBack.table).toBe("client_decrypted");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/clientes");
  });

  it("makes two queries for a normal edit, and the same DNI never clashes with itself", async () => {
    const queries = setup();
    expect((await updateClient(ID, INPUT)).ok).toBe(true);
    expect(queries).toHaveLength(2);
  });

  it("is not found when the client doesn't exist", async () => {
    setup((query) => (query.operation === "update" ? { data: null } : undefined));
    expect(await updateClient(ID, INPUT)).toEqual({ ok: false, error: "notFound" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("says the DNI is taken by another client, excluding the client itself from the lookup", async () => {
    const queries = setup((query) => duplicateDni(query) ?? (isLookup(query) ? { data: { id: OTHER_ID, enabled: true } } : undefined));
    expect(await updateClient(ID, INPUT)).toEqual({ ok: false, error: "dniTaken", fieldErrors: { dni: "dniTaken" } });
    expect(queries[1].calls).toContainEqual(["neq", "id", ID]);
  });

  it("says when the other client with that DNI is archived", async () => {
    setup((query) => duplicateDni(query) ?? (isLookup(query) ? { data: { id: OTHER_ID, enabled: false } } : undefined));
    expect(await updateClient(ID, INPUT)).toEqual({
      ok: false,
      error: "dniTakenArchived",
      fieldErrors: { dni: "dniTakenArchived" },
    });
  });

  it("works on an archived client", async () => {
    setup((query) => (query.table === "client_decrypted" ? { data: { ...ROW, enabled: false } } : undefined));
    expect(await updateClient(ID, INPUT)).toEqual({ ok: true, data: { ...CLIENT, enabled: false } });
  });

  it("is unexpected when the update fails", async () => {
    setup((query) => (query.operation === "update" ? { error: { code: "XX000" } } : undefined));
    expect(await updateClient(ID, INPUT)).toEqual({ ok: false, error: "unexpected" });
  });
});

describe("setClientArchived", () => {
  it.each([
    [true, false],
    [false, true],
  ])("archived=%s writes enabled=%s and returns the client", async (archived, enabled) => {
    const queries = setup((query) =>
      query.table === "client_decrypted" ? { data: { ...ROW, enabled } } : undefined,
    );
    expect(await setClientArchived(ID, archived)).toEqual({ ok: true, data: { ...CLIENT, enabled } });
    expect(writes(queries)[0].calls[0]).toEqual(["update", { enabled }]);
    expect(filterValue(queries[0], "eq", "id")).toBe(ID);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/clientes");
  });

  it("changes nothing else about the client", async () => {
    const queries = setup();
    await setClientArchived(ID, true);
    expect(Object.keys((writes(queries)[0].calls[0][1] as object))).toEqual(["enabled"]);
  });

  it("treats an id that isn't a uuid as not found", async () => {
    const queries = setup();
    expect(await setClientArchived("nope", true)).toEqual({ ok: false, error: "notFound" });
    expect(queries).toHaveLength(0);
  });

  it("is not found when the client doesn't exist, unexpected when the update fails", async () => {
    setup((query) => (query.operation === "update" ? { data: null } : undefined));
    expect(await setClientArchived(ID, true)).toEqual({ ok: false, error: "notFound" });

    setup((query) => (query.operation === "update" ? { error: { code: "XX000" } } : undefined));
    expect(await setClientArchived(ID, true)).toEqual({ ok: false, error: "unexpected" });
  });
});

describe("searchClients", () => {
  it("checks the session and returns only the matching page for the given list state", async () => {
    const queries = setup(() => ({ data: [ROW], count: 1 }));
    const page = await searchClients("buscar=gomez&orden=creado&sentido=desc&archivados=1");

    expect(mocks.requireSession).toHaveBeenCalled();
    expect(page).toEqual({ ok: true, matching: 1, rows: [CLIENT] });
    expect(filterValue(queries[0], "like", "search_text")).toBe("%gomez%");
    expect(queries[0].calls).toContainEqual(["order", "created_at", { ascending: false, nullsFirst: false }]);
  });

  it("falls back to the defaults for anything that isn't a list search", async () => {
    const queries = setup(() => ({ data: [], count: 0 }));
    await searchClients({ not: "a string" });
    expect(queries[0].calls).toContainEqual(["order", "name_key", { ascending: true, nullsFirst: false }]);
    expect(filterValue(queries[0], "eq", "enabled")).toBe(true);
  });
});
