import { afterEach, describe, expect, it, vi } from "vitest";

import {
  VEHICLE_COLUMNS,
  VEHICLE_LIST_COLUMNS,
  catalogOptionSchema,
  clientIdSchema,
  toVehicleFieldErrors,
  vehicleFormSchema,
  vehicleIdsSchema,
  vehicleListRowSchema,
  vehicleRowSchema,
} from "./schemas";

const ID = "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const OTHER_ID = "7a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

describe("vehicleRowSchema", () => {
  const row = { id: "v1", plate: "AB123CD", brand_name: "Fiat", model_name: "Cronos", year: 2021, vin: null, enabled: true };

  it("maps a view row to the vehicle the app uses", () => {
    expect(vehicleRowSchema.parse(row)).toEqual({
      id: "v1",
      plate: "AB123CD",
      brandName: "Fiat",
      modelName: "Cronos",
      year: 2021,
      vin: null,
      enabled: true,
    });
  });

  it("accepts a vehicle without year", () => {
    expect(vehicleRowSchema.parse({ ...row, year: null }).year).toBeNull();
  });

  it("rejects a row without a plate", () => {
    expect(() => vehicleRowSchema.parse({ ...row, plate: null })).toThrow();
  });

  it("selects exactly the columns the schema reads", () => {
    expect(VEHICLE_COLUMNS.split(", ").sort()).toEqual(Object.keys(row).sort());
  });
});

describe("clientIdSchema", () => {
  it("accepts a uuid only", () => {
    expect(clientIdSchema.safeParse(ID).success).toBe(true);
    expect(clientIdSchema.safeParse("nope").success).toBe(false);
    expect(clientIdSchema.safeParse(undefined).success).toBe(false);
  });
});

describe("vehicleIdsSchema", () => {
  it("needs at least one uuid", () => {
    expect(vehicleIdsSchema.safeParse([]).success).toBe(false);
    expect(vehicleIdsSchema.safeParse(["nope"]).success).toBe(false);
    expect(vehicleIdsSchema.safeParse(ID).success).toBe(false);
  });

  it("counts a repeated vehicle once", () => {
    expect(vehicleIdsSchema.parse([ID, OTHER_ID, ID])).toEqual([ID, OTHER_ID]);
  });
});

