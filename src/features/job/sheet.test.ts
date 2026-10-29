import { describe, expect, it } from "vitest";

import type { Shop } from "@/features/shop/types";

import type { JobItem, JobListItem } from "./schemas";
import { buildSheet } from "./sheet";

const JOB: JobListItem = {
  id: "j1",
  number: 123,
  status: "en_progreso",
  observations: "Pidió aceite 5W30",
  kilometers: 112500,
  quotedTotal: 650000.5,
  finalTotal: 700000,
  enabled: true,
  createdAt: "2026-10-27T15:00:00+00:00",
  updatedAt: "2026-10-27T15:00:00+00:00",
  vehicle: { id: "v1", plate: "AB123CD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
  client: { id: "c1", name: "Juan", surname: "Pérez", phoneNumber: "11 1234-5678", enabled: true },
  appointment: null,
};

const ITEMS: JobItem[] = [
  {
    id: "i1",
    serviceId: "s1",
    serviceName: "Cambio de aceite",
    serviceEnabled: true,
    quantity: 1,
    quotedUnitPrice: 60000,
    finalUnitPrice: 65000,
    createdAt: "2026-10-27T15:00:00+00:00",
  },
  {
    id: "i2",
    serviceId: "s2",
    serviceName: "Alineación",
    serviceEnabled: false,
    quantity: 4,
    quotedUnitPrice: 10000,
    finalUnitPrice: null,
    createdAt: "2026-10-27T15:01:00+00:00",
  },
];

const SHOP: Shop = { name: "Taller Ejemplo", address: "Calle Falsa 123", phone: "1112345678", hasLogo: true };

// 28/10/2026 at 01:30 in Argentina is already the 28th in UTC; 27/10 at 22:00 there is the 28th in UTC.
const NOW = new Date("2026-10-28T01:30:00Z");

describe("buildSheet", () => {
  it("formats the number, the vehicle, the client and the kilometers", () => {
    expect(buildSheet(JOB, ITEMS, SHOP, NOW)).toMatchObject({
      number: "N° 000123",
      plate: "AB 123 CD",
      vehicle: "Fiat Cronos 2021",
      client: "Juan Pérez",
      clientPhone: "11 1234-5678",
      kilometers: "112.500 km",
    });
  });

  it("writes both dates in Argentina time", () => {
    const sheet = buildSheet({ ...JOB, createdAt: "2026-10-28T01:30:00+00:00" }, ITEMS, SHOP, NOW);
    expect(sheet.createdOn).toBe("27/10/2026");
    expect(sheet.printedOn).toBe("27/10/2026");
  });

  it("lists the services in the saved order, with their plain name, even an archived one", () => {
    expect(buildSheet(JOB, ITEMS, SHOP, NOW).services).toEqual([
      { id: "i1", name: "Cambio de aceite", quantity: 1 },
      { id: "i2", name: "Alineación", quantity: 4 },
    ]);
  });

  it("has no services for a job without them", () => {
    expect(buildSheet(JOB, [], SHOP, NOW).services).toEqual([]);
  });

  it("carries no price, status or observation of the job", () => {
    const text = JSON.stringify(buildSheet(JOB, ITEMS, SHOP, NOW));
    for (const leaked of ["650000", "700000", "60000", "65000", "10000", "en_progreso", "Pidió aceite"]) {
      expect(text).not.toContain(leaked);
    }
  });

  it("leaves missing values empty for the sheet to word", () => {
    const sheet = buildSheet({ ...JOB, client: null, kilometers: null }, [], SHOP, NOW);
    expect(sheet).toMatchObject({ client: null, clientPhone: null, kilometers: null });
    expect(buildSheet({ ...JOB, client: { ...JOB.client!, phoneNumber: "  " } }, [], SHOP, NOW).clientPhone).toBeNull();
  });

  it("shows the shop's data, spacing an Argentine phone and keeping any other as typed", () => {
    expect(buildSheet(JOB, [], SHOP, NOW).shop).toEqual({
      name: "Taller Ejemplo",
      address: "Calle Falsa 123",
      phone: "11 1234-5678",
      hasLogo: true,
    });
    expect(buildSheet(JOB, [], { ...SHOP, phone: "+54 9 11 5555-0101" }, NOW).shop.phone).toBe("+54 9 11 5555-0101");
  });

  it("leaves out a missing address and phone, and works without a shop", () => {
    expect(buildSheet(JOB, [], { ...SHOP, address: null, phone: null, hasLogo: false }, NOW).shop).toEqual({
      name: "Taller Ejemplo",
      address: null,
      phone: null,
      hasLogo: false,
    });
    expect(buildSheet(JOB, [], null, NOW).shop).toEqual({ name: null, address: null, phone: null, hasLogo: false });
  });
});
