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

import {
  createVehicle,
  getBrandOptions,
  getModelOptions,
  searchVehicles,
  setVehicleArchived,
  updateVehicle,
} from "./actions";

// Writes, search and catalog options of the vehicles page. The reads and the
// assignment used by the client modal are in actions.test.ts.

const CLIENT_ID = "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const BRAND_ID = "aa1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const MODEL_ID = "bb1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const VEHICLE_ID = "cc1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const LIST_ROW = {
  id: VEHICLE_ID,
  plate: "AB123CD",
  brand_id: BRAND_ID,
  model_id: MODEL_ID,
  brand_name: "Fiat",
  model_name: "Cronos",
  year: 2021,
  vin: null,
  enabled: true,
  created_at: "2026-10-13T15:00:00+00:00",
  client_id: null,
  client_name: null,
  client_surname: null,
  client_phone_number: null,
  client_enabled: null,
  last_km: null,
};

const SAVED = {
  id: VEHICLE_ID,
  plate: "AB123CD",
  brandId: BRAND_ID,
  modelId: MODEL_ID,
  brandName: "Fiat",
  modelName: "Cronos",
  year: 2021,
  vin: null,
  enabled: true,
  createdAt: LIST_ROW.created_at,
  lastKm: null,
  client: null,
};

const INPUT = {
  plate: "ab 123 cd",
  year: "2021",
  brandId: BRAND_ID,
  modelId: MODEL_ID,
  vin: "",
  clientId: "",
  newClient: null,
};
const NEW_CLIENT = { name: " Ana ", surname: "", phoneNumber: "1112345678", dni: "28.456.123" };

type Responder = (query: FakeQuery) => FakeResult | undefined;

const isPlateLookup = (query: FakeQuery) =>
  query.table === "vehicle_decrypted" && filterValue(query, "eq", "plate") !== undefined;
const isDniLookup = (query: FakeQuery) =>
  query.table === "client_decrypted" && filterValue(query, "eq", "dni") !== undefined;

// Default database: writes answer the id, the view answers the saved row, the
// function answers the vehicle's id and the plate and DNI lookups find nothing.
function setupDb(overrides: Responder = () => undefined) {
  const fake = createFakeSupabase((query) => {
    const custom = overrides(query);
    if (custom) return custom;
    if (isPlateLookup(query) || isDniLookup(query)) return { data: null };
    if (query.table === "vehicle_decrypted") return { data: LIST_ROW };
    if (query.operation === "rpc") return { data: VEHICLE_ID };
    return { data: { id: VEHICLE_ID } };
  });
  mocks.supabase = fake.supabase;
  return fake.queries;
}

const duplicatePlate: Responder = (query) =>
  query.table === "vehicle" && (query.operation === "insert" || query.operation === "update")
    ? { error: { code: "23505" } }
    : undefined;

const rpcError =
  (message: string, code = "P0001"): Responder =>
  (query) =>
    query.operation === "rpc" ? { error: { code, message } } : undefined;

// The lookup that finds out whose plate or DNI it is.
const lookupFinds =
  (table: string, enabled: boolean): Responder =>
  (query) =>
    query.table === table && query.calls.some(([name, column]) => name === "eq" && column !== "id")
      ? { data: { id: "other", enabled } }
      : undefined;

const first =
  (...responders: Responder[]): Responder =>
  (query) => {
    for (const responder of responders) {
      const result = responder(query);
      if (result) return result;
    }
    return undefined;
  };

