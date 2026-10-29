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
  createJob,
  getJobDetails,
  getJobRow,
  getOwnerOfVehicle,
  getServiceOptions,
  getStatusCounts,
  getVehicleKmFloor,
  searchJobs,
  setJobArchived,
  setJobStatus,
  updateJob,
} from "./actions";

const VEHICLE = "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const CLIENT = "7a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const SERVICE = "8a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ITEM = "9a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JOB = "aa1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const LIST_ROW = {
  id: JOB,
  number: 123,
  vehicle_id: VEHICLE,
  client_id: null,
  appointment_id: null,
  status: "pendiente",
  observations: null,
  kilometers: null,
  quoted_total: 0,
  final_total: null,
  enabled: true,
  created_at: "2026-10-13T15:00:00+00:00",
  updated_at: "2026-10-13T15:00:00+00:00",
  plate: "AE482KD",
  vehicle_year: 2021,
  brand_name: "Fiat",
  model_name: "Cronos",
  vehicle_enabled: true,
  client_name: null,
  client_surname: null,
  client_phone_number: null,
  client_enabled: null,
  appointment_date: null,
  appointment_time: null,
  appointment_enabled: null,
};

const ITEM_INPUT = { serviceId: SERVICE, quantity: "2", quotedUnitPrice: "12500,50", finalUnitPrice: "" };

// The vehicle's owner, as the view returns it.
const OWNER_ROW = {
  client_id: CLIENT,
  client_name: "Ana",
  client_surname: "Gómez",
  client_phone_number: "11 1234-5678",
  client_enabled: true,
};

// A save that works: the vehicle has an active owner, the function returns the job's id, the read back finds it.
function respondOk(query: FakeQuery): FakeResult {
  if (query.table === "vehicle_decrypted") return { data: OWNER_ROW };
  if (query.table === "save_job") return { data: JOB };
  if (query.table === "job_list") return { data: LIST_ROW };
  return { data: null };
}

function setup(respond: (query: FakeQuery) => FakeResult = respondOk) {
  const fake = createFakeSupabase(respond);
  mocks.supabase = fake.supabase;
  return fake.queries;
}

function rpcArgs(queries: FakeQuery[]) {
  const call = queries.find((query) => query.table === "save_job")?.calls[0];
  return call?.[2] as Record<string, unknown>;
}

