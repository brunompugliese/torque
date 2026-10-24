import { describe, expect, it } from "vitest";

import { formatJobLabel, formatJobVehicle } from "./format";

const vehicle = { id: "v1", plate: "AE482KD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true };

describe("formatJobLabel", () => {
  it("is the spaced plate and the vehicle", () => {
    expect(formatJobLabel({ vehicle })).toBe("AE 482 KD, Fiat Cronos");
  });
});

describe("formatJobVehicle", () => {
  it("is brand, model and year", () => {
    expect(formatJobVehicle({ vehicle })).toBe("Fiat Cronos 2021");
  });

  it("leaves the year out when there is none", () => {
    expect(formatJobVehicle({ vehicle: { ...vehicle, year: null } })).toBe("Fiat Cronos");
  });
});
