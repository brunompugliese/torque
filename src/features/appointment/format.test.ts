import { describe, expect, it } from "vitest";

import { formatAppointmentLabel, formatAppointmentVehicle, formatAppointmentWhen } from "./format";

const APPOINTMENT = {
  date: "2026-10-14",
  time: "09:00",
  vehicle: { brandName: "Fiat", modelName: "Cronos", year: 2021 as number | null },
};

describe("appointment formats", () => {
  it("names the vehicle with its year", () => {
    expect(formatAppointmentVehicle(APPOINTMENT)).toBe("Fiat Cronos 2021");
    expect(formatAppointmentVehicle({ vehicle: { ...APPOINTMENT.vehicle, year: null } })).toBe("Fiat Cronos");
  });

  it("titles the modal with the date and the time", () => {
    expect(formatAppointmentWhen(APPOINTMENT)).toBe("14/10/2026 · 09:00 hs");
  });

  it("says what a toast needs", () => {
    expect(formatAppointmentLabel(APPOINTMENT)).toBe("Fiat Cronos, 14/10/2026 a las 09:00 hs");
  });
});
