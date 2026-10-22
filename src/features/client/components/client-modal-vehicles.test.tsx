import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Vehicle } from "@/features/vehicle/schemas";
import { renderWithIntl } from "@/test/render";

import type { Client } from "../schemas";

const mocks = vi.hoisted(() => ({
  getClientVehicles: vi.fn(),
  getUnassignedVehicles: vi.fn(),
  assignVehiclesToClient: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("../actions", () => ({ createClient: vi.fn(), updateClient: vi.fn(), setClientArchived: vi.fn() }));
vi.mock("@/features/vehicle/actions", () => ({
  getClientVehicles: mocks.getClientVehicles,
  getUnassignedVehicles: mocks.getUnassignedVehicles,
  assignVehiclesToClient: mocks.assignVehiclesToClient,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { ClientModal, type ClientModalMode } from "./client-modal";

const CLIENT: Client = {
  id: "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
  name: "Ana",
  surname: "Gómez",
  dni: "28456123",
  phoneNumber: "11 12345678",
  email: "ana@example.com",
  enabled: true,
  createdAt: "2026-10-14T01:30:00+00:00",
};

const CRONOS: Vehicle = {
  id: "v1",
  plate: "AB123CD",
  brandName: "Fiat",
  modelName: "Cronos",
  year: 2021,
  vin: "8AP359A1XMU123456",
  enabled: true,
};
const GOL: Vehicle = { id: "v2", plate: "ABC123", brandName: "Volkswagen", modelName: "Gol", year: null, vin: null, enabled: false };
const SANDERO: Vehicle = { id: "v3", plate: "ZZ999ZZ", brandName: "Renault", modelName: "Sandero", year: 2019, vin: null, enabled: true };

function renderModal(mode: ClientModalMode, client: Client = CLIENT) {
  const onModeChange = vi.fn();
  const onOpenChange = vi.fn();
  renderWithIntl(
    <ClientModal open mode={mode} client={client} onModeChange={onModeChange} onOpenChange={onOpenChange} />,
  );
  return { onModeChange, onOpenChange };
}

const assignButton = (name: string) => screen.getByRole("button", { name });
const click = async (name: string) => act(async () => fireEvent.click(assignButton(name)));
const pick = (name: string) => fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(name) }));

beforeEach(() => {
  for (const mock of [mocks.getClientVehicles, mocks.getUnassignedVehicles, mocks.assignVehiclesToClient, mocks.toast, mocks.toast.error]) {
    mock.mockReset();
  }
  mocks.getClientVehicles.mockResolvedValue({ ok: true, rows: [] });
  mocks.getUnassignedVehicles.mockResolvedValue({ ok: true, rows: [] });
});

describe("ClientModal: vehicles", () => {
  it("shows a busy skeleton while the vehicles load, announced once", async () => {
    mocks.getClientVehicles.mockReturnValue(new Promise(() => {}));
    renderModal("view");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Vehículos" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Agregar vehículo" })).toBeInTheDocument();
    expect(dialog.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(within(dialog).getAllByRole("status")).toHaveLength(1);
  });

  it("asks only for the open client's vehicles", async () => {
    renderModal("view");
    await screen.findByText("Este cliente todavía no tiene vehículos.");
    expect(mocks.getClientVehicles).toHaveBeenCalledWith(CLIENT.id);
  });

  it("lists the vehicles with the plate drawn, brand and model, year and VIN, and a badge when archived", async () => {
    mocks.getClientVehicles.mockResolvedValue({ ok: true, rows: [CRONOS, GOL] });
    renderModal("view");

    const first = (await screen.findByText("AB 123 CD")).closest("li")!;
    expect(first).toHaveTextContent("Fiat Cronos");
    expect(first).toHaveTextContent("2021 · 8AP359A1XMU123456");
    expect(within(first).queryByText("Archivado")).toBeNull();

    const second = screen.getByText("ABC 123").closest("li")!;
    expect(second).toHaveTextContent("Volkswagen Gol");
    expect(second).toHaveTextContent("Sin VIN");
    expect(within(second).getByText("Archivado")).toBeInTheDocument();
  });

  it("opens a vehicle from its row, handing it to the modal chain", async () => {
    mocks.getClientVehicles.mockResolvedValue({ ok: true, rows: [CRONOS, GOL] });
    const { onModeChange } = renderModal("view");
    const row = (await screen.findByText("ABC 123")).closest("li")!;
    fireEvent.click(within(row).getByRole("button"));
    expect(onModeChange).toHaveBeenCalledWith("vehicle-view", undefined, GOL);
  });

  it("opens a vehicle from the keyboard", async () => {
    mocks.getClientVehicles.mockResolvedValue({ ok: true, rows: [CRONOS] });
    const { onModeChange } = renderModal("view");
    const row = (await screen.findByText("AB 123 CD")).closest("li")!;
    const rowButton = within(row).getByRole("button");
    rowButton.focus();
    expect(rowButton).toHaveFocus();
    fireEvent.click(rowButton);
    expect(onModeChange).toHaveBeenCalledWith("vehicle-view", undefined, CRONOS);
  });

  it("says when the client has no vehicles", async () => {
    renderModal("view");
    expect(await screen.findByText("Este cliente todavía no tiene vehículos.")).toBeInTheDocument();
  });

  it("shows an error with Reintentar when the vehicles can't load", async () => {
    mocks.getClientVehicles.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, rows: [CRONOS] });
    renderModal("view");
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("AB 123 CD")).toBeInTheDocument();
  });

  it("opens the add-vehicle flow with Agregar vehículo", async () => {
    const { onModeChange } = renderModal("view");
    fireEvent.click(await screen.findByRole("button", { name: "Agregar vehículo" }));
    expect(onModeChange).toHaveBeenCalledWith("add-vehicle");
  });
});

