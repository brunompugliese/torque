import { describe, expect, it } from "vitest";

import {
  HOME_CLOSED_STATUSES,
  HOME_OPEN_STATUSES,
  homeClosedFrom,
  homeMixedFilterExpression,
  homeStatusFilter,
} from "./home";

const FROM = "2026-09-26T03:00:00.000Z";

describe("home statuses", () => {
  it("splits the seven statuses into five open and two closed", () => {
    expect(HOME_OPEN_STATUSES).toEqual([
      "pendiente",
      "presupuesto_enviado",
      "presupuesto_aceptado",
      "en_progreso",
      "completado",
    ]);
    expect(HOME_CLOSED_STATUSES).toEqual(["entregado", "cancelado"]);
  });
});

describe("homeClosedFrom", () => {
  it("starts the day 29 days before today, at Argentina midnight (30 days with today)", () => {
    expect(homeClosedFrom("2026-10-25")).toBe(FROM);
  });

  it("crosses month and year ends", () => {
    expect(homeClosedFrom("2026-01-15")).toBe("2025-12-17T03:00:00.000Z");
    expect(homeClosedFrom("2026-03-01")).toBe("2026-01-31T03:00:00.000Z");
  });
});

describe("homeStatusFilter", () => {
  it("lists the open statuses, any age, when nothing is ticked", () => {
    expect(homeStatusFilter([], FROM)).toEqual({ kind: "in", statuses: [...HOME_OPEN_STATUSES] });
  });

  it("lists only the ticked open statuses, any age", () => {
    expect(homeStatusFilter(["pendiente", "en_progreso"], FROM)).toEqual({
      kind: "in",
      statuses: ["pendiente", "en_progreso"],
    });
  });

  it("limits the ticked closed statuses to the window", () => {
    expect(homeStatusFilter(["entregado"], FROM)).toEqual({ kind: "closed-window", statuses: ["entregado"], from: FROM });
  });

  it("mixes open statuses of any age with closed ones in the window", () => {
    const filter = homeStatusFilter(["pendiente", "cancelado", "entregado"], FROM);
    expect(filter).toEqual({ kind: "mixed", open: ["pendiente"], closed: ["cancelado", "entregado"], from: FROM });
    if (filter.kind !== "mixed") throw new Error("expected mixed");
    expect(homeMixedFilterExpression(filter)).toBe(
      `status.in.(pendiente),and(status.in.(cancelado,entregado),updated_at.gte.${FROM})`,
    );
  });
});
