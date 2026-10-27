import { describe, expect, it } from "vitest";

import messages from "../../../messages/es.json";
import { archivedEntities, buildQuoteMessage, quoteAvailability, type QuoteTemplates } from "./quote";
import type { JobItem, JobListItem } from "./schemas";

const JOB: JobListItem = {
  id: "j1",
  status: "presupuesto_enviado",
  observations: null,
  kilometers: null,
  quotedTotal: 605000,
  finalTotal: null,
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
  updatedAt: "2026-10-14T15:00:00+00:00",
  vehicle: { id: "v1", plate: "AF107RS", year: 2022, brandName: "Toyota", modelName: "Hilux", enabled: true },
  client: { id: "c1", name: "Carolina", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
  appointment: null,
};

function item(overrides: Partial<JobItem>): JobItem {
  return {
    id: "i1",
    serviceId: "s1",
    serviceName: "Service completo",
    serviceEnabled: true,
    quantity: 1,
    quotedUnitPrice: 185000,
    finalUnitPrice: null,
    createdAt: "2026-10-13T15:00:00+00:00",
    ...overrides,
  };
}

const ITEMS = [item({ id: "i1", serviceName: "Cambio de correa de distribución", quotedUnitPrice: 420000 }), item({ id: "i2" })];

// The templates as messages/es.json defines them, with their placeholders filled.
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}
const TEMPLATES: QuoteTemplates = {
  message: (values) => fill(messages.jobs.quote.message, values),
  signature: (values) => fill(messages.jobs.quote.signature, values),
};

describe("quoteAvailability", () => {
  it.each(["pendiente", "presupuesto_enviado", "presupuesto_aceptado", "cancelado"] as const)(
    "is available for %s with a client phone and services",
    (status) => {
      expect(quoteAvailability({ ...JOB, status }, ITEMS)).toEqual({ ok: true });
    },
  );

  it.each(["en_progreso", "completado", "entregado"] as const)("is unavailable for %s", (status) => {
    expect(quoteAvailability({ ...JOB, status }, ITEMS)).toEqual({ ok: false, reason: "status" });
  });

  it("needs a client with a phone", () => {
    expect(quoteAvailability({ ...JOB, client: null }, ITEMS)).toEqual({ ok: false, reason: "client" });
    const noPhone = { ...JOB, client: { ...JOB.client!, phoneNumber: "" } };
    expect(quoteAvailability(noPhone, ITEMS)).toEqual({ ok: false, reason: "client" });
  });

  it("needs at least one service", () => {
    expect(quoteAvailability(JOB, [])).toEqual({ ok: false, reason: "services" });
  });

  it("gives the first failing reason: status, then client, then services", () => {
    expect(quoteAvailability({ ...JOB, status: "entregado", client: null }, [])).toEqual({ ok: false, reason: "status" });
    expect(quoteAvailability({ ...JOB, client: null }, [])).toEqual({ ok: false, reason: "client" });
  });

  it("is unavailable with no reason while the services load", () => {
    expect(quoteAvailability(JOB, null)).toEqual({ ok: false, reason: null });
  });
});

describe("archivedEntities", () => {
  it("is empty when nothing is archived", () => {
    expect(archivedEntities(JOB)).toEqual([]);
  });

  it("lists every archived one", () => {
    const all = {
      ...JOB,
      enabled: false,
      client: { ...JOB.client!, enabled: false },
      vehicle: { ...JOB.vehicle, enabled: false },
    };
    expect(archivedEntities(all)).toEqual(["job", "client", "vehicle"]);
    expect(archivedEntities({ ...JOB, vehicle: { ...JOB.vehicle, enabled: false } })).toEqual(["vehicle"]);
  });
});

describe("buildQuoteMessage", () => {
  it("builds the message of the spec example", () => {
    expect(buildQuoteMessage(JOB, ITEMS, "BC Motors", TEMPLATES)).toBe(
      [
        "Hola Carolina, te paso el presupuesto para tu Toyota Hilux (AF 107 RS):",
        "",
        "• Cambio de correa de distribución: $ 420.000",
        "• Service completo: $ 185.000",
        "",
        "Total: $ 605.000",
        "",
        "Cualquier duda avisanos. ¡Gracias!",
        "— BC Motors",
      ].join("\n"),
    );
  });

  it("shows the quantity only above one, with the line total", () => {
    const message = buildQuoteMessage(JOB, [item({ quantity: 3, quotedUnitPrice: 12.1 })], "BC Motors", TEMPLATES);
    expect(message).toContain("• Service completo (x3): $ 36,30");
    expect(message).toContain("Total: $ 36,30");
    expect(buildQuoteMessage(JOB, [item({ quantity: 1 })], undefined, TEMPLATES)).not.toContain("(x1)");
  });

  it("uses the quoted prices, never the final ones", () => {
    const message = buildQuoteMessage(JOB, [item({ quotedUnitPrice: 1000, finalUnitPrice: 9999 })], "BC Motors", TEMPLATES);
    expect(message).toContain("$ 1.000");
    expect(message).not.toContain("9.999");
  });

  it("keeps the saved order and the plain name of an archived service", () => {
    const items = [item({ id: "a", serviceName: "Zeta" }), item({ id: "b", serviceName: "Alfa", serviceEnabled: false })];
    const message = buildQuoteMessage(JOB, items, "BC Motors", TEMPLATES);
    expect(message.indexOf("Zeta")).toBeLessThan(message.indexOf("Alfa"));
    expect(message).not.toContain("Archivado");
  });

  it("leaves the signature out when the shop name is missing", () => {
    const message = buildQuoteMessage(JOB, ITEMS, undefined, TEMPLATES);
    expect(message.endsWith("¡Gracias!")).toBe(true);
  });
});
