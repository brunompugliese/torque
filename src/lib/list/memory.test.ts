import { describe, expect, it } from "vitest";

import { filterByText, paginate } from "./memory";

const VEHICLES = [
  { plate: "AB123CD", name: "Fiat Cronos" },
  { plate: "ZZ999ZZ", name: "Volkswagen Gol" },
  { plate: "AE482KD", name: "Peugeot 208" },
];

const text = (vehicle: (typeof VEHICLES)[number]) => `${vehicle.plate} ${vehicle.name}`;

describe("filterByText", () => {
  it("returns everything, in order, for an empty or punctuation-only term", () => {
    expect(filterByText(VEHICLES, "", text)).toEqual(VEHICLES);
    expect(filterByText(VEHICLES, " - . ", text)).toEqual(VEHICLES);
  });

  it("ignores case, accents, spaces, dots and dashes", () => {
    expect(filterByText(VEHICLES, "ab 123-cd", text)).toEqual([VEHICLES[0]]);
    expect(filterByText(VEHICLES, "VOLKSWAGEN", text)).toEqual([VEHICLES[1]]);
    expect(filterByText([{ plate: "X", name: "Citroën" }], "citroen", text)).toHaveLength(1);
  });

  it("matches inside the text and keeps the original order", () => {
    expect(filterByText(VEHICLES, "k", text).map((vehicle) => vehicle.plate)).toEqual(["ZZ999ZZ", "AE482KD"]);
  });

  it("returns nothing when no item matches and doesn't change the input", () => {
    const copy = [...VEHICLES];
    expect(filterByText(VEHICLES, "renault", text)).toEqual([]);
    expect(VEHICLES).toEqual(copy);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 12 }, (_, index) => index + 1);

  it("slices the page", () => {
    expect(paginate(items, 1, 5)).toEqual({ rows: [1, 2, 3, 4, 5], page: 1, pages: 3, total: 12 });
    expect(paginate(items, 3, 5)).toEqual({ rows: [11, 12], page: 3, pages: 3, total: 12 });
  });

  it("keeps the page inside the range", () => {
    expect(paginate(items, 9, 5).page).toBe(3);
    expect(paginate(items, 0, 5).page).toBe(1);
    expect(paginate(items, Number.NaN, 5).page).toBe(1);
  });

  it("handles an empty list", () => {
    expect(paginate([], 1, 5)).toEqual({ rows: [], page: 1, pages: 1, total: 0 });
  });
});
