import { describe, expect, it } from "vitest";

import { JOB_STATUSES, isJobStatus, jobStatusFamily } from "./status";

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
