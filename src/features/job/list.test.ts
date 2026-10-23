import { describe, expect, it } from "vitest";

import { JOB_DEFAULT_SORT, JOB_SORT_COLUMNS, jobFiltersToParams, parseJobFilters } from "./list";

describe("job list constants", () => {
  it("sorts by the last update by default, and every default is a real column", () => {
    expect(Object.keys(JOB_SORT_COLUMNS)).toContain(JOB_DEFAULT_SORT);
    expect(Object.keys(JOB_SORT_COLUMNS)).toHaveLength(7);
  });
});

describe("parseJobFilters", () => {
  it("is empty without filters", () => {
    expect(parseJobFilters({})).toEqual({ statuses: [], from: null, to: null });
  });

  it("reads statuses in their order, whatever order the URL has", () => {
    expect(parseJobFilters({ estado: "cancelado,pendiente,en_progreso" }).statuses).toEqual([
      "pendiente",
      "en_progreso",
      "cancelado",
    ]);
  });

  it("drops unknown and repeated statuses", () => {
    expect(parseJobFilters({ estado: "pendiente,nada,pendiente,confirmado" }).statuses).toEqual(["pendiente"]);
  });

  it("reads the days", () => {
    expect(parseJobFilters({ desde: "2026-09-01", hasta: "2026-09-30" })).toMatchObject({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("allows one bound alone and the same day on both", () => {
    expect(parseJobFilters({ desde: "2026-09-01" })).toMatchObject({ from: "2026-09-01", to: null });
    expect(parseJobFilters({ hasta: "2026-09-30" })).toMatchObject({ from: null, to: "2026-09-30" });
    expect(parseJobFilters({ desde: "2026-09-10", hasta: "2026-09-10" })).toMatchObject({
      from: "2026-09-10",
      to: "2026-09-10",
    });
  });

  it("drops impossible days", () => {
    expect(parseJobFilters({ desde: "2026-02-30", hasta: "ayer" })).toMatchObject({ from: null, to: null });
  });

  it("drops a range in the wrong order, keeping the statuses", () => {
    expect(parseJobFilters({ estado: "entregado", desde: "2026-09-30", hasta: "2026-09-01" })).toEqual({
      statuses: ["entregado"],
      from: null,
      to: null,
    });
  });
});

describe("jobFiltersToParams", () => {
  it("writes only the filters that are set", () => {
    expect(jobFiltersToParams({ statuses: ["pendiente", "entregado"], from: "2026-09-01", to: null })).toEqual({
      estado: "pendiente,entregado",
      desde: "2026-09-01",
      hasta: undefined,
    });
  });

  it("clears everything for no filters", () => {
    expect(jobFiltersToParams({ statuses: [], from: null, to: null })).toEqual({
      estado: undefined,
      desde: undefined,
      hasta: undefined,
    });
  });
});
