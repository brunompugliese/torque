import { describe, expect, it } from "vitest";

import { JOB_HISTORY_COLUMNS, jobRowSchema } from "./schemas";

const ROW = {
  id: "j1",
  status: "en_progreso",
  kilometers: 112500,
  quoted_total: 605000,
  final_total: null,
  enabled: true,
  created_at: "2026-10-13T15:00:00+00:00",
  job_item: [],
};

describe("jobRowSchema", () => {
  it("renames the columns the app uses", () => {
    expect(jobRowSchema.parse(ROW)).toEqual({
      id: "j1",
      status: "en_progreso",
      kilometers: 112500,
      quotedTotal: 605000,
      finalTotal: null,
      enabled: true,
      createdAt: "2026-10-13T15:00:00+00:00",
      services: [],
    });
  });

  it("lists the service names in the order they were added to the job", () => {
    const row = jobRowSchema.parse({
      ...ROW,
      job_item: [
        { created_at: "2026-10-13T15:00:02+00:00", service: { name: "Alineación" } },
        { created_at: "2026-10-13T15:00:01+00:00", service: { name: "Cambio de aceite" } },
        { created_at: "2026-10-13T15:00:03+00:00", service: null },
      ],
    });
    expect(row.services).toEqual(["Cambio de aceite", "Alineación"]);
  });

  it("accepts amounts as numbers or as strings, and a job without km or totals", () => {
    const row = jobRowSchema.parse({ ...ROW, kilometers: null, quoted_total: "12500.50", final_total: 15000 });
    expect(row).toMatchObject({ kilometers: null, quotedTotal: 12500.5, finalTotal: 15000 });
    expect(jobRowSchema.parse({ ...ROW, quoted_total: null })).toMatchObject({ quotedTotal: null });
  });

  it("rejects a status the app doesn't know", () => {
    expect(jobRowSchema.safeParse({ ...ROW, status: "confirmado" }).success).toBe(false);
  });

  it("selects only what the history needs, never the encrypted observations", () => {
    expect(JOB_HISTORY_COLUMNS).toBe(
      "id, status, kilometers, quoted_total, final_total, enabled, created_at, job_item(created_at, service(name))",
    );
    expect(JOB_HISTORY_COLUMNS).not.toContain("observations");
  });
});
