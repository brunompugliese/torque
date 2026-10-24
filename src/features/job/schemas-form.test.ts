import { describe, expect, it } from "vitest";

import {
  jobFormSchema,
  jobHistoryEntrySchema,
  jobItemRowSchema,
  jobListRowSchema,
  toJobFieldErrors,
} from "./schemas";

const VEHICLE = "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const CLIENT = "7a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const SERVICE = "8a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ITEM = "9a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const ITEM_INPUT = { serviceId: SERVICE, quantity: "2", quotedUnitPrice: "12500,50", finalUnitPrice: "" };

function parse(input: Record<string, unknown>) {
  return jobFormSchema.safeParse({ vehicleId: VEHICLE, ...input });
}

function errors(input: Record<string, unknown>) {
  const result = parse(input);
  return result.success ? {} : toJobFieldErrors(result.error);
}

describe("jobFormSchema", () => {
  it("accepts the smallest job: a vehicle, Pendiente, no services", () => {
    const result = parse({});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      vehicleId: VEHICLE,
      clientId: null,
      status: "pendiente",
      kilometers: null,
      appointmentId: null,
      observations: null,
      items: [],
    });
  });

  it("turns typed text into values", () => {
    const result = parse({
      clientId: CLIENT,
      status: "presupuesto_enviado",
      kilometers: "68.400",
      observations: "  Ruido en la rueda \n ",
      items: [ITEM_INPUT],
    });
    expect(result.data).toMatchObject({
      clientId: CLIENT,
      status: "presupuesto_enviado",
      kilometers: 68400,
      observations: "Ruido en la rueda",
      items: [{ serviceId: SERVICE, quantity: 2, quotedUnitPrice: 12500.5, finalUnitPrice: null }],
    });
  });

  it("asks for the vehicle", () => {
    expect(errors({ vehicleId: "" }).vehicleId).toBe("vehicleRequired");
    expect(errors({ vehicleId: undefined }).vehicleId).toBe("vehicleRequired");
  });

  it("treats an empty client and appointment as none", () => {
    expect(parse({ clientId: "", appointmentId: "" }).data).toMatchObject({ clientId: null, appointmentId: null });
  });

  it("rejects a kilometers value that is not a whole number", () => {
    expect(errors({ kilometers: "12,5" }).kilometers).toBe("kilometersInvalid");
  });

  it("rejects an unknown status", () => {
    expect(parse({ status: "confirmado" }).success).toBe(false);
  });

  describe("services", () => {
    it("needs a service on every row", () => {
      expect(errors({ items: [{ ...ITEM_INPUT, serviceId: "" }] })["items.0.serviceId"]).toBe("serviceRequired");
    });

    it("asks for the price, accepts zero and rejects a malformed one", () => {
      expect(errors({ items: [{ ...ITEM_INPUT, quotedUnitPrice: "" }] })["items.0.quotedUnitPrice"]).toBe("priceRequired");
      expect(errors({ items: [{ ...ITEM_INPUT, quotedUnitPrice: "12.500" }] })["items.0.quotedUnitPrice"]).toBe(
        "priceInvalid",
      );
      expect(parse({ items: [{ ...ITEM_INPUT, quotedUnitPrice: "0" }] }).data?.items[0].quotedUnitPrice).toBe(0);
    });

    it("rejects a quantity below one", () => {
      expect(errors({ items: [{ ...ITEM_INPUT, quantity: "0" }] })["items.0.quantity"]).toBe("quantityInvalid");
    });

    it("keeps the id of a saved row", () => {
      expect(parse({ items: [{ ...ITEM_INPUT, id: ITEM }] }).data?.items[0].id).toBe(ITEM);
      expect(parse({ items: [ITEM_INPUT] }).data?.items[0].id).toBeNull();
    });

    it("reports errors per row", () => {
      const found = errors({ items: [ITEM_INPUT, { ...ITEM_INPUT, serviceId: "" }, { ...ITEM_INPUT, quotedUnitPrice: "" }] });
      expect(found["items.0.serviceId"]).toBeUndefined();
      expect(found["items.1.serviceId"]).toBe("serviceRequired");
      expect(found["items.2.quotedUnitPrice"]).toBe("priceRequired");
    });
  });

  describe("final prices", () => {
    it("are not required in the quote phase", () => {
      expect(parse({ status: "presupuesto_aceptado", items: [ITEM_INPUT] }).success).toBe(true);
    });

    it.each([["en_progreso"], ["completado"], ["entregado"]])("are required in the work phase (%s)", (status) => {
      expect(errors({ status, items: [ITEM_INPUT] })["items.0.finalUnitPrice"]).toBe("priceRequired");
      expect(parse({ status, items: [{ ...ITEM_INPUT, finalUnitPrice: "13000" }] }).data?.items[0].finalUnitPrice).toBe(
        13000,
      );
    });

    it("allow zero", () => {
      expect(parse({ status: "en_progreso", items: [{ ...ITEM_INPUT, finalUnitPrice: "0" }] }).success).toBe(true);
    });

    it("are not required to cancel a job", () => {
      expect(parse({ status: "cancelado", items: [ITEM_INPUT] }).success).toBe(true);
    });

    it("reject a malformed price", () => {
      expect(errors({ items: [{ ...ITEM_INPUT, finalUnitPrice: "abc" }] })["items.0.finalUnitPrice"]).toBe("priceInvalid");
    });
  });
});

