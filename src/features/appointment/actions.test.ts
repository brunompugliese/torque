import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeSupabase, filterValue, type FakeQuery, type FakeResult } from "@/test/supabase";

const mocks = vi.hoisted(() => ({
  supabase: null as unknown,
  revalidatePath: vi.fn(),
  requireSession: vi.fn(async () => ({ userId: "u1", shopId: "shop-a" })),
  getVehicleOwner: vi.fn(),
  getKmFloor: vi.fn(),
  createJob: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ supabase: mocks.supabase }),
}));
vi.mock("@/lib/auth/session", () => ({ requireSession: mocks.requireSession }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/job/queries", () => ({
  getVehicleOwner: mocks.getVehicleOwner,
  getKmFloor: mocks.getKmFloor,
}));
vi.mock("@/features/job/actions", () => ({ createJob: mocks.createJob }));

import {
  createAppointment,
  createJobFromAppointment,
  searchAppointments,
  setAppointmentStatus,
  updateAppointment,
} from "./actions";

const APPOINTMENT = "aa1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const VEHICLE = "bb1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const OTHER_VEHICLE = "bc1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const OWNER = "cc1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const STORED_CLIENT = "cd1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const LIST_ROW = {
  id: APPOINTMENT,
  vehicle_id: VEHICLE,
  client_id: OWNER,
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

const VALID = { vehicleId: VEHICLE, date: "2026-10-14", time: "09:00", reason: "Ruido al frenar" };

function setup(respond: (query: FakeQuery) => FakeResult) {
  const fake = createFakeSupabase(respond);
  mocks.supabase = fake.supabase;
  return fake.queries;
}

// Writes answer with the id; reads of the list view answer with the row.
function writes(overrides: Partial<typeof LIST_ROW> = {}, stored: unknown = { vehicle_id: VEHICLE, client_id: STORED_CLIENT }) {
  return (query: FakeQuery): FakeResult => {
    if (query.table === "appointment_list") return { data: { ...LIST_ROW, ...overrides } };
    if (query.operation === "select") return { data: stored };
    return { data: { id: APPOINTMENT } };
  };
}

