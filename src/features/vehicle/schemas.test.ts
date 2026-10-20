import { describe, expect, it } from "vitest";

import { VEHICLE_COLUMNS, clientIdSchema, vehicleIdsSchema, vehicleRowSchema } from "./schemas";

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
