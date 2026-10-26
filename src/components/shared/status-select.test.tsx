import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JOB_STATUSES } from "@/lib/status";
import { renderWithIntl } from "@/test/render";

import { AppointmentStatusSelect, StatusSelect } from "./status-select";

// A Select option is chosen on pointer release, as a mouse does it.
function press(option: HTMLElement) {
  fireEvent.pointerDown(option);
  fireEvent.mouseDown(option);
  fireEvent.pointerUp(option);
  fireEvent.mouseUp(option);
  fireEvent.click(option);
}

describe("StatusSelect", () => {
  it("shows the status as its pill, on a button that says what it does and the current status", () => {
    renderWithIntl(<StatusSelect status="en_progreso" label="Cambiar estado" onChange={() => {}} />);
    const trigger = screen.getByRole("combobox", { name: "Cambiar estado: En progreso" });
    expect(within(trigger).getByText("En progreso")).toHaveClass("bg-status-in-progress");
  });

  it("draws its arrow inside the pill, and nowhere else", () => {
    renderWithIntl(<StatusSelect status="pendiente" label="Cambiar estado" onChange={() => {}} />);
    const trigger = screen.getByRole("combobox");
    const pill = within(trigger).getByText("Pendiente");
    expect(pill.querySelector("svg")).not.toBeNull();
    expect(trigger.querySelectorAll("svg")).toHaveLength(1);
  });

  it("lists every status in order, with the app's neutral style and not each status' color", async () => {
    renderWithIntl(<StatusSelect status="pendiente" label="Cambiar estado" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("combobox"));
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Pendiente",
      "Presupuesto enviado",
      "Presupuesto aceptado",
      "En progreso",
      "Completado",
      "Entregado",
      "Cancelado",
    ]);
    expect(options).toHaveLength(JOB_STATUSES.length);
    for (const option of options) expect(option.className).not.toMatch(/status-/);
    expect(screen.getByRole("option", { name: "Pendiente" })).toHaveAttribute("aria-selected", "true");
  });

  it("calls onChange with the chosen status", async () => {
    const onChange = vi.fn();
    renderWithIntl(<StatusSelect status="pendiente" label="Cambiar estado" onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox"));
    press(await screen.findByRole("option", { name: "Completado" }));
    expect(onChange).toHaveBeenCalledWith("completado");
  });

  it("does nothing when the current status is chosen again", async () => {
    const onChange = vi.fn();
    renderWithIntl(<StatusSelect status="pendiente" label="Cambiar estado" onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox"));
    press(await screen.findByRole("option", { name: "Pendiente" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("can't be opened when disabled", () => {
    renderWithIntl(<StatusSelect status="pendiente" label="Cambiar estado" disabled onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});

describe("AppointmentStatusSelect", () => {
  it("shows the appointment status as its pill on a button that names it", () => {
    renderWithIntl(<AppointmentStatusSelect status="confirmado" label="Cambiar estado" onChange={() => {}} />);
    const trigger = screen.getByRole("combobox", { name: "Cambiar estado: Confirmado" });
    expect(within(trigger).getByText("Confirmado")).toHaveClass("bg-status-done");
    expect(trigger.querySelectorAll("svg")).toHaveLength(1);
  });

  it("lists the four statuses in order and marks the current one", async () => {
    renderWithIntl(<AppointmentStatusSelect status="completado" label="Cambiar estado" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("combobox"));
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Pendiente", "Confirmado", "Completado", "Cancelado"]);
    expect(screen.getByRole("option", { name: "Completado" })).toHaveAttribute("aria-selected", "true");
    for (const option of options) expect(option.className).not.toMatch(/status-/);
  });

  it("jumps to any status and ignores the current one", async () => {
    const onChange = vi.fn();
    renderWithIntl(<AppointmentStatusSelect status="cancelado" label="Cambiar estado" onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox"));
    press(await screen.findByRole("option", { name: "Completado" }));
    expect(onChange).toHaveBeenCalledWith("completado");
    onChange.mockClear();

    fireEvent.click(screen.getByRole("combobox"));
    press(await screen.findByRole("option", { name: "Cancelado" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("can't be opened when disabled", () => {
    renderWithIntl(<AppointmentStatusSelect status="pendiente" label="Cambiar estado" disabled onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
