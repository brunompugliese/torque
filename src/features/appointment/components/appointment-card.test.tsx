import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { AppointmentCard, AppointmentLegend } from "./appointment-card";

const VEHICLE = { id: "v1", plate: "AE482KD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true };

function card(status: "pendiente" | "confirmado" | "completado" | "cancelado", variant?: "line" | "list") {
  return (
    <AppointmentCard appointment={{ id: "a1", time: "09:00", status, vehicle: VEHICLE }} variant={variant} onOpen={() => {}} />
  );
}

describe("AppointmentCard", () => {
  it("shows the time in bold and the brand with the model, cut with an ellipsis when it doesn't fit", () => {
    renderWithIntl(card("pendiente"));
    expect(screen.getByText("09:00")).toHaveClass("font-bold");
    expect(screen.getByText("Fiat Cronos")).toHaveClass("truncate");
  });

  it("names its status for a screen reader", () => {
    renderWithIntl(card("confirmado"));
    expect(screen.getByRole("button", { name: "09:00, Fiat Cronos, Confirmado" })).toBeInTheDocument();
  });

  it("opens when clicked", () => {
    const onOpen = vi.fn();
    renderWithIntl(
      <AppointmentCard appointment={{ id: "a1", time: "09:00", status: "pendiente", vehicle: VEHICLE }} onOpen={onOpen} />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["pendiente", ["bg-card", "border-l-4", "border-l-status-pending-dot"]],
    ["confirmado", ["bg-card", "hatch-done", "border-status-done-dot"]],
    [
      "completado",
      ["bg-status-done", "border-status-done-border", "border-l-4", "border-l-status-done-dot", "text-status-done-foreground"],
    ],
    [
      "cancelado",
      [
        "bg-status-cancelled",
        "border-status-cancelled-border",
        "border-l-4",
        "border-l-status-cancelled-dot",
        "text-status-cancelled-foreground",
      ],
    ],
  ] as const)("styles %s with its edge and fill", (status, classes) => {
    renderWithIntl(card(status));
    expect(screen.getByRole("button")).toHaveClass(...classes);
  });

  it("strikes through only a cancelled appointment", () => {
    const { unmount } = renderWithIntl(card("cancelado"));
    expect(screen.getByRole("button")).toHaveClass("line-through");
    unmount();
    renderWithIntl(card("completado"));
    expect(screen.getByRole("button")).not.toHaveClass("line-through");
  });

  it("gives Confirmado a solid border and diagonal lines instead of the 4px edge", () => {
    renderWithIntl(card("confirmado"));
    const button = screen.getByRole("button");
    expect(button).toHaveClass("border", "hatch-done");
    expect(button).not.toHaveClass("border-l-4");
  });

  it("also names the plate in the '+N más' list, as plain text", () => {
    renderWithIntl(card("pendiente", "list"));
    expect(screen.getByRole("button", { name: "09:00, Fiat Cronos, AE 482 KD, Pendiente" })).toBeInTheDocument();
    expect(screen.getByText("AE 482 KD")).toBeInTheDocument();
  });

  it("carries the id the calendar uses to give the focus back", () => {
    renderWithIntl(card("pendiente"));
    expect(screen.getByRole("button")).toHaveAttribute("data-item-id", "a1");
  });
});

describe("AppointmentLegend", () => {
  it("lists the four statuses", () => {
    renderWithIntl(<AppointmentLegend />);
    const list = screen.getByRole("list", { name: "Estados de los turnos" });
    expect(list.textContent).toBe("PendienteConfirmadoCompletadoCancelado");
  });

  it("draws each status as a square that says what its card looks like", () => {
    renderWithIntl(<AppointmentLegend />);
    const square = (label: string) => screen.getByText(label).querySelector("span") as HTMLElement;

    expect(square("Pendiente")).toHaveClass("bg-status-pending-dot");
    expect(square("Cancelado")).toHaveClass("bg-status-cancelled-dot");
    // Completado: the card's solid fill and a solid border.
    expect(square("Completado")).toHaveClass("bg-status-done", "border-status-done-dot");
    // Confirmado: a solid border with diagonal lines.
    expect(square("Confirmado")).toHaveClass("hatch-done", "border-status-done-dot");
    for (const status of ["Pendiente", "Confirmado", "Completado", "Cancelado"]) {
      expect(square(status)).not.toHaveClass("rounded-full");
    }
  });
});