beforeEach(() => {
  mocks.revalidatePath.mockReset();
  mocks.requireSession.mockClear();
  mocks.getVehicleOwner.mockReset();
  mocks.getVehicleOwner.mockResolvedValue({ ok: true, owner: { id: OWNER, enabled: true } });
  mocks.getKmFloor.mockReset();
  mocks.getKmFloor.mockResolvedValue({ ok: true, floor: 68400 });
  mocks.createJob.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("searchAppointments", () => {
  it("reads a valid range", async () => {
    const queries = setup(() => ({ data: [] }));
    expect(await searchAppointments("2026-09-28", "2026-11-01")).toEqual({ ok: true, rows: [] });
    expect(filterValue(queries[0], "gte", "date")).toBe("2026-09-28");
  });

  it.each([
    ["not text", 42, "2026-11-01"],
    ["not days", "ayer", "hoy"],
    ["a day that does not exist", "2026-02-30", "2026-03-10"],
    ["an end before the start", "2026-11-01", "2026-10-01"],
    ["a range that is not a calendar's", "2026-01-01", "2027-01-01"],
  ])("fails without querying for %s", async (_name, from, to) => {
    const queries = setup(() => ({ data: [] }));
    expect(await searchAppointments(from, to)).toEqual({ ok: false });
    expect(queries).toHaveLength(0);
  });
});

describe("createAppointment", () => {
  it("inserts a Pendiente appointment with the vehicle's owner as client and reads it back", async () => {
    const queries = setup(writes());
    const result = await createAppointment(VALID);

    expect(result).toMatchObject({ ok: true, data: { id: APPOINTMENT, time: "09:00" } });
    expect(queries[0]).toMatchObject({ table: "appointment", operation: "insert" });
    expect(queries[0].calls[0]).toEqual([
      "insert",
      {
        shop_id: "shop-a",
        vehicle_id: VEHICLE,
        client_id: OWNER,
        date: "2026-10-14",
        time: "09:00",
        reason: "Ruido al frenar",
        status: "pendiente",
      },
    ]);
    expect(queries[1].table).toBe("appointment_list");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/turnos");
  });

  it("ignores a status or a client the form sends", async () => {
    const queries = setup(writes());
    await createAppointment({ ...VALID, status: "completado", clientId: "otro" });
    expect(queries[0].calls[0][1]).toMatchObject({ status: "pendiente", client_id: OWNER });
  });

  it("has no client when the vehicle has no owner", async () => {
    mocks.getVehicleOwner.mockResolvedValue({ ok: true, owner: null });
    const queries = setup(writes());
    await createAppointment(VALID);
    expect(queries[0].calls[0][1]).toMatchObject({ client_id: null });
  });

  it("keeps an archived owner as the client (the database only checks the vehicle)", async () => {
    mocks.getVehicleOwner.mockResolvedValue({ ok: true, owner: { id: OWNER, enabled: false } });
    const queries = setup(writes());
    await createAppointment(VALID);
    expect(queries[0].calls[0][1]).toMatchObject({ client_id: OWNER });
  });

  it("returns the field errors of an invalid form without touching the database", async () => {
    const queries = setup(writes());
    const result = await createAppointment({ ...VALID, vehicleId: "", time: "" });
    expect(result).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { vehicleId: "vehicleRequired", time: "timeRequired" },
    });
    expect(queries).toHaveLength(0);
  });

  it("maps an archived vehicle to a field error", async () => {
    setup(() => ({ error: { code: "23514", message: "vehicle_archived" } }));
    expect(await createAppointment(VALID)).toEqual({
      ok: false,
      error: "vehicleArchived",
      fieldErrors: { vehicleId: "vehicleArchived" },
    });
  });

  it("maps another shop's vehicle (foreign key) to invalid", async () => {
    setup(() => ({ error: { code: "23503", message: "fk" } }));
    expect(await createAppointment(VALID)).toEqual({ ok: false, error: "invalid" });
  });

  it("reports anything else as unexpected, logging only the code", async () => {
    setup(() => ({ error: { code: "XX000", message: "boom with a name: Martín" } }));
    expect(await createAppointment(VALID)).toEqual({ ok: false, error: "unexpected" });
    expect(console.error).toHaveBeenCalledWith("[appointment] write failed", { code: "XX000" });
  });

  it("is unexpected when the owner can't be looked up", async () => {
    mocks.getVehicleOwner.mockResolvedValue({ ok: false });
    setup(writes());
    expect(await createAppointment(VALID)).toEqual({ ok: false, error: "unexpected" });
  });
});

describe("updateAppointment", () => {
  it("keeps the stored client while the vehicle is the same", async () => {
    const queries = setup(writes());
    const result = await updateAppointment(APPOINTMENT, { ...VALID, status: "confirmado" });

    expect(result.ok).toBe(true);
    const update = queries.find((query) => query.operation === "update");
    expect(update?.calls[0]).toEqual([
      "update",
      {
        vehicle_id: VEHICLE,
        client_id: STORED_CLIENT,
        date: "2026-10-14",
        time: "09:00",
        reason: "Ruido al frenar",
        status: "confirmado",
      },
    ]);
    expect(filterValue(update!, "eq", "id")).toBe(APPOINTMENT);
  });

  it("follows the new vehicle's owner when the vehicle changes", async () => {
    const queries = setup(writes());
    await updateAppointment(APPOINTMENT, { ...VALID, vehicleId: OTHER_VEHICLE });
    const update = queries.find((query) => query.operation === "update");
    expect(update?.calls[0][1]).toMatchObject({ vehicle_id: OTHER_VEHICLE, client_id: OWNER });
  });

  it("fails when the appointment does not exist", async () => {
    setup(writes({}, null));
    expect(await updateAppointment(APPOINTMENT, VALID)).toEqual({ ok: false, error: "notFound" });
  });

  it("fails on a bad id or form without querying", async () => {
    const queries = setup(writes());
    expect(await updateAppointment("nope", VALID)).toEqual({ ok: false, error: "notFound" });
    expect(await updateAppointment(APPOINTMENT, { ...VALID, date: "" })).toMatchObject({ ok: false, error: "invalid" });
    expect(queries).toHaveLength(0);
  });

  it("maps an archived vehicle", async () => {
    setup((query) =>
      query.operation === "select" ? { data: { vehicle_id: VEHICLE, client_id: null } } : { error: { code: "23514", message: "vehicle_archived" } },
    );
    expect(await updateAppointment(APPOINTMENT, VALID)).toMatchObject({ ok: false, error: "vehicleArchived" });
  });
});