beforeEach(() => {
  mocks.revalidatePath.mockReset();
  mocks.requireSession.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createJob", () => {
  it("saves the job, its services and its status in one function call, then reads it back", async () => {
    const queries = setup();
    const result = await createJob({ vehicleId: VEHICLE, kilometers: "68.400", items: [ITEM_INPUT] });

    expect(result).toMatchObject({ ok: true, data: { id: JOB, vehicle: { plate: "AE482KD" } } });
    expect(queries.map((query) => query.table)).toEqual(["vehicle_decrypted", "save_job", "job_list"]);
    expect(rpcArgs(queries)).toEqual({
      p_job_id: null,
      p_vehicle_id: VEHICLE,
      p_client_id: CLIENT,
      p_status: "pendiente",
      p_kilometers: 68400,
      p_appointment_id: null,
      p_observations: null,
      p_quoted_total: 25001,
      p_final_total: null,
      p_items: [
        {
          id: null,
          service_id: SERVICE,
          quantity: 2,
          quoted_unit_price: 12500.5,
          final_unit_price: null,
        },
      ],
      p_new_client: null,
    });
    expect(filterValue(queries[2], "eq", "id")).toBe(JOB);
  });

  it("revalidates the jobs and the vehicles pages", async () => {
    setup();
    await createJob({ vehicleId: VEHICLE });
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual(["/trabajos", "/vehiculos", "/turnos", "/inicio"]);
  });

  describe("the client", () => {
    it("is the vehicle's owner, whatever the form says", async () => {
      const queries = setup();
      await createJob({ vehicleId: VEHICLE, clientId: "11111111-1111-4111-8111-111111111111" });
      expect(rpcArgs(queries).p_client_id).toBe(CLIENT);
      expect(filterValue(queries[0], "eq", "id")).toBe(VEHICLE);
    });

    it("is none when the vehicle has no owner", async () => {
      const queries = setup((query) =>
        query.table === "vehicle_decrypted"
          ? { data: { ...OWNER_ROW, client_id: null, client_name: null, client_enabled: null } }
          : respondOk(query),
      );
      await createJob({ vehicleId: VEHICLE, clientId: CLIENT });
      expect(rpcArgs(queries).p_client_id).toBeNull();
    });

    it("is none when the owner is archived: an archived client can't be put on a new job", async () => {
      const queries = setup((query) =>
        query.table === "vehicle_decrypted" ? { data: { ...OWNER_ROW, client_enabled: false } } : respondOk(query),
      );
      await createJob({ vehicleId: VEHICLE });
      expect(rpcArgs(queries).p_client_id).toBeNull();
    });

    it("never sends a new client to the database", async () => {
      const queries = setup();
      await createJob({
        vehicleId: VEHICLE,
        newClient: { name: "Ana", surname: "", phoneNumber: "11 1234-5678", dni: "" },
      });
      expect(rpcArgs(queries).p_new_client).toBeNull();
    });

    it("fails when the owner can not be looked up", async () => {
      const queries = setup((query) => (query.table === "vehicle_decrypted" ? { error: { code: "XX000" } } : respondOk(query)));
      expect(await createJob({ vehicleId: VEHICLE })).toEqual({ ok: false, error: "unexpected" });
      expect(queries.some((query) => query.table === "save_job")).toBe(false);
    });
  });

  it("refuses an invalid form without touching the database", async () => {
    const queries = setup();
    const result = await createJob({ vehicleId: "", items: [{ ...ITEM_INPUT, serviceId: "" }] });
    expect(result).toMatchObject({ ok: false, error: "invalid", fieldErrors: { vehicleId: "vehicleRequired" } });
    expect(queries).toHaveLength(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();

    const items = await createJob({ vehicleId: VEHICLE, items: [{ ...ITEM_INPUT, serviceId: "" }] });
    expect(items).toMatchObject({ ok: false, fieldErrors: { "items.0.serviceId": "serviceRequired" } });
  });

  it("refuses a work-phase job whose services have no final price", async () => {
    const queries = setup();
    const result = await createJob({ vehicleId: VEHICLE, status: "en_progreso", items: [ITEM_INPUT] });
    expect(result).toMatchObject({ ok: false, fieldErrors: { "items.0.finalUnitPrice": "priceRequired" } });
    expect(queries).toHaveLength(0);
  });

  describe("prices by phase", () => {
    it("saves the final prices and both totals in the work phase", async () => {
      const queries = setup();
      await createJob({
        vehicleId: VEHICLE,
        status: "en_progreso",
        items: [{ ...ITEM_INPUT, quantity: "1", quotedUnitPrice: "100", finalUnitPrice: "120,50" }],
      });
      const args = rpcArgs(queries);
      expect(args).toMatchObject({ p_quoted_total: 100, p_final_total: 120.5 });
      expect(args.p_items).toMatchObject([{ quoted_unit_price: 100, final_unit_price: 120.5 }]);
    });

    it("drops the final prices in the quote phase, even if the client sent them", async () => {
      const queries = setup();
      await createJob({
        vehicleId: VEHICLE,
        status: "presupuesto_enviado",
        items: [{ ...ITEM_INPUT, finalUnitPrice: "999" }],
      });
      const args = rpcArgs(queries);
      expect(args.p_final_total).toBeNull();
      expect(args.p_items).toMatchObject([{ final_unit_price: null }]);
    });

    it("cancels a new job in the quote phase, with no final prices", async () => {
      const queries = setup();
      await createJob({ vehicleId: VEHICLE, status: "cancelado", items: [{ ...ITEM_INPUT, finalUnitPrice: "999" }] });
      const args = rpcArgs(queries);
      expect(args).toMatchObject({ p_status: "cancelado", p_final_total: null });
    });
  });

  describe("what the database says", () => {
    function failWith(error: { code?: string; message?: string }) {
      setup((query) => (query.table === "save_job" ? { error: { code: "23514", ...error } } : respondOk(query)));
    }

    it("maps a km below the previous jobs to the km field", async () => {
      failWith({ message: "job_kilometers_below_previous" });
      expect(await createJob({ vehicleId: VEHICLE, kilometers: "100" })).toEqual({
        ok: false,
        error: "kmBelowPrevious",
        fieldErrors: { kilometers: "kmBelowPrevious" },
      });
    });

    it("maps an archived vehicle and an archived client to their fields", async () => {
      failWith({ message: "vehicle_archived" });
      expect(await createJob({ vehicleId: VEHICLE })).toMatchObject({
        error: "vehicleArchived",
        fieldErrors: { vehicleId: "vehicleArchived" },
      });
      failWith({ message: "client_archived" });
      expect(await createJob({ vehicleId: VEHICLE, clientId: CLIENT })).toMatchObject({
        error: "clientArchived",
        fieldErrors: { clientId: "clientArchived" },
      });
    });

    it("maps an archived service and a closed job to form-level errors", async () => {
      failWith({ message: "service_archived" });
      expect(await createJob({ vehicleId: VEHICLE })).toEqual({ ok: false, error: "serviceArchived" });
      failWith({ message: "job_closed" });
      expect(await createJob({ vehicleId: VEHICLE })).toEqual({ ok: false, error: "closed" });
    });

    it("says a job or item that is not there was not found", async () => {
      failWith({ code: "P0002", message: "job_not_found" });
      expect(await createJob({ vehicleId: VEHICLE })).toEqual({ ok: false, error: "notFound" });
      failWith({ code: "P0002", message: "job_item_not_found" });
      expect(await createJob({ vehicleId: VEHICLE })).toEqual({ ok: false, error: "notFound" });
    });

    it("maps a row of another shop to invalid, and anything else to unexpected", async () => {
      failWith({ code: "23503", message: "violates foreign key" });
      expect(await createJob({ vehicleId: VEHICLE })).toEqual({ ok: false, error: "invalid" });
      failWith({ code: "XX000", message: "boom" });
      expect(await createJob({ vehicleId: VEHICLE })).toEqual({ ok: false, error: "unexpected" });
    });

    it("never revalidates after a failure", async () => {
      failWith({ message: "job_closed" });
      await createJob({ vehicleId: VEHICLE });
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("fails when the saved job can not be read back", async () => {
      setup((query) => (query.table === "job_list" ? { data: null } : respondOk(query)));
      expect(await createJob({ vehicleId: VEHICLE })).toEqual({ ok: false, error: "notFound" });
      setup((query) => (query.table === "job_list" ? { error: { code: "XX000" } } : respondOk(query)));
      expect(await createJob({ vehicleId: VEHICLE })).toEqual({ ok: false, error: "unexpected" });
    });
  });
});

describe("updateJob", () => {
  // The saved job: open, with a service that has no final price yet.
  function respondStored(
    overrides: { status?: string; finalPrice?: number | null; missing?: boolean; clientId?: string | null } = {},
  ) {
    return (query: FakeQuery): FakeResult => {
      if (query.table === "job") {
        return {
          data: overrides.missing
            ? null
            : { id: JOB, status: overrides.status ?? "pendiente", client_id: overrides.clientId ?? null },
        };
      }
      if (query.table === "job_item") return { data: [{ final_unit_price: overrides.finalPrice ?? null }] };
      return respondOk(query);
    };
  }

  it("saves the job by its id, sending the saved items' ids", async () => {
    const queries = setup(respondStored());
    const result = await updateJob(JOB, { vehicleId: VEHICLE, items: [{ ...ITEM_INPUT, id: ITEM }] });

    expect(result).toMatchObject({ ok: true });
    expect(queries.map((query) => query.table)).toEqual(["job", "job_item", "vehicle_decrypted", "save_job", "job_list"]);
    const args = rpcArgs(queries);
    expect(args.p_job_id).toBe(JOB);
    expect(args.p_items).toMatchObject([{ id: ITEM }]);
  });

  it("keeps an archived owner on a job that already has it", async () => {
    const queries = setup((query) =>
      query.table === "vehicle_decrypted"
        ? { data: { ...OWNER_ROW, client_enabled: false } }
        : respondStored({ clientId: CLIENT })(query),
    );
    await updateJob(JOB, { vehicleId: VEHICLE });
    expect(rpcArgs(queries).p_client_id).toBe(CLIENT);
  });

  it("drops an archived owner the job did not have", async () => {
    const queries = setup((query) =>
      query.table === "vehicle_decrypted"
        ? { data: { ...OWNER_ROW, client_enabled: false } }
        : respondStored({ clientId: null })(query),
    );
    await updateJob(JOB, { vehicleId: VEHICLE });
    expect(rpcArgs(queries).p_client_id).toBeNull();
  });

  it("says the job was not found without saving", async () => {
    const queries = setup(respondStored({ missing: true }));
    expect(await updateJob(JOB, { vehicleId: VEHICLE })).toEqual({ ok: false, error: "notFound" });
    expect(queries.some((query) => query.table === "save_job")).toBe(false);
  });

  it.each([["entregado"], ["cancelado"]])("refuses a job that is already %s, before doing any work", async (status) => {
    const queries = setup(respondStored({ status }));
    expect(await updateJob(JOB, { vehicleId: VEHICLE })).toEqual({ ok: false, error: "closed" });
    expect(queries.some((query) => query.table === "save_job")).toBe(false);
  });

  it("refuses an id that is not a uuid or an invalid form without querying", async () => {
    const queries = setup(respondStored());
    expect(await updateJob("nope", { vehicleId: VEHICLE })).toEqual({ ok: false, error: "notFound" });
    expect(await updateJob(JOB, { vehicleId: "" })).toMatchObject({ ok: false, error: "invalid" });
    expect(queries).toHaveLength(0);
  });

  it("clears the final prices when the job goes back to the quote phase", async () => {
    const queries = setup(respondStored({ status: "en_progreso", finalPrice: 150 }));
    await updateJob(JOB, {
      vehicleId: VEHICLE,
      status: "presupuesto_aceptado",
      items: [{ ...ITEM_INPUT, id: ITEM, finalUnitPrice: "150" }],
    });
    const args = rpcArgs(queries);
    expect(args.p_final_total).toBeNull();
    expect(args.p_items).toMatchObject([{ final_unit_price: null }]);
  });

  it("keeps the final prices of a job cancelled from the work phase", async () => {
    const queries = setup(respondStored({ status: "en_progreso", finalPrice: 150 }));
    await updateJob(JOB, {
      vehicleId: VEHICLE,
      status: "cancelado",
      items: [{ ...ITEM_INPUT, id: ITEM, quotedUnitPrice: "100", quantity: "1", finalUnitPrice: "150" }],
    });
    const args = rpcArgs(queries);
    expect(args).toMatchObject({ p_status: "cancelado", p_quoted_total: 100, p_final_total: 150 });
  });

  it("cancels a job from the quote phase without final prices", async () => {
    const queries = setup(respondStored({ status: "presupuesto_enviado", finalPrice: null }));
    await updateJob(JOB, { vehicleId: VEHICLE, status: "cancelado", items: [{ ...ITEM_INPUT, id: ITEM }] });
    expect(rpcArgs(queries).p_final_total).toBeNull();
  });

  it("fills an empty final price with the quoted one when the job moves into the work phase on the server", async () => {
    // The schema requires it in the form; a final price sent as a number works the same.
    const queries = setup(respondStored());
    await updateJob(JOB, {
      vehicleId: VEHICLE,
      status: "en_progreso",
      items: [{ ...ITEM_INPUT, id: ITEM, quantity: "1", quotedUnitPrice: "100", finalUnitPrice: 100 }],
    });
    expect(rpcArgs(queries)).toMatchObject({ p_quoted_total: 100, p_final_total: 100 });
  });

  it("fails when the saved job can not be looked up", async () => {
    setup((query) => (query.table === "job" ? { error: { code: "XX000" } } : respondOk(query)));
    expect(await updateJob(JOB, { vehicleId: VEHICLE })).toEqual({ ok: false, error: "unexpected" });
    setup((query) =>
      query.table === "job" ? { data: { id: JOB, status: "pendiente" } } : { error: { code: "XX000" } },
    );
    expect(await updateJob(JOB, { vehicleId: VEHICLE })).toEqual({ ok: false, error: "unexpected" });
  });
});

describe("setJobArchived", () => {
  it("archives or unarchives the job and reads it back", async () => {
    const queries = setup((query) => (query.table === "job" ? { data: { id: JOB } } : respondOk(query)));
    expect(await setJobArchived(JOB, true)).toMatchObject({ ok: true });
    expect(queries[0].calls).toContainEqual(["update", { enabled: false }]);
    expect(filterValue(queries[0], "eq", "id")).toBe(JOB);

    await setJobArchived(JOB, false);
    expect(queries[2].calls).toContainEqual(["update", { enabled: true }]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trabajos");
  });

  it("says the job was not found", async () => {
    setup(() => ({ data: null }));
    expect(await setJobArchived(JOB, true)).toEqual({ ok: false, error: "notFound" });
    expect(await setJobArchived("nope", true)).toEqual({ ok: false, error: "notFound" });
  });

  it("fails on a database error, without revalidating", async () => {
    setup(() => ({ error: { code: "XX000" } }));
    expect(await setJobArchived(JOB, true)).toEqual({ ok: false, error: "unexpected" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("read actions", () => {
  it("searchJobs reads the list state, filters included, from the request body", async () => {
    const queries = setup(() => ({ data: [], count: 0 }));
    await searchJobs("buscar=ae482&estado=entregado&desde=2026-09-01&orden=km&sentido=desc");
    const calls = queries[0].calls;
    expect(calls).toContainEqual(["like", "search_text", "%ae482%"]);
    expect(calls).toContainEqual(["in", "status", ["entregado"]]);
    expect(calls).toContainEqual(["order", "kilometers", { ascending: false, nullsFirst: false }]);
    expect(await searchJobs(undefined)).toMatchObject({ ok: true });
  });

  it("getStatusCounts asks for the counts of the same list state", async () => {
    const queries = setup(() => ({ data: [] }));
    await getStatusCounts("buscar=ae482&archivados=1");
    expect(queries[0].calls[0]).toEqual([
      "rpc",
      "job_status_counts",
      { p_pattern: "%ae482%", p_show_archived: true, p_from: null, p_to: null },
    ]);
  });

  it.each([
    ["getJobRow", () => getJobRow("nope")],
    ["getJobDetails", () => getJobDetails(42)],
    ["getVehicleKmFloor", () => getVehicleKmFloor("nope")],
    ["getVehicleKmFloor with a bad job", () => getVehicleKmFloor(VEHICLE, "nope")],
    ["getOwnerOfVehicle", () => getOwnerOfVehicle(undefined)],
    ["getServiceOptions", () => getServiceOptions(["nope"])],
  ])("%s fails without querying when its input is not valid", async (_name, run) => {
    const queries = setup();
    expect(await run()).toEqual({ ok: false });
    expect(queries).toHaveLength(0);
  });

  it("reads with valid input", async () => {
    setup((query) => {
      if (query.table === "job_list") return { data: LIST_ROW };
      if (query.table === "vehicle_decrypted" && query.calls.some(([name]) => name === "eq")) return { data: null };
      return { data: [] };
    });
    expect(await getJobRow(JOB)).toMatchObject({ ok: true });
    expect(await getJobDetails(JOB)).toMatchObject({ ok: true });
    expect(await getVehicleKmFloor(VEHICLE)).toEqual({ ok: true, floor: null });
    expect(await getOwnerOfVehicle(VEHICLE)).toEqual({ ok: true, owner: null });
    expect(await getServiceOptions([SERVICE])).toEqual({ ok: true, rows: [] });
    expect(await getServiceOptions()).toEqual({ ok: true, rows: [] });
  });
});

describe("setJobStatus", () => {
  const ITEM_ROW = {
    id: ITEM,
    service_id: SERVICE,
    quantity: 2,
    quoted_unit_price: 100,
    final_unit_price: null,
    created_at: "2026-10-13T15:00:00+00:00",
    service: { name: "Cambio de aceite", enabled: true },
  };

  // The saved job (one service), then the save as the form does it.
  function respondSaved(overrides: { status?: string; enabled?: boolean; items?: unknown[] } = {}) {
    return (query: FakeQuery): FakeResult => {
      if (query.table === "job_list" && !query.calls.some(([name]) => name === "rpc")) {
        const isRead = query.calls.some(([name, column]) => name === "eq" && column === "id");
        if (isRead && query.calls.length < 4) {
          return { data: { ...LIST_ROW, status: overrides.status ?? "pendiente", enabled: overrides.enabled ?? true } };
        }
      }
      if (query.table === "job") {
        return { data: { id: JOB, status: overrides.status ?? "pendiente", client_id: null } };
      }
      if (query.table === "job_item") return { data: overrides.items ?? [ITEM_ROW] };
      if (query.table === "job_status_history") return { data: [] };
      return respondOk(query);
    };
  }

  it("saves the job with its saved services and only the status changed", async () => {
    const queries = setup(respondSaved());
    const result = await setJobStatus(JOB, "presupuesto_enviado");

    expect(result).toMatchObject({ ok: true });
    const args = rpcArgs(queries);
    expect(args).toMatchObject({ p_job_id: JOB, p_vehicle_id: VEHICLE, p_status: "presupuesto_enviado", p_quoted_total: 200 });
    expect(args.p_items).toMatchObject([
      { id: ITEM, service_id: SERVICE, quantity: 2, quoted_unit_price: 100, final_unit_price: null },
    ]);
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual(["/trabajos", "/vehiculos", "/turnos", "/inicio"]);
  });

  it("moving into the work phase gives every service its quoted price as the final one", async () => {
    const queries = setup(respondSaved());
    await setJobStatus(JOB, "en_progreso");
    const args = rpcArgs(queries);
    expect(args.p_items).toMatchObject([{ quoted_unit_price: 100, final_unit_price: 100 }]);
    expect(args).toMatchObject({ p_quoted_total: 200, p_final_total: 200 });
  });

  it("moving back to the quote phase clears the final prices and the final total", async () => {
    const queries = setup(respondSaved({ status: "en_progreso", items: [{ ...ITEM_ROW, final_unit_price: 150 }] }));
    await setJobStatus(JOB, "presupuesto_aceptado");
    const args = rpcArgs(queries);
    expect(args.p_items).toMatchObject([{ final_unit_price: null }]);
    expect(args.p_final_total).toBeNull();
  });

  it("works for a job without services", async () => {
    const queries = setup(respondSaved({ items: [] }));
    expect(await setJobStatus(JOB, "completado")).toMatchObject({ ok: true });
    expect(rpcArgs(queries).p_items).toEqual([]);
  });

  it("refuses a closed job without saving", async () => {
    const queries = setup(respondSaved({ status: "entregado" }));
    expect(await setJobStatus(JOB, "pendiente")).toEqual({ ok: false, error: "closed" });
    expect(queries.some((query) => query.table === "save_job")).toBe(false);
  });

  it("refuses an archived job without saving", async () => {
    const queries = setup(respondSaved({ enabled: false }));
    expect(await setJobStatus(JOB, "completado")).toEqual({ ok: false, error: "invalid" });
    expect(queries.some((query) => query.table === "save_job")).toBe(false);
  });

  it.each([
    ["nope", "pendiente"],
    [JOB, "confirmado"],
    [JOB, undefined],
    [JOB, 3],
  ])("refuses %j with %j without touching the database", async (id, status) => {
    const queries = setup(respondSaved());
    expect(await setJobStatus(id, status)).toMatchObject({ ok: false });
    expect(queries.some((query) => query.table === "save_job")).toBe(false);
  });

  it("maps a database rule to its message", async () => {
    setup((query) =>
      query.table === "save_job" ? { error: { code: "23514", message: "job_closed" } } : respondSaved()(query),
    );
    expect(await setJobStatus(JOB, "completado")).toEqual({ ok: false, error: "closed" });
  });
});
