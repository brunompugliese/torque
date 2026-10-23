import { describe, expect, it } from "vitest";

import { calculateTotals, fillFinalPrices, jobTotal } from "./total";

describe("jobTotal", () => {
  it("is the final total, labelled final, when the job has one", () => {
    expect(jobTotal({ finalTotal: 650000, quotedTotal: 605000 })).toEqual({ amount: 650000, kind: "final" });
  });

  it("is the quoted total otherwise", () => {
    expect(jobTotal({ finalTotal: null, quotedTotal: 605000 })).toEqual({ amount: 605000, kind: "quoted" });
  });

  it("keeps a final total of zero", () => {
    expect(jobTotal({ finalTotal: 0, quotedTotal: 605000 })).toEqual({ amount: 0, kind: "final" });
  });

  it("is nothing when the job has no total", () => {
    expect(jobTotal({ finalTotal: null, quotedTotal: null })).toBeNull();
  });
});

describe("calculateTotals", () => {
  const items = [
    { quantity: 2, quotedUnitPrice: 12500.5, finalUnitPrice: 13000 },
    { quantity: 1, quotedUnitPrice: 605000, finalUnitPrice: null },
  ];

  it("has only the quoted total in the quote phase", () => {
    expect(calculateTotals(items, "quote")).toEqual({ quoted: 630001, final: null });
  });

  it("adds the final total in the work phase, a missing final price counting as the quoted one", () => {
    expect(calculateTotals(items, "work")).toEqual({ quoted: 630001, final: 631000 });
  });

  it("keeps decimals exact", () => {
    expect(calculateTotals([{ quantity: 3, quotedUnitPrice: 12.1, finalUnitPrice: null }], "quote").quoted).toBe(36.3);
  });

  it("is zero without items", () => {
    expect(calculateTotals([], "quote")).toEqual({ quoted: 0, final: null });
    expect(calculateTotals([], "work")).toEqual({ quoted: 0, final: 0 });
  });
});

describe("fillFinalPrices", () => {
  it("copies the quoted price into the empty final prices only", () => {
    const rows = [
      { key: "a", quotedUnitPrice: "100", finalUnitPrice: "" },
      { key: "b", quotedUnitPrice: "200", finalUnitPrice: "250" },
      { key: "c", quotedUnitPrice: "300,50", finalUnitPrice: "  " },
    ];
    expect(fillFinalPrices(rows).map((row) => row.finalUnitPrice)).toEqual(["100", "250", "300,50"]);
  });
});
