import { describe, expect, it } from "vitest";

import {
  appointmentFormSchema,
  appointmentListRowSchema,
  toAppointmentFieldErrors,
} from "./schemas";

const VEHICLE = "aa1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const ROW = {
  id: "a1",
  vehicle_id: VEHICLE,
  client_id: "c1",
  date: "2026-10-14",
  time: "09:00:00",
  reason: "Ruido al frenar",
  status: "confirmado",
  enabled: true,
  created_at: "2026-10-13T15:00:00+00:00",
  plate: "AE482KD",
  vehicle_year: 2021,
  brand_name: "Fiat",
  model_name: "Cronos",
  vehicle_enabled: true,
  client_name: "Martín",
  client_surname: "Suárez",
  client_phone_number: "11 5555-0101",
  client_enabled: true,
  job_id: null,
};

describe("appointmentListRowSchema", () => {
  it("shapes the vehicle, the client and the time", () => {
    expect(appointmentListRowSchema.parse(ROW)).toEqual({
      id: "a1",
      date: "2026-10-14",
      time: "09:00",
      reason: "Ruido al frenar",
      status: "confirmado",
      createdAt: "2026-10-13T15:00:00+00:00",
      vehicle: { id: VEHICLE, plate: "AE482KD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
      client: { id: "c1", name: "Martín", surname: "Suárez", phoneNumber: "11 5555-0101", enabled: true },
      jobId: null,
    });
  });

  it("has no client when the appointment has none", () => {
    const row = appointmentListRowSchema.parse({
      ...ROW,
      client_id: null,
      client_name: null,
      client_surname: null,
      client_phone_number: null,
      client_enabled: null,
    });
    expect(row.client).toBeNull();
  });

  it("keeps the job and an archived client", () => {
    const row = appointmentListRowSchema.parse({ ...ROW, job_id: "j1", client_enabled: false });
    expect(row.jobId).toBe("j1");
    expect(row.client?.enabled).toBe(false);
  });

  it("rejects a status that is not an appointment's", () => {
    expect(appointmentListRowSchema.safeParse({ ...ROW, status: "en_progreso" }).success).toBe(false);
  });
});

describe("appointmentFormSchema", () => {
  const VALID = { vehicleId: VEHICLE, date: "2026-10-14", time: "09:15", reason: "  Ruido al frenar  " };

  it("accepts a valid appointment, trims the reason and starts as Pendiente", () => {
    expect(appointmentFormSchema.parse(VALID)).toEqual({
      vehicleId: VEHICLE,
      date: "2026-10-14",
      time: "09:15",
      status: "pendiente",
      reason: "Ruido al frenar",
    });
  });

  it.each(["00:00", "09:07", "13:59", "23:59"])("accepts any hour and minute, like %s", (time) => {
    expect(appointmentFormSchema.parse({ ...VALID, time }).time).toBe(time);
  });

  it("stores an empty reason as null", () => {
    expect(appointmentFormSchema.parse({ ...VALID, reason: "   " }).reason).toBeNull();
    expect(appointmentFormSchema.parse({ ...VALID, reason: undefined }).reason).toBeNull();
  });

  it("takes the status an edit sends", () => {
    expect(appointmentFormSchema.parse({ ...VALID, status: "cancelado" }).status).toBe("cancelado");
    expect(appointmentFormSchema.safeParse({ ...VALID, status: "entregado" }).success).toBe(false);
  });

  it.each([
    ["no vehicle", { vehicleId: "" }, "vehicleId", "vehicleRequired"],
    ["a vehicle that is not an id", { vehicleId: "nope" }, "vehicleId", "vehicleRequired"],
    ["no date", { date: "" }, "date", "dateRequired"],
    ["a date that does not exist", { date: "2026-02-30" }, "date", "dateRequired"],
    ["no time", { time: "" }, "time", "timeRequired"],
    ["a time that is not a time", { time: "tarde" }, "time", "timeRequired"],
  ] as const)("rejects %s", (_name, patch, field, key) => {
    const result = appointmentFormSchema.safeParse({ ...VALID, ...patch });
    expect(result.success).toBe(false);
    if (!result.success) expect(toAppointmentFieldErrors(result.error)[field]).toBe(key);
  });

  it("reports a missing field", () => {
    const result = appointmentFormSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toAppointmentFieldErrors(result.error)).toMatchObject({
        vehicleId: "vehicleRequired",
        date: "dateRequired",
        time: "timeRequired",
      });
    }
  });
});
