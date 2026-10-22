import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JOB_STATUSES } from "@/lib/status";
import { renderWithIntl } from "@/test/render";

import { JobStatusBadge, StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("shows its text with the family's tokens and a decorative dot", () => {
    renderWithIntl(<StatusBadge family="in-progress">En curso</StatusBadge>);
    const badge = screen.getByText("En curso");
    expect(badge).toHaveClass("bg-status-in-progress", "text-status-in-progress-foreground");
    const dot = badge.querySelector("[aria-hidden='true']");
    expect(dot).toHaveClass("bg-status-in-progress-dot");
  });

  it("gives the done and cancelled families their border", () => {
    renderWithIntl(
      <>
        <StatusBadge family="done">Hecho</StatusBadge>
        <StatusBadge family="cancelled">Anulado</StatusBadge>
        <StatusBadge family="pending">Espera</StatusBadge>
      </>,
    );
    expect(screen.getByText("Hecho")).toHaveClass("border-status-done-border");
    expect(screen.getByText("Anulado")).toHaveClass("border-status-cancelled-border");
    expect(screen.getByText("Espera")).toHaveClass("border-transparent");
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
