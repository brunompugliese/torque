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

import { assignVehiclesToClient, getClientVehicles, getUnassignedVehicles, searchVehicleOptions } from "./actions";

const CLIENT_ID = "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const V1 = "7a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const V2 = "8a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const V3 = "9a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

function setup(respond: (query: FakeQuery) => FakeResult) {
  const fake = createFakeSupabase(respond);
  mocks.supabase = fake.supabase;
  return fake.queries;
}

beforeEach(() => {
  mocks.revalidatePath.mockReset();
  mocks.requireSession.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getClientVehicles", () => {
  it("reads the vehicles of a valid client id", async () => {
    const queries = setup(() => ({ data: [] }));
    expect(await getClientVehicles(CLIENT_ID)).toEqual({ ok: true, rows: [] });
    expect(filterValue(queries[0], "eq", "client_id")).toBe(CLIENT_ID);
  });

  it("fails without querying when the id isn't a uuid", async () => {
    const queries = setup(() => ({ data: [] }));
    expect(await getClientVehicles("nope")).toEqual({ ok: false });
    expect(queries).toHaveLength(0);
  });
});

describe("getUnassignedVehicles", () => {
  it("reads the vehicles with no client", async () => {
    const queries = setup(() => ({ data: [] }));
    expect(await getUnassignedVehicles()).toEqual({ ok: true, rows: [] });
    expect(queries[0].calls).toContainEqual(["is", "client_id", null]);
  });
});

describe("assignVehiclesToClient", () => {
  it("assigns every vehicle in one statement, guarded so none that already has a client is overwritten", async () => {
    const queries = setup(() => ({ data: [{ id: V1 }, { id: V2 }] }));
    const result = await assignVehiclesToClient(CLIENT_ID, [V1, V2]);

    expect(result).toEqual({ ok: true, data: { assigned: [V1, V2], skipped: 0 } });
    expect(mocks.requireSession).toHaveBeenCalled();
    expect(queries).toHaveLength(1);
    const [update] = queries;
    expect(update.table).toBe("vehicle");
    expect(update.calls).toEqual([
      ["update", { client_id: CLIENT_ID }],
      ["in", "id", [V1, V2]],
      ["is", "client_id", null],
      ["select", "id"],
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/vehiculos");
  });

  it("counts a repeated vehicle once", async () => {
    const queries = setup(() => ({ data: [{ id: V1 }] }));
    expect(await assignVehiclesToClient(CLIENT_ID, [V1, V1])).toEqual({ ok: true, data: { assigned: [V1], skipped: 0 } });
    expect(queries[0].calls).toContainEqual(["in", "id", [V1]]);
  });

  it("assigns the rest and reports how many already had a client", async () => {
    setup(() => ({ data: [{ id: V1 }] }));
    expect(await assignVehiclesToClient(CLIENT_ID, [V1, V2, V3])).toEqual({
      ok: true,
      data: { assigned: [V1], skipped: 2 },
    });
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("fails when none could be assigned, without revalidating", async () => {
    setup(() => ({ data: [] }));
    expect(await assignVehiclesToClient(CLIENT_ID, [V1])).toEqual({ ok: false, error: "alreadyAssigned" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["a client id that isn't a uuid", ["nope", [V1]]],
    ["no vehicles", [CLIENT_ID, []]],
    ["a vehicle id that isn't a uuid", [CLIENT_ID, ["nope"]]],
    ["vehicles that aren't a list", [CLIENT_ID, V1]],
    ["nothing", [undefined, undefined]],
  ])("rejects %s without querying", async (_name, [clientId, vehicleIds]) => {
    const queries = setup(() => ({ data: [] }));
    expect(await assignVehiclesToClient(clientId, vehicleIds)).toEqual({ ok: false, error: "invalid" });
    expect(queries).toHaveLength(0);
  });

  it("works for any client, archived included: it never looks at the client's state", async () => {
    const queries = setup(() => ({ data: [{ id: V1 }] }));
    await assignVehiclesToClient(CLIENT_ID, [V1]);
    expect(queries.map((query) => query.table)).toEqual(["vehicle"]);
  });

  it("says the client wasn't found when the database rejects it (another shop's client)", async () => {
    setup(() => ({ error: { code: "23503" } }));
    expect(await assignVehiclesToClient(CLIENT_ID, [V1])).toEqual({ ok: false, error: "notFound" });
  });

  it("is unexpected on any other failure, logging only the code", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await assignVehiclesToClient(CLIENT_ID, [V1])).toEqual({ ok: false, error: "unexpected" });
    expect(console.error).toHaveBeenCalledWith("[vehicle] assign failed", { code: "XX000" });
  });
});

describe("searchVehicleOptions", () => {
  it.each([
    ["a term that is not text", () => searchVehicleOptions(42)],
    ["a current vehicle that is not an id", () => searchVehicleOptions("ae", "nope")],
  ])("fails without querying with %s", async (_name, run) => {
    const queries = setup(() => ({ data: [] }));
    expect(await run()).toEqual({ ok: false });
    expect(queries).toHaveLength(0);
  });

  it("reads with valid input", async () => {
    setup(() => ({ data: [] }));
    expect(await searchVehicleOptions("ae", V1)).toEqual({ ok: true, rows: [] });
    expect(await searchVehicleOptions("")).toEqual({ ok: true, rows: [] });
  });

  it("cuts a very long search term", async () => {
    const queries = setup(() => ({ data: [] }));
    await searchVehicleOptions("a".repeat(500));
    expect(String(filterValue(queries[0], "like", "search_text")).length).toBeLessThan(110);
  });
});
