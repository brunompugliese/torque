import { describe, expect, it } from "vitest";

import { APPOINTMENT_STATUSES } from "@/lib/status";

import { STATUS_TOAST, needsConfirmation } from "./status-change";

describe("needsConfirmation", () => {
  it("only asks before cancelling", () => {
    expect(needsConfirmation("pendiente", "cancelado")).toBe(true);
    expect(needsConfirmation("completado", "cancelado")).toBe(true);
    expect(needsConfirmation("pendiente", "confirmado")).toBe(false);
    expect(needsConfirmation("cancelado", "pendiente")).toBe(false);
    expect(needsConfirmation("cancelado", "cancelado")).toBe(false);
  });
});

describe("STATUS_TOAST", () => {
  it("has a toast for every status", () => {
    expect(Object.keys(STATUS_TOAST).sort()).toEqual([...APPOINTMENT_STATUSES].sort());
  });
});