describe("ClientModal: add vehicle", () => {
  it("loads the vehicles without a client behind a skeleton, announced once", async () => {
    mocks.getUnassignedVehicles.mockReturnValue(new Promise(() => {}));
    renderModal("add-vehicle");
    const dialog = await screen.findByRole("dialog", { name: "Agregar vehículo" });
    expect(dialog.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(within(dialog).getAllByRole("status")).toHaveLength(1);
    expect(mocks.getClientVehicles).not.toHaveBeenCalled();
  });

  it("offers two flows with the client's name as subtitle and no count", async () => {
    mocks.getUnassignedVehicles.mockResolvedValue({ ok: true, rows: [CRONOS, GOL, SANDERO] });
    renderModal("add-vehicle");

    const assign = await screen.findByRole("button", { name: /Asignar un vehículo existente/ });
    expect(assign).toBeEnabled();
    expect(assign).toHaveTextContent("Vehículos sin cliente");
    expect(assign).not.toHaveTextContent("3");
    expect(screen.getByRole("dialog")).toHaveTextContent("Ana Gómez");
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("enables Crear un vehículo nuevo, whatever the vehicles without a client are, and opens the form", async () => {
    mocks.getUnassignedVehicles.mockResolvedValue({ ok: true, rows: [CRONOS] });
    const { onModeChange } = renderModal("add-vehicle");
    const create = await screen.findByRole("button", { name: /Crear un vehículo nuevo/ });
    expect(create).toBeEnabled();
    expect(create).not.toHaveTextContent("Próximamente");
    fireEvent.click(create);
    expect(onModeChange).toHaveBeenCalledWith("vehicle-create");
  });

  it("keeps Crear un vehículo nuevo available while the other list loads or fails", async () => {
    mocks.getUnassignedVehicles.mockReturnValue(new Promise(() => {}));
    renderModal("add-vehicle");
    expect(await screen.findByRole("button", { name: /Crear un vehículo nuevo/ })).toBeEnabled();
  });

  it("keeps Crear un vehículo nuevo next to the error when the list can't load", async () => {
    mocks.getUnassignedVehicles.mockResolvedValue({ ok: false });
    renderModal("add-vehicle");
    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Crear un vehículo nuevo/ })).toBeEnabled();
  });

  it("greys out the assign flow when there are no vehicles without a client", async () => {
    renderModal("add-vehicle");
    const assign = await screen.findByRole("button", { name: /Asignar un vehículo existente/ });
    expect(assign).toBeDisabled();
    expect(assign).toHaveTextContent("No hay vehículos sin cliente");
  });

  it("goes to the assign step", async () => {
    mocks.getUnassignedVehicles.mockResolvedValue({ ok: true, rows: [CRONOS] });
    const { onModeChange } = renderModal("add-vehicle");
    fireEvent.click(await screen.findByRole("button", { name: /Asignar un vehículo existente/ }));
    expect(onModeChange).toHaveBeenCalledWith("assign");
  });

  it("goes back to the client with Volver", async () => {
    const { onModeChange } = renderModal("add-vehicle");
    fireEvent.click(await screen.findByRole("button", { name: "Volver" }));
    expect(onModeChange).toHaveBeenCalledWith("view");
  });

  it("shows an error with Reintentar when the vehicles can't load", async () => {
    mocks.getUnassignedVehicles.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, rows: [CRONOS] });
    renderModal("add-vehicle");
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("button", { name: /Asignar un vehículo existente/ })).toBeEnabled();
  });
});