beforeEach(() => {
  mocks.revalidatePath.mockReset();
  mocks.requireSession.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createVehicle", () => {
  it("validates on the server with the shared schema and writes nothing when invalid", async () => {
    const queries = setupDb();
    expect(await createVehicle({ plate: "", year: "1800", brandId: "", modelId: "", vin: "123" })).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: {
        plate: "plateRequired",
        year: "yearInvalid",
        brandId: "brandRequired",
        modelId: "modelRequired",
        vin: "vinInvalid",
      },
    });
    expect(queries).toHaveLength(0);
  });

  it("inserts the tidied values into the table in the user's shop and reads the vehicle back from the view", async () => {
    const queries = setupDb();
    const result = await createVehicle({ ...INPUT, vin: " 8ap359a1xmu-123456 " });

    expect(result).toEqual({ ok: true, data: SAVED });
    expect(mocks.requireSession).toHaveBeenCalled();
    expect(queries.map((q) => q.table)).toEqual(["vehicle", "vehicle_decrypted"]);
    const [insert, readBack] = queries;
    expect(insert.calls[0]).toEqual([
      "insert",
      {
        shop_id: "shop-a",
        client_id: null,
        plate: "AB123CD",
        brand_id: BRAND_ID,
        model_id: MODEL_ID,
        year: 2021,
        vin: "8AP359A1XMU123456",
      },
    ]);
    expect(filterValue(readBack, "eq", "id")).toBe(VEHICLE_ID);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/vehiculos");
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith("/clientes");
  });

  it("attaches an existing client", async () => {
    const queries = setupDb();
    await createVehicle({ ...INPUT, clientId: CLIENT_ID });
    expect(queries[0].calls[0][1]).toMatchObject({ client_id: CLIENT_ID });
  });

  it("creates the client and the vehicle with one database function call", async () => {
    const queries = setupDb();
    const result = await createVehicle({ ...INPUT, newClient: NEW_CLIENT });

    expect(result).toEqual({ ok: true, data: SAVED });
    expect(queries.map((q) => q.table)).toEqual(["save_vehicle_with_new_client", "vehicle_decrypted"]);
    expect(queries[0].calls[0]).toEqual([
      "rpc",
      "save_vehicle_with_new_client",
      {
        p_vehicle_id: null,
        p_plate: "AB123CD",
        p_brand_id: BRAND_ID,
        p_model_id: MODEL_ID,
        p_year: 2021,
        p_vin: null,
        p_name: "Ana",
        p_surname: null,
        p_phone_number: "11 1234-5678",
        p_dni: "28456123",
      },
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/vehiculos");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/clientes");
  });

  it("never sends the shop to the database function: it takes it from the session", async () => {
    const queries = setupDb();
    await createVehicle({ ...INPUT, newClient: NEW_CLIENT });
    expect(JSON.stringify(queries[0].calls)).not.toContain("shop-a");
  });

  it("refuses an existing client and a new one together, without writing", async () => {
    const queries = setupDb();
    expect(await createVehicle({ ...INPUT, clientId: CLIENT_ID, newClient: NEW_CLIENT })).toMatchObject({
      ok: false,
      error: "invalid",
      fieldErrors: { newClient: "invalid" },
    });
    expect(queries).toHaveLength(0);
  });

  it("tells a taken plate from an active vehicle", async () => {
    const queries = setupDb(first(duplicatePlate, lookupFinds("vehicle_decrypted", true)));
    expect(await createVehicle(INPUT)).toEqual({ ok: false, error: "plateTaken", fieldErrors: { plate: "plateTaken" } });
    expect(queries.map((q) => q.table)).toEqual(["vehicle", "vehicle_decrypted"]);
    expect(filterValue(queries[1], "eq", "plate")).toBe("AB123CD");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("tells a taken plate from an archived vehicle", async () => {
    setupDb(first(duplicatePlate, lookupFinds("vehicle_decrypted", false)));
    expect(await createVehicle(INPUT)).toEqual({
      ok: false,
      error: "plateTakenArchived",
      fieldErrors: { plate: "plateTakenArchived" },
    });
  });

  it("is unexpected when the database refuses the plate but nobody has it", async () => {
    setupDb(duplicatePlate);
    expect(await createVehicle(INPUT)).toEqual({ ok: false, error: "unexpected" });
  });

  it("names the plate when the database function says it is taken, and the DNI when that is", async () => {
    setupDb(first(rpcError("vehicle_plate_taken", "23505"), lookupFinds("vehicle_decrypted", true)));
    expect(await createVehicle({ ...INPUT, newClient: NEW_CLIENT })).toEqual({
      ok: false,
      error: "plateTaken",
      fieldErrors: { plate: "plateTaken" },
    });

    setupDb(first(rpcError("client_dni_taken", "23505"), lookupFinds("client_decrypted", true)));
    expect(await createVehicle({ ...INPUT, newClient: NEW_CLIENT })).toEqual({
      ok: false,
      error: "dniTaken",
      fieldErrors: { "newClient.dni": "dniTaken" },
    });
  });

  it("says when the DNI belongs to an archived client", async () => {
    const queries = setupDb(first(rpcError("client_dni_taken", "23505"), lookupFinds("client_decrypted", false)));
    expect(await createVehicle({ ...INPUT, newClient: NEW_CLIENT })).toEqual({
      ok: false,
      error: "dniTakenArchived",
      fieldErrors: { "newClient.dni": "dniTakenArchived" },
    });
    expect(filterValue(queries[1], "eq", "dni")).toBe("28456123");
  });

  it("is unexpected when a taken DNI can't be found, or a new client has none", async () => {
    setupDb(rpcError("client_dni_taken", "23505"));
    expect(await createVehicle({ ...INPUT, newClient: NEW_CLIENT })).toEqual({ ok: false, error: "unexpected" });
    setupDb(rpcError("client_dni_taken", "23505"));
    expect(await createVehicle({ ...INPUT, newClient: { ...NEW_CLIENT, dni: "" } })).toEqual({
      ok: false,
      error: "unexpected",
    });
  });

  it("is invalid when the database rejects the brand and model pair or the client", async () => {
    setupDb((query) => (query.table === "vehicle" ? { error: { code: "23503" } } : undefined));
    expect(await createVehicle(INPUT)).toEqual({ ok: false, error: "invalid" });
    setupDb(rpcError("insert or update violates foreign key", "23503"));
    expect(await createVehicle({ ...INPUT, newClient: NEW_CLIENT })).toEqual({ ok: false, error: "invalid" });
  });

  it("is unexpected on any other failure, logging only the code", async () => {
    setupDb((query) => (query.table === "vehicle" ? { error: { code: "XX000" } } : undefined));
    expect(await createVehicle(INPUT)).toEqual({ ok: false, error: "unexpected" });
    expect(console.error).toHaveBeenCalledWith("[vehicle] write failed", { code: "XX000" });

    setupDb(rpcError("a message with a DNI 28456123", "XX000"));
    expect(await createVehicle({ ...INPUT, newClient: NEW_CLIENT })).toEqual({ ok: false, error: "unexpected" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("28456123");
  });

  it("is unexpected when the read back fails or the function answers nothing", async () => {
    setupDb((query) => (query.table === "vehicle_decrypted" ? { error: { code: "XX000" } } : undefined));
    expect(await createVehicle(INPUT)).toEqual({ ok: false, error: "unexpected" });

    setupDb((query) => (query.operation === "rpc" ? { data: null } : undefined));
    expect(await createVehicle({ ...INPUT, newClient: NEW_CLIENT })).toEqual({ ok: false, error: "unexpected" });
  });
});

describe("updateVehicle", () => {
  it("fails without querying when the id isn't a uuid", async () => {
    const queries = setupDb();
    expect(await updateVehicle("nope", INPUT)).toEqual({ ok: false, error: "notFound" });
    expect(queries).toHaveLength(0);
  });

  it("validates on the server and writes nothing when invalid", async () => {
    const queries = setupDb();
    expect(await updateVehicle(VEHICLE_ID, { ...INPUT, plate: "A" })).toMatchObject({
      ok: false,
      error: "invalid",
      fieldErrors: { plate: "plateInvalid" },
    });
    expect(queries).toHaveLength(0);
  });

  it("updates the vehicle by id, clearing its client when none is given, and reads it back", async () => {
    const queries = setupDb();
    expect(await updateVehicle(VEHICLE_ID, INPUT)).toEqual({ ok: true, data: SAVED });

    expect(queries.map((q) => q.table)).toEqual(["vehicle", "vehicle_decrypted"]);
    const [update] = queries;
    expect(update.calls[0]).toEqual([
      "update",
      { client_id: null, plate: "AB123CD", brand_id: BRAND_ID, model_id: MODEL_ID, year: 2021, vin: null },
    ]);
    expect(filterValue(update, "eq", "id")).toBe(VEHICLE_ID);
    expect(mocks.requireSession).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/vehiculos");
  });

  it("is not found when no vehicle of the shop has that id", async () => {
    setupDb((query) => (query.table === "vehicle" ? { data: null } : undefined));
    expect(await updateVehicle(VEHICLE_ID, INPUT)).toEqual({ ok: false, error: "notFound" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("doesn't clash with the vehicle's own plate: the lookup leaves it out", async () => {
    const queries = setupDb(first(duplicatePlate, lookupFinds("vehicle_decrypted", true)));
    expect(await updateVehicle(VEHICLE_ID, INPUT)).toMatchObject({ ok: false, error: "plateTaken" });
    expect(queries[1].calls).toContainEqual(["neq", "id", VEHICLE_ID]);
  });

  it("saves a new client with the vehicle through the database function", async () => {
    const queries = setupDb();
    expect(await updateVehicle(VEHICLE_ID, { ...INPUT, newClient: NEW_CLIENT })).toEqual({ ok: true, data: SAVED });
    expect(queries[0].calls[0]).toMatchObject(["rpc", "save_vehicle_with_new_client", { p_vehicle_id: VEHICLE_ID }]);
    expect(queries.map((q) => q.table)).not.toContain("vehicle");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/clientes");
  });

  it("is not found when the function can't find the vehicle", async () => {
    setupDb(rpcError("vehicle_not_found", "P0002"));
    expect(await updateVehicle(VEHICLE_ID, { ...INPUT, newClient: NEW_CLIENT })).toEqual({
      ok: false,
      error: "notFound",
    });
  });
});

describe("setVehicleArchived", () => {
  it("archives and unarchives by id and reads the vehicle back", async () => {
    const archive = setupDb();
    expect(await setVehicleArchived(VEHICLE_ID, true)).toEqual({ ok: true, data: SAVED });
    expect(archive[0].calls[0]).toEqual(["update", { enabled: false }]);
    expect(filterValue(archive[0], "eq", "id")).toBe(VEHICLE_ID);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/vehiculos");

    const unarchive = setupDb();
    await setVehicleArchived(VEHICLE_ID, false);
    expect(unarchive[0].calls[0]).toEqual(["update", { enabled: true }]);
  });

  it("fails without querying when the id isn't a uuid", async () => {
    const queries = setupDb();
    expect(await setVehicleArchived("nope", true)).toEqual({ ok: false, error: "notFound" });
    expect(queries).toHaveLength(0);
  });

  it("is not found when no vehicle of the shop has that id", async () => {
    setupDb((query) => (query.table === "vehicle" ? { data: null } : undefined));
    expect(await setVehicleArchived(VEHICLE_ID, true)).toEqual({ ok: false, error: "notFound" });
  });

  it("is unexpected on failure, logging only the code", async () => {
    setupDb((query) => (query.table === "vehicle" ? { error: { code: "XX000" } } : undefined));
    expect(await setVehicleArchived(VEHICLE_ID, true)).toEqual({ ok: false, error: "unexpected" });
    expect(console.error).toHaveBeenCalledWith("[vehicle] archive failed", { code: "XX000" });
  });
});

describe("searchVehicles", () => {
  it("runs the list query for the state it is sent, search included", async () => {
    const queries = setupDb((query) =>
      query.table === "vehicle_decrypted" ? { data: [LIST_ROW], count: 1 } : undefined,
    );
    const result = await searchVehicles("buscar=ae+482&orden=km&sentido=desc&pagina=2");

    expect(result).toEqual({ ok: true, matching: 1, rows: [SAVED] });
    expect(filterValue(queries[0], "like", "search_text")).toBe("%ae482%");
    expect(queries[0].calls).toContainEqual(["order", "last_km", { ascending: false, nullsFirst: false }]);
    expect(queries[0].calls).toContainEqual(["range", 25, 49]);
  });

  it("falls back to the default list for anything that isn't a string", async () => {
    const queries = setupDb((query) => (query.table === "vehicle_decrypted" ? { data: [], count: 0 } : undefined));
    await searchVehicles(undefined);
    expect(queries[0].calls).toContainEqual(["range", 0, 24]);
  });
});

describe("getBrandOptions and getModelOptions", () => {
  it("read the catalog for valid ids", async () => {
    const queries = setupDb(() => ({ data: [{ id: BRAND_ID, name: "Fiat" }] }));
    expect(await getBrandOptions()).toEqual({ ok: true, rows: [{ id: BRAND_ID, name: "Fiat" }] });
    expect(await getBrandOptions(null)).toMatchObject({ ok: true });
    await getBrandOptions(BRAND_ID);
    expect(queries[2].calls).toContainEqual(["or", `enabled.eq.true,id.eq.${BRAND_ID}`]);

    const models = setupDb(() => ({ data: [] }));
    expect(await getModelOptions(BRAND_ID)).toEqual({ ok: true, rows: [] });
    expect(filterValue(models[0], "eq", "brand_id")).toBe(BRAND_ID);
    await getModelOptions(BRAND_ID, MODEL_ID);
    expect(models[1].calls).toContainEqual(["or", `enabled.eq.true,id.eq.${MODEL_ID}`]);
  });

  it("fail without querying when an id isn't a uuid, which also keeps it out of the filter", async () => {
    const queries = setupDb(() => ({ data: [] }));
    expect(await getBrandOptions("x,enabled.eq.false")).toEqual({ ok: false });
    expect(await getModelOptions("nope")).toEqual({ ok: false });
    expect(await getModelOptions(BRAND_ID, "x,enabled.eq.false")).toEqual({ ok: false });
    expect(queries).toHaveLength(0);
  });
});
