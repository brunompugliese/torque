import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Vehicle } from "@/features/vehicle/schemas";
import { renderWithIntl } from "@/test/render";

import { AssignVehicles, type AssignOutcome } from "./assign-vehicles";

// AB 101 CD … AB 107 CD; odd ones are Fiat Cronos, even ones Renault Sandero.
const VEHICLES: Vehicle[] = Array.from({ length: 7 }, (_, index) => ({
  id: `v${index + 1}`,
  plate: `AB${101 + index}CD`,
  brandName: index % 2 === 0 ? "Fiat" : "Renault",
  modelName: index % 2 === 0 ? "Cronos" : "Sandero",
  year: 2020 + (index % 3),
  vin: index === 0 ? "8AP359A1XMU123456" : null,
  enabled: index !== 6,
}));

function renderStep(onSubmit: (ids: string[]) => Promise<AssignOutcome> = vi.fn(async () => "done" as const), vehicles = VEHICLES) {
  renderWithIntl(<AssignVehicles vehicles={vehicles} onSubmit={onSubmit} />);
  return { onSubmit };
}

const box = (plate: string) => screen.getByRole("checkbox", { name: new RegExp(plate) });
const search = (value: string) => fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
const submit = async (name: string | RegExp = "Asignar vehículo") =>
  act(async () => fireEvent.click(screen.getByRole("button", { name })));

describe("AssignVehicles", () => {
  it("lists five vehicles per page with a checkbox, and says how many there are", () => {
    renderStep();
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    expect(screen.getByText("AB 101 CD")).toBeInTheDocument();
    expect(screen.queryByText("AB 106 CD")).toBeNull();
    expect(screen.getByText("Mostrando 1–5 de 7")).toBeInTheDocument();
  });

  it("names each checkbox with the plate, brand and model, and the whole row toggles it", () => {
    renderStep();
    expect(box("AB 101 CD Fiat Cronos")).toHaveAccessibleName(expect.stringContaining("AB 101 CD Fiat Cronos"));
    fireEvent.click(screen.getByText("AB 101 CD"));
    expect(box("AB 101 CD")).toBeChecked();
  });

  it("pages through the list in memory", () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByText("AB 106 CD")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 6–7 de 7")).toBeInTheDocument();
  });

  it("shows an archived vehicle with its badge", () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(within(screen.getByText("AB 107 CD").closest("li")!).getByText("Archivado")).toBeInTheDocument();
  });

  it("filters while typing, ignoring case, accents, spaces and dashes, and goes back to page 1", () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    search("ab-106 cd");
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByText("AB 106 CD")).toBeInTheDocument();

    search("RENAULT");
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByText("Mostrando 1–3 de 3")).toBeInTheDocument();
  });

  it.each([
    ["brand and model", "fiat cronos", 4],
    ["year", "2021", 2],
    ["VIN", "8ap359", 1],
  ])("searches by %s", (_field, term, count) => {
    renderStep();
    search(term);
    expect(screen.getAllByRole("checkbox")).toHaveLength(count);
  });

  it("makes no request while filtering and paging: it never calls the caller", () => {
    const { onSubmit } = renderStep();
    search("sandero");
    search("");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows no results with a way to clear the search", () => {
    renderStep();
    search("zzzz");
    expect(screen.getByText("No encontramos vehículos")).toBeInTheDocument();
    expect(screen.getByText("Probá con otra patente, marca, modelo o VIN.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Borrar búsqueda" }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("keeps the selection across searches and pages, and counts it in the button", async () => {
    const onSubmit = vi.fn(async () => "done" as const);
    renderStep(onSubmit);
    expect(screen.getByRole("button", { name: "Asignar vehículo" })).toBeInTheDocument();

    fireEvent.click(box("AB 101 CD"));
    expect(screen.getByRole("button", { name: "Asignar vehículo" })).toBeInTheDocument();
    search("sandero");
    fireEvent.click(box("AB 102 CD"));
    expect(screen.getByRole("button", { name: "Asignar 2 vehículos" })).toBeInTheDocument();

    search("");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    fireEvent.click(box("AB 106 CD"));
    expect(screen.getByRole("button", { name: "Asignar 3 vehículos" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(box("AB 101 CD")).toBeChecked();
    expect(box("AB 102 CD")).toBeChecked();

    await submit(/Asignar 3 vehículos/);
    expect(onSubmit).toHaveBeenCalledWith(["v1", "v2", "v6"]);
  });

  it("unchecks a vehicle", () => {
    renderStep();
    fireEvent.click(box("AB 101 CD"));
    fireEvent.click(box("AB 101 CD"));
    expect(box("AB 101 CD")).not.toBeChecked();
  });

  it("asks to choose a vehicle without calling the caller, and clears the message once one is chosen", async () => {
    const { onSubmit } = renderStep();
    await submit();
    expect(screen.getByText("Elegí al menos un vehículo.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(box("AB 101 CD"));
    expect(screen.queryByText("Elegí al menos un vehículo.")).toBeNull();
  });

  it("doesn't submit the assignment with Enter in the search box, nor with the paging buttons", async () => {
    const { onSubmit } = renderStep();
    fireEvent.click(box("AB 101 CD"));
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await act(async () => {});
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([
    ["partial", "Algunos vehículos ya tenían un cliente."],
    ["error", "Algo salió mal. Probá de nuevo."],
  ] as const)("shows the %s outcome", async (outcome, message) => {
    renderStep(async () => outcome);
    fireEvent.click(box("AB 101 CD"));
    await submit();
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("says Este vehículo ya tiene un cliente when the only selected one was taken, even after it left the list", async () => {
    const taken = VEHICLES.slice(0, 2);
    const view = renderWithIntl(<AssignVehicles vehicles={taken} onSubmit={async () => "alreadyAssigned"} />);
    fireEvent.click(box("AB 101 CD"));
    await submit();
    view.rerender(<AssignVehicles vehicles={taken.slice(1)} onSubmit={async () => "alreadyAssigned"} />);
    expect(await screen.findByText("Este vehículo ya tiene un cliente.")).toBeInTheDocument();
  });

  it("drops from the selection a vehicle that leaves the list", () => {
    const view = renderWithIntl(<AssignVehicles vehicles={VEHICLES} onSubmit={async () => "done"} />);
    fireEvent.click(box("AB 101 CD"));
    fireEvent.click(box("AB 102 CD"));
    expect(screen.getByRole("button", { name: "Asignar 2 vehículos" })).toBeInTheDocument();
    view.rerender(<AssignVehicles vehicles={VEHICLES.slice(1)} onSubmit={async () => "done"} />);
    expect(screen.getByRole("button", { name: "Asignar vehículo" })).toBeInTheDocument();
  });
});