describe("vehicleListRowSchema", () => {
  const row = {
    id: "v1",
    plate: "AB123CD",
    brand_id: "b1",
    model_id: "m1",
    brand_name: "Fiat",
    model_name: "Cronos",
    year: 2021,
    vin: "8AP359A1XMU123456",
    enabled: true,
    created_at: "2026-10-13T15:00:00+00:00",
    client_id: "c1",
    client_name: "Ana",
    client_surname: "Gómez",
    client_phone_number: "11 1234-5678",
    client_enabled: true,
    last_km: 112500,
  };

  it("maps a view row to the vehicle with its client and last km", () => {
    expect(vehicleListRowSchema.parse(row)).toEqual({
      id: "v1",
      plate: "AB123CD",
      brandId: "b1",
      modelId: "m1",
      brandName: "Fiat",
      modelName: "Cronos",
      year: 2021,
      vin: "8AP359A1XMU123456",
      enabled: true,
      createdAt: "2026-10-13T15:00:00+00:00",
      lastKm: 112500,
      client: { id: "c1", name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
    });
  });

  it("has no client when the vehicle has none", () => {
    const parsed = vehicleListRowSchema.parse({
      ...row,
      client_id: null,
      client_name: null,
      client_surname: null,
      client_phone_number: null,
      client_enabled: null,
    });
    expect(parsed.client).toBeNull();
  });

  it("knows an archived client and a client without surname", () => {
    const parsed = vehicleListRowSchema.parse({ ...row, client_surname: null, client_enabled: false });
    expect(parsed.client).toMatchObject({ surname: null, enabled: false });
  });

  it("accepts a vehicle without year, VIN or km", () => {
    expect(vehicleListRowSchema.parse({ ...row, year: null, vin: null, last_km: null })).toMatchObject({
      year: null,
      vin: null,
      lastKm: null,
    });
  });

  it("rejects a row without a plate", () => {
    expect(() => vehicleListRowSchema.parse({ ...row, plate: null })).toThrow();
  });

  it("selects exactly the columns the schema reads", () => {
    expect(VEHICLE_LIST_COLUMNS.split(", ").sort()).toEqual(Object.keys(row).sort());
  });
});

describe("vehicleFormSchema", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const BRAND = "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
  const MODEL = "7a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
  const input = { plate: "ab 123 cd", year: "2021", brandId: BRAND, modelId: MODEL, vin: "", clientId: "", newClient: null };

  it("tidies every field the way it is stored", () => {
    expect(
      vehicleFormSchema.parse({ ...input, vin: " 8ap359a1xmu-123456 ", clientId: ID }),
    ).toEqual({
      plate: "AB123CD",
      year: 2021,
      brandId: BRAND,
      modelId: MODEL,
      vin: "8AP359A1XMU123456",
      clientId: ID,
      newClient: null,
    });
  });

  it("makes the optional fields null when empty or missing", () => {
    expect(vehicleFormSchema.parse({ plate: "AB123CD", brandId: BRAND, modelId: MODEL })).toMatchObject({
      year: null,
      vin: null,
      clientId: null,
      newClient: null,
    });
    expect(vehicleFormSchema.parse({ ...input, year: "" })).toMatchObject({ year: null, clientId: null });
  });

  it("reports what is missing or wrong, with the message keys the form translates", () => {
    const result = vehicleFormSchema.safeParse({ plate: "", year: "1800", brandId: "", modelId: "", vin: "123", clientId: "nope" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toVehicleFieldErrors(result.error)).toMatchObject({
      plate: "plateRequired",
      year: "yearInvalid",
      brandId: "brandRequired",
      modelId: "modelRequired",
      vin: "vinInvalid",
    });
    expect(toVehicleFieldErrors(result.error)).toHaveProperty("clientId");
  });

  it("takes a new client with the client form's rules, without email", () => {
    const parsed = vehicleFormSchema.parse({
      ...input,
      newClient: { name: " Ana  ", surname: "", phoneNumber: "1112345678", dni: "28.456.123" },
    });
    expect(parsed.newClient).toEqual({ name: "Ana", surname: null, phoneNumber: "11 1234-5678", dni: "28456123" });
  });

  it("names the new client's field that is wrong", () => {
    const result = vehicleFormSchema.safeParse({
      ...input,
      newClient: { name: " ", surname: "", phoneNumber: "11", dni: "abc" },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toVehicleFieldErrors(result.error)).toEqual({
      "newClient.name": "nameRequired",
      "newClient.phoneNumber": "phoneInvalid",
      "newClient.dni": "dniInvalid",
    });
  });

  it("refuses an existing client and a new one together", () => {
    const result = vehicleFormSchema.safeParse({
      ...input,
      clientId: ID,
      newClient: { name: "Ana", surname: "", phoneNumber: "1112345678", dni: "" },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(Object.keys(toVehicleFieldErrors(result.error))).toEqual(["newClient"]);
  });

  it("checks the year against next year at the time of the save", () => {
    vi.useFakeTimers({ now: new Date("2026-10-21T12:00:00Z") });
    expect(vehicleFormSchema.safeParse({ ...input, year: "2027" }).success).toBe(true);
    expect(vehicleFormSchema.safeParse({ ...input, year: "2028" }).success).toBe(false);
  });
});

describe("toVehicleFieldErrors", () => {
  it("keeps the first message of each field", () => {
    const result = vehicleFormSchema.safeParse({ plate: "A", brandId: "", modelId: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toVehicleFieldErrors(result.error).plate).toBe("plateInvalid");
  });
});

describe("catalogOptionSchema", () => {
  it("reads a brand or model's id and name", () => {
    expect(catalogOptionSchema.parse({ id: "b1", name: "Fiat" })).toEqual({ id: "b1", name: "Fiat" });
    expect(catalogOptionSchema.safeParse({ id: "b1" }).success).toBe(false);
  });
});