describe("ClientModal: assign vehicles", () => {
  it("lists the vehicles without a client, archived ones included, and goes back one step with Volver", async () => {
    mocks.getUnassignedVehicles.mockResolvedValue({ ok: true, rows: [CRONOS, GOL] });
    const { onModeChange } = renderModal("assign");

    expect(await screen.findByRole("checkbox", { name: /AB 123 CD Fiat Cronos/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /ABC 123 Volkswagen Gol/ })).toBeInTheDocument();
    expect(screen.getByText("Archivado")).toBeInTheDocument();

    fireEvent.click(assignButton("Volver"));
    expect(onModeChange).toHaveBeenCalledWith("add-vehicle");
  });

  it("asks to choose a vehicle when none is selected", async () => {
    mocks.getUnassignedVehicles.mockResolvedValue({ ok: true, rows: [CRONOS] });
    renderModal("assign");
    await screen.findByRole("checkbox", { name: /AB 123 CD Fiat Cronos/ });
    await click("Asignar vehículo");
    expect(screen.getByText("Elegí al menos un vehículo.")).toBeInTheDocument();
    expect(mocks.assignVehiclesToClient).not.toHaveBeenCalled();
  });

  it("assigns one vehicle, toasts its plate and closes the modal", async () => {
    mocks.getUnassignedVehicles.mockResolvedValue({ ok: true, rows: [CRONOS, GOL] });
    mocks.assignVehiclesToClient.mockResolvedValue({ ok: true, data: { assigned: ["v1"], skipped: 0 } });
    const { onModeChange, onOpenChange } = renderModal("assign");

    await screen.findByRole("checkbox", { name: /AB 123 CD Fiat Cronos/ });
    pick("AB 123 CD Fiat Cronos");
    await click("Asignar vehículo");

    expect(mocks.assignVehiclesToClient).toHaveBeenCalledWith(CLIENT.id, ["v1"]);
    expect(mocks.toast).toHaveBeenCalledWith("Vehículo asignado", { description: "AB 123 CD" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onModeChange).not.toHaveBeenCalled();
  });

  it("assigns several vehicles in one request, counts them in the button and the toast, and closes the modal", async () => {
    mocks.getUnassignedVehicles.mockResolvedValue({ ok: true, rows: [CRONOS, GOL, SANDERO] });
    mocks.assignVehiclesToClient.mockResolvedValue({ ok: true, data: { assigned: ["v1", "v3"], skipped: 0 } });
    const { onModeChange, onOpenChange } = renderModal("assign");

    await screen.findByRole("checkbox", { name: /AB 123 CD Fiat Cronos/ });
    pick("AB 123 CD Fiat Cronos");
    pick("ZZ 999 ZZ Renault Sandero");
    await click("Asignar 2 vehículos");

    expect(mocks.assignVehiclesToClient).toHaveBeenCalledTimes(1);
    expect(mocks.assignVehiclesToClient).toHaveBeenCalledWith(CLIENT.id, ["v1", "v3"]);
    expect(mocks.toast).toHaveBeenCalledWith("Vehículos asignados", { description: "2 vehículos" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onModeChange).not.toHaveBeenCalled();
  });

  it("assigns to an archived client like to an active one", async () => {
    mocks.getUnassignedVehicles.mockResolvedValue({ ok: true, rows: [CRONOS] });
    mocks.assignVehiclesToClient.mockResolvedValue({ ok: true, data: { assigned: ["v1"], skipped: 0 } });
    renderModal("assign", { ...CLIENT, enabled: false });

    await screen.findByRole("checkbox", { name: /AB 123 CD Fiat Cronos/ });
    pick("AB 123 CD Fiat Cronos");
    await click("Asignar vehículo");
    expect(mocks.assignVehiclesToClient).toHaveBeenCalledWith(CLIENT.id, ["v1"]);
  });

  it("assigns the rest and stays, with a message and a fresh list, when some already had a client", async () => {
    mocks.getUnassignedVehicles
      .mockResolvedValueOnce({ ok: true, rows: [CRONOS, GOL, SANDERO] })
      .mockResolvedValueOnce({ ok: true, rows: [SANDERO] });
    mocks.assignVehiclesToClient.mockResolvedValue({ ok: true, data: { assigned: ["v1"], skipped: 1 } });
    const { onModeChange } = renderModal("assign");

    await screen.findByRole("checkbox", { name: /AB 123 CD Fiat Cronos/ });
    pick("AB 123 CD Fiat Cronos");
    pick("ABC 123 Volkswagen Gol");
    await click("Asignar 2 vehículos");

    expect(await screen.findByText("Algunos vehículos ya tenían un cliente.")).toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith("Vehículo asignado", { description: "AB 123 CD" });
    expect(mocks.getUnassignedVehicles).toHaveBeenCalledTimes(2);
    expect(onModeChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: /AB 123 CD Fiat Cronos/ })).toBeNull());
    expect(screen.getByRole("checkbox", { name: /ZZ 999 ZZ Renault Sandero/ })).toBeInTheDocument();
  });

  it("says so, and refreshes, when the only selected vehicle already had a client", async () => {
    mocks.getUnassignedVehicles
      .mockResolvedValueOnce({ ok: true, rows: [CRONOS, SANDERO] })
      .mockResolvedValueOnce({ ok: true, rows: [SANDERO] });
    mocks.assignVehiclesToClient.mockResolvedValue({ ok: false, error: "alreadyAssigned" });
    const { onModeChange } = renderModal("assign");

    await screen.findByRole("checkbox", { name: /AB 123 CD Fiat Cronos/ });
    pick("AB 123 CD Fiat Cronos");
    await click("Asignar vehículo");

    expect(await screen.findByText("Este vehículo ya tiene un cliente.")).toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.getUnassignedVehicles).toHaveBeenCalledTimes(2);
    expect(onModeChange).not.toHaveBeenCalled();
  });

  it("shows a generic error when the assignment fails", async () => {
    mocks.getUnassignedVehicles.mockResolvedValue({ ok: true, rows: [CRONOS] });
    mocks.assignVehiclesToClient.mockResolvedValue({ ok: false, error: "unexpected" });
    const { onModeChange } = renderModal("assign");

    await screen.findByRole("checkbox", { name: /AB 123 CD Fiat Cronos/ });
    pick("AB 123 CD Fiat Cronos");
    await click("Asignar vehículo");

    expect(await screen.findByText("Algo salió mal. Probá de nuevo.")).toBeInTheDocument();
    expect(onModeChange).not.toHaveBeenCalled();
  });

  it("shows an error with Reintentar when the list can't load", async () => {
    mocks.getUnassignedVehicles.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, rows: [CRONOS] });
    renderModal("assign");
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("checkbox", { name: /AB 123 CD Fiat Cronos/ })).toBeInTheDocument();
  });
});
