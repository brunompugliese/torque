import { describe, expect, it } from "vitest";

import { appointmentClientId, appointmentToFormState, emptyAppointmentForm, isAppointmentUnchanged } from "./form";
import type { AppointmentFormValues, AppointmentListItem } from "./schemas";

const APPOINTMENT: AppointmentListItem = {
  id: "a1",
  date: "2026-10-14",
  time: "09:00",
  reason: "Ruido al frenar",
  status: "confirmado",
  createdAt: "2026-10-13T15:00:00+00:00",
  vehicle: { id: "v1", plate: "AE482KD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
  client: { id: "c1", name: "Martín", surname: null, phoneNumber: "11 5555-0101", enabled: true },
  jobId: null,
};

const VALUES: AppointmentFormValues = {
  vehicleId: "v1",
  date: "2026-10-14",
  time: "09:00",
  status: "confirmado",
  reason: "Ruido al frenar",
};

describe("emptyAppointmentForm", () => {
  it("starts Pendiente on the given day with no time", () => {
    expect(emptyAppointmentForm("2026-10-20")).toEqual({
      vehicleId: "",
      date: "2026-10-20",
      time: "",
      status: "pendiente",
      reason: "",
    });
  });
});

describe("appointmentToFormState", () => {
  it("prefills the form from the appointment", () => {
    expect(appointmentToFormState(APPOINTMENT)).toEqual({
      vehicleId: "v1",
      date: "2026-10-14",
      time: "09:00",
      status: "confirmado",
      reason: "Ruido al frenar",
    });
    expect(appointmentToFormState({ ...APPOINTMENT, reason: null }).reason).toBe("");
  });
});

describe("isAppointmentUnchanged", () => {
  it("is true when nothing changed", () => {
    expect(isAppointmentUnchanged(VALUES, APPOINTMENT)).toBe(true);
    expect(isAppointmentUnchanged({ ...VALUES, reason: null }, { ...APPOINTMENT, reason: null })).toBe(true);
  });

  it.each([
    ["vehicle", { vehicleId: "v2" }],
    ["date", { date: "2026-10-15" }],
    ["time", { time: "09:15" }],
    ["status", { status: "cancelado" as const }],
    ["reason", { reason: "Otro" }],
  ])("is false when the %s changed", (_name, patch) => {
    expect(isAppointmentUnchanged({ ...VALUES, ...patch }, APPOINTMENT)).toBe(false);
  });
});

describe("appointmentClientId", () => {
  it("is the vehicle's owner for a new appointment", () => {
    expect(appointmentClientId(null, "v1", "owner")).toBe("owner");
    expect(appointmentClientId(null, "v1", null)).toBeNull();
  });

  it("keeps the stored client while the vehicle is the same, even if its owner changed", () => {
    expect(appointmentClientId({ vehicleId: "v1", clientId: "old" }, "v1", "new-owner")).toBe("old");
    expect(appointmentClientId({ vehicleId: "v1", clientId: null }, "v1", "new-owner")).toBeNull();
  });

  it("follows the new vehicle's owner when the vehicle changes", () => {
    expect(appointmentClientId({ vehicleId: "v1", clientId: "old" }, "v2", "owner2")).toBe("owner2");
    expect(appointmentClientId({ vehicleId: "v1", clientId: "old" }, "v2", null)).toBeNull();
  });
});
