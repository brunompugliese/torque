import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JOB_STATUSES } from "@/lib/status";
import { renderWithIntl } from "@/test/render";

import { AppointmentStatusBadge, JobStatusBadge, StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("shows its text with the family's tokens and no dot", () => {
    renderWithIntl(<StatusBadge family="in-progress">En curso</StatusBadge>);
    const badge = screen.getByText("En curso");
    expect(badge).toHaveClass("bg-status-in-progress", "text-status-in-progress-foreground");
    expect(badge.querySelector("span")).toBeNull();
  });

  it.each(["pending", "quote-sent", "quote-accepted", "in-progress", "done", "delivered", "cancelled"] as const)(
    "gives the %s family a border in its own text color, like every other family",
    (family) => {
      renderWithIntl(<StatusBadge family={family}>Estado</StatusBadge>);
      expect(screen.getByText("Estado")).toHaveClass(`border-status-${family}-foreground/20`);
    },
  );
});

describe("StatusBadge trailing icon", () => {
  it("puts the icon inside the pill, after the text", () => {
    renderWithIntl(
      <StatusBadge family="done" trailing={<svg data-testid="arrow" aria-hidden="true" />}>
        Hecho
      </StatusBadge>,
    );
    const badge = screen.getByText("Hecho");
    expect(badge).toContainElement(screen.getByTestId("arrow"));
    expect(badge.lastElementChild).toBe(screen.getByTestId("arrow"));
  });

  it("has nothing after the text without it", () => {
    renderWithIntl(<StatusBadge family="done">Hecho</StatusBadge>);
    expect(screen.getByText("Hecho").children).toHaveLength(0);
  });
});

describe("AppointmentStatusBadge", () => {
  it.each([
    ["pendiente", "Pendiente", "bg-status-pending"],
    ["confirmado", "Confirmado", "bg-status-done"],
    ["completado", "Completado", "bg-status-done"],
    ["cancelado", "Cancelado", "bg-status-cancelled"],
  ] as const)("shows %s as %s", (status, label, token) => {
    renderWithIntl(<AppointmentStatusBadge status={status} />);
    expect(screen.getByText(label)).toHaveClass(token);
  });
});

describe("JobStatusBadge", () => {
  it.each([
    ["pendiente", "Pendiente", "bg-status-pending"],
    ["presupuesto_enviado", "Presupuesto enviado", "bg-status-quote-sent"],
    ["presupuesto_aceptado", "Presupuesto aceptado", "bg-status-quote-accepted"],
    ["en_progreso", "En progreso", "bg-status-in-progress"],
    ["completado", "Completado", "bg-status-done"],
    ["entregado", "Entregado", "bg-status-delivered"],
    ["cancelado", "Cancelado", "bg-status-cancelled"],
  ] as const)("shows %s as %s", (status, label, token) => {
    renderWithIntl(<JobStatusBadge status={status} />);
    expect(screen.getByText(label)).toHaveClass(token);
  });

  it("covers every job status", () => {
    expect(JOB_STATUSES).toHaveLength(7);
  });
});
