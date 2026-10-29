import { describe, expect, it } from "vitest";

import { emptyJobForm, emptyJobRow, isJobUnchanged, jobClientId, jobToFormState, rowAmounts } from "./form";
import { jobFormSchema, type JobItem, type JobListItem } from "./schemas";

const JOB: JobListItem = {
  id: "j1",
  number: 123,
  status: "en_progreso",
  observations: "Ruido en la rueda",
  kilometers: 68400,
  quotedTotal: 25001,
  finalTotal: 26000,
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
  updatedAt: "2026-10-14T15:00:00+00:00",
  vehicle: { id: "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b", plate: "AB123CD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
  client: { id: "7a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b", name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
  appointment: { id: "8a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b", date: "2026-10-20", time: "09:00", enabled: true },
};
const ITEMS: JobItem[] = [
  {
    id: "9a1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    serviceId: "aa1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    serviceName: "Cambio de aceite",
    serviceEnabled: true,
    quantity: 2,
    quotedUnitPrice: 12500.5,
    finalUnitPrice: 13000,
    createdAt: "2026-10-13T15:00:00+00:00",
  },
];

describe("emptyJobForm", () => {
  it("starts a new job as Pendiente with nothing else chosen", () => {
    expect(emptyJobForm()).toEqual({
      vehicleId: "",
      clientId: "",
      status: "pendiente",
      kilometers: "",
      appointmentId: "",
      observations: "",
      items: [],
    });
  });

  it("starts a new row with quantity 1 and nothing else", () => {
    expect(emptyJobRow()).toEqual({
      id: "",
      serviceId: "",
      quantity: "1",
      quotedUnitPrice: "",
      finalUnitPrice: "",
    });
  });
});

describe("jobToFormState", () => {
  it("fills the form with the saved job, km with dot thousands and prices with a comma", () => {
    expect(jobToFormState(JOB, ITEMS)).toEqual({
      vehicleId: JOB.vehicle.id,
      clientId: JOB.client!.id,
      status: "en_progreso",
      kilometers: "68.400",
      appointmentId: JOB.appointment!.id,
      observations: "Ruido en la rueda",
      items: [
        {
          id: ITEMS[0].id,
          serviceId: ITEMS[0].serviceId,
          quantity: "2",
          quotedUnitPrice: "12500,5",
          finalUnitPrice: "13000",
        },
      ],
    });
  });

  it("leaves empty what the job does not have", () => {
    const state = jobToFormState(
      { ...JOB, kilometers: null, observations: null, client: null, appointment: null },
      [{ ...ITEMS[0], finalUnitPrice: null }],
    );
    expect(state).toMatchObject({ kilometers: "", observations: "", clientId: "", appointmentId: "" });
    expect(state.items[0].finalUnitPrice).toBe("");
  });

  it("is a form the schema accepts as it is", () => {
    expect(jobFormSchema.safeParse(jobToFormState(JOB, ITEMS)).success).toBe(true);
  });
});

describe("isJobUnchanged", () => {
  const values = () => {
    const parsed = jobFormSchema.safeParse(jobToFormState(JOB, ITEMS));
    if (!parsed.success) throw new Error("fixture is invalid");
    return parsed.data;
  };

  it("is true for the form as loaded", () => {
    expect(isJobUnchanged(values(), JOB, ITEMS)).toBe(true);
  });

  it("ignores spaces around the observations", () => {
    expect(isJobUnchanged({ ...values(), observations: "Ruido en la rueda" }, { ...JOB, observations: " Ruido en la rueda " }, ITEMS)).toBe(true);
  });

  it.each([
    ["the status", { status: "completado" as const }],
    ["the kilometers", { kilometers: 70000 }],
    ["the client", { clientId: null }],
    ["the appointment", { appointmentId: null }],
    ["the observations", { observations: null }],
    ["the vehicle", { vehicleId: "bb1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b" }],
  ])("is false when %s changed", (_name, change) => {
    expect(isJobUnchanged({ ...values(), ...change }, JOB, ITEMS)).toBe(false);
  });

  it("is false when a service row changed, was added or was removed", () => {
    const base = values();
    expect(isJobUnchanged({ ...base, items: [{ ...base.items[0], quantity: 3 }] }, JOB, ITEMS)).toBe(false);
    expect(isJobUnchanged({ ...base, items: [{ ...base.items[0], quotedUnitPrice: 1 }] }, JOB, ITEMS)).toBe(false);
    expect(isJobUnchanged({ ...base, items: [{ ...base.items[0], finalUnitPrice: 1 }] }, JOB, ITEMS)).toBe(false);
    expect(isJobUnchanged({ ...base, items: [{ ...base.items[0], serviceId: "cc1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b" }] }, JOB, ITEMS)).toBe(false);
    expect(isJobUnchanged({ ...base, items: [...base.items, { ...base.items[0], id: null }] }, JOB, ITEMS)).toBe(false);
    expect(isJobUnchanged({ ...base, items: [] }, JOB, ITEMS)).toBe(false);
  });
});

describe("jobClientId", () => {
  const active = { id: "c1", enabled: true };
  const archived = { id: "c1", enabled: false };

  it("is the vehicle's owner", () => {
    expect(jobClientId(active, null)).toBe("c1");
    expect(jobClientId(active, "c2")).toBe("c1");
  });

  it("is none when the vehicle has no owner", () => {
    expect(jobClientId(null, null)).toBeNull();
    expect(jobClientId(null, "c1")).toBeNull();
  });

  it("is none for an archived owner: it can't be put on a job", () => {
    expect(jobClientId(archived, null)).toBeNull();
    expect(jobClientId(archived, "c2")).toBeNull();
  });

  it("keeps an archived owner on a job that already has it", () => {
    expect(jobClientId(archived, "c1")).toBe("c1");
  });
});

describe("rowAmounts", () => {
  it("reads typed rows into numbers, a missing final price staying empty", () => {
    expect(
      rowAmounts([
        { ...emptyJobRow(), quantity: "2", quotedUnitPrice: "12500,50", finalUnitPrice: "13000" },
        { ...emptyJobRow(), quantity: "1", quotedUnitPrice: "100", finalUnitPrice: "" },
      ]),
    ).toEqual([
      { quantity: 2, quotedUnitPrice: 12500.5, finalUnitPrice: 13000 },
      { quantity: 1, quotedUnitPrice: 100, finalUnitPrice: null },
    ]);
  });

  it("counts what can not be read yet as zero", () => {
    expect(rowAmounts([{ ...emptyJobRow(), quantity: "", quotedUnitPrice: "12,", finalUnitPrice: "x" }])).toEqual([
      { quantity: 0, quotedUnitPrice: 0, finalUnitPrice: null },
    ]);
  });
});
