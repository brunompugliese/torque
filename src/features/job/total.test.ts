import { describe, expect, it } from "vitest";

import { jobTotal } from "./total";

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