describe("jobListRowSchema", () => {
  const ROW = {
    id: "j1",
    vehicle_id: VEHICLE,
    client_id: CLIENT,
    appointment_id: "a1",
    status: "en_progreso",
    observations: "Ruido",
    kilometers: 120000,
    quoted_total: "60000",
    final_total: 65000.5,
    enabled: true,
    created_at: "2026-10-13T15:00:00+00:00",
    updated_at: "2026-10-14T15:00:00+00:00",
    plate: "AE482KD",
    vehicle_year: 2021,
    brand_name: "Fiat",
    model_name: "Cronos",
    vehicle_enabled: true,
    client_name: "Martín",
    client_surname: "Suárez",
    client_phone_number: "11 5555-0101",
    client_enabled: true,
    appointment_date: "2026-10-13",
    appointment_time: "09:00:00",
    appointment_enabled: true,
  };

  it("groups the vehicle, the client and the appointment, with numeric totals", () => {
    expect(jobListRowSchema.parse(ROW)).toEqual({
      id: "j1",
      status: "en_progreso",
      observations: "Ruido",
      kilometers: 120000,
      quotedTotal: 60000,
      finalTotal: 65000.5,
      enabled: true,
      createdAt: "2026-10-13T15:00:00+00:00",
      updatedAt: "2026-10-14T15:00:00+00:00",
      vehicle: { id: VEHICLE, plate: "AE482KD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
      client: { id: CLIENT, name: "Martín", surname: "Suárez", phoneNumber: "11 5555-0101", enabled: true },
      appointment: { id: "a1", date: "2026-10-13", time: "09:00", enabled: true },
    });
  });

  it("has no client or appointment when the job has none", () => {
    const row = jobListRowSchema.parse({
      ...ROW,
      client_id: null,
      client_name: null,
      client_surname: null,
      client_phone_number: null,
      client_enabled: null,
      appointment_id: null,
      appointment_date: null,
      appointment_time: null,
      appointment_enabled: null,
      quoted_total: null,
      final_total: null,
    });
    expect(row.client).toBeNull();
    expect(row.appointment).toBeNull();
    expect(row.quotedTotal).toBeNull();
    expect(row.finalTotal).toBeNull();
  });

  it("keeps an archived client as archived", () => {
    expect(jobListRowSchema.parse({ ...ROW, client_enabled: false }).client?.enabled).toBe(false);
  });
});

describe("jobItemRowSchema", () => {
  it("reads numeric strings and the service's name and state", () => {
    expect(
      jobItemRowSchema.parse({
        id: ITEM,
        service_id: SERVICE,
        quantity: "2",
        quoted_unit_price: "12500.50",
        final_unit_price: null,
        created_at: "2026-10-13T15:00:00+00:00",
        service: { name: "Cambio de aceite", enabled: false },
      }),
    ).toEqual({
      id: ITEM,
      serviceId: SERVICE,
      serviceName: "Cambio de aceite",
      serviceEnabled: false,
      quantity: 2,
      quotedUnitPrice: 12500.5,
      finalUnitPrice: null,
      createdAt: "2026-10-13T15:00:00+00:00",
    });
  });
});

describe("jobHistoryEntrySchema", () => {
  it("reads the user's name from the profile, and a creation has no previous status", () => {
    expect(
      jobHistoryEntrySchema.parse({
        id: "h1",
        old_status: null,
        new_status: "pendiente",
        changed_at: "2026-10-13T15:00:00+00:00",
        profile: { full_name: "Usuario A" },
      }),
    ).toEqual({
      id: "h1",
      oldStatus: null,
      newStatus: "pendiente",
      changedAt: "2026-10-13T15:00:00+00:00",
      changedBy: "Usuario A",
    });
  });

  it("allows an entry without a user", () => {
    expect(
      jobHistoryEntrySchema.parse({
        id: "h2",
        old_status: "pendiente",
        new_status: "entregado",
        changed_at: "2026-10-14T15:00:00+00:00",
        profile: null,
      }).changedBy,
    ).toBeNull();
  });
});