describe("setAppointmentStatus", () => {
  it("changes only the status and reads the row back", async () => {
    const queries = setup(writes({ status: "cancelado" }));
    const result = await setAppointmentStatus(APPOINTMENT, "cancelado");

    expect(result).toMatchObject({ ok: true, data: { status: "cancelado" } });
    expect(queries[0].calls[0]).toEqual(["update", { status: "cancelado" }]);
    expect(filterValue(queries[0], "eq", "id")).toBe(APPOINTMENT);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/turnos");
  });

  it.each([
    ["a bad id", "nope", "confirmado", "notFound"],
    ["a job status", APPOINTMENT, "en_progreso", "invalid"],
    ["something that is not text", APPOINTMENT, 7, "invalid"],
  ])("fails without querying for %s", async (_name, id, status, error) => {
    const queries = setup(writes());
    expect(await setAppointmentStatus(id, status)).toEqual({ ok: false, error });
    expect(queries).toHaveLength(0);
  });

  it("fails when the appointment does not exist", async () => {
    setup(() => ({ data: null }));
    expect(await setAppointmentStatus(APPOINTMENT, "confirmado")).toEqual({ ok: false, error: "notFound" });
  });
});

describe("createJobFromAppointment", () => {
  const JOB = { ok: true, data: { id: "j1" } };

  it("creates the job with what the appointment knows", async () => {
    mocks.createJob.mockResolvedValue(JOB);
    setup(() => ({ data: LIST_ROW }));

    expect(await createJobFromAppointment(APPOINTMENT)).toEqual(JOB);
    expect(mocks.createJob).toHaveBeenCalledWith({
      vehicleId: VEHICLE,
      status: "pendiente",
      kilometers: 68400,
      appointmentId: APPOINTMENT,
      observations: "Ruido al frenar",
      items: [],
    });
    expect(mocks.getKmFloor).toHaveBeenCalledWith(VEHICLE);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/turnos");
  });

  it("leaves the km empty when the vehicle has none, and the observations when there is no reason", async () => {
    mocks.createJob.mockResolvedValue(JOB);
    mocks.getKmFloor.mockResolvedValue({ ok: true, floor: null });
    setup(() => ({ data: { ...LIST_ROW, reason: null } }));

    await createJobFromAppointment(APPOINTMENT);
    expect(mocks.createJob).toHaveBeenCalledWith(expect.objectContaining({ kilometers: null, observations: null }));
  });

  it("refuses a cancelled appointment", async () => {
    setup(() => ({ data: { ...LIST_ROW, status: "cancelado" } }));
    expect(await createJobFromAppointment(APPOINTMENT)).toEqual({ ok: false, error: "cancelled" });
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it("refuses an archived vehicle", async () => {
    setup(() => ({ data: { ...LIST_ROW, vehicle_enabled: false } }));
    expect(await createJobFromAppointment(APPOINTMENT)).toEqual({ ok: false, error: "vehicleArchived" });
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it("fails on a bad id or an appointment that does not exist", async () => {
    setup(() => ({ data: null }));
    expect(await createJobFromAppointment("nope")).toEqual({ ok: false, error: "notFound" });
    expect(await createJobFromAppointment(APPOINTMENT)).toEqual({ ok: false, error: "notFound" });
  });

  it("is unexpected when the km can't be read", async () => {
    mocks.getKmFloor.mockResolvedValue({ ok: false });
    setup(() => ({ data: LIST_ROW }));
    expect(await createJobFromAppointment(APPOINTMENT)).toEqual({ ok: false, error: "unexpected" });
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it("returns the job's own failure and doesn't revalidate", async () => {
    mocks.createJob.mockResolvedValue({ ok: false, error: "kmBelowPrevious" });
    setup(() => ({ data: LIST_ROW }));
    expect(await createJobFromAppointment(APPOINTMENT)).toEqual({ ok: false, error: "kmBelowPrevious" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
