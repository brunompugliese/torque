import { describe, expect, it } from "vitest";

import { JOB_STATUSES, isClosedStatus, isJobStatus, jobPhase, jobStatusFamily } from "./status";

describe("job statuses", () => {
  it("lists the seven statuses in display order", () => {
    expect(JOB_STATUSES).toEqual([
      "pendiente",
      "presupuesto_enviado",
      "presupuesto_aceptado",
      "en_progreso",
      "completado",
      "entregado",
      "cancelado",
    ]);
  });

  it.each([
    ["pendiente", "pending"],
    ["presupuesto_enviado", "quote-sent"],
    ["presupuesto_aceptado", "quote-accepted"],
    ["en_progreso", "in-progress"],
    ["completado", "done"],
    ["entregado", "delivered"],
    ["cancelado", "cancelled"],
  ] as const)("maps %s to the %s family", (status, family) => {
    expect(jobStatusFamily(status)).toBe(family);
  });

  it("tells a job status from any other text", () => {
    expect(isJobStatus("en_progreso")).toBe(true);
    expect(isJobStatus("confirmado")).toBe(false);
    expect(isJobStatus("")).toBe(false);
  });
});

describe("closed statuses", () => {
  it("are Entregado and Cancelado only", () => {
    expect(JOB_STATUSES.filter(isClosedStatus)).toEqual(["entregado", "cancelado"]);
  });
});

describe("jobPhase", () => {
  it.each([["pendiente"], ["presupuesto_enviado"], ["presupuesto_aceptado"]] as const)(
    "%s is the quote phase",
    (status) => {
      expect(jobPhase(status, false)).toBe("quote");
      expect(jobPhase(status, true)).toBe("quote");
    },
  );

  it.each([["en_progreso"], ["completado"], ["entregado"]] as const)("%s is the work phase", (status) => {
    expect(jobPhase(status, false)).toBe("work");
  });

  it("keeps the phase a cancelled job was in", () => {
    expect(jobPhase("cancelado", true)).toBe("work");
    expect(jobPhase("cancelado", false)).toBe("quote");
  });
});
