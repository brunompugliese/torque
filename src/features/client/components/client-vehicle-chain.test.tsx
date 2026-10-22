import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { VehicleListItem } from "@/features/vehicle/schemas";
import { chooseOption } from "@/test/combobox";
import { renderWithIntl } from "@/test/render";

import type { Client } from "../schemas";

// The client modal with a vehicle as one more step of its chain (client → vehicle),
// through the real panel so the modes, the state and the dialog are the real ones.

const mocks = vi.hoisted(() => ({
  getClientVehicles: vi.fn(),
  getUnassignedVehicles: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  setVehicleArchived: vi.fn(),
  getBrandOptions: vi.fn(),
  getModelOptions: vi.fn(),
  getVehicleJobs: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/clientes",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("../actions", () => ({
  searchClients: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  setClientArchived: vi.fn(),
  searchClientOptions: vi.fn(async () => ({ ok: true, rows: [] })),
}));
vi.mock("@/features/vehicle/actions", () => ({
  getClientVehicles: mocks.getClientVehicles,
  getUnassignedVehicles: mocks.getUnassignedVehicles,
  assignVehiclesToClient: vi.fn(),
  createVehicle: mocks.createVehicle,
  updateVehicle: mocks.updateVehicle,
  setVehicleArchived: mocks.setVehicleArchived,
  getBrandOptions: mocks.getBrandOptions,
  getModelOptions: mocks.getModelOptions,
}));
vi.mock("@/features/job/actions", () => ({ getVehicleJobs: mocks.getVehicleJobs }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { ClientsPanel } from "./clients-panel";
import { ClientsTable } from "./clients-table";

beforeAll(async () => {
  await import("./client-modal");
});

const FIAT = "aa1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const CRONOS = "bb1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const CLIENT_ID = "cc1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const CLIENT: Client = {
  id: CLIENT_ID,
  name: "Ana",
  surname: "Gómez",
  dni: "28456123",
  phoneNumber: "11 1234-5678",
  email: "ana@example.com",
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
};

const VEHICLE: VehicleListItem = {
  id: "dd1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
  plate: "AB123CD",
  brandId: FIAT,
  modelId: CRONOS,
  brandName: "Fiat",
  modelName: "Cronos",
  year: 2021,
  vin: null,
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
  lastKm: 90000,
  client: { id: CLIENT_ID, name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
};
const CREATED: VehicleListItem = { ...VEHICLE, id: "ee1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b", plate: "ZZ999ZZ", year: 2019 };

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.toast.error = vi.fn();
  mocks.getClientVehicles.mockResolvedValue({ ok: true, rows: [VEHICLE] });
  mocks.getUnassignedVehicles.mockResolvedValue({ ok: true, rows: [] });
  mocks.getVehicleJobs.mockResolvedValue({ ok: true, rows: [] });
  mocks.getBrandOptions.mockResolvedValue({ ok: true, rows: [{ id: FIAT, name: "Fiat" }] });
  mocks.getModelOptions.mockResolvedValue({ ok: true, rows: [{ id: CRONOS, name: "Cronos" }] });
});

async function openClient() {
  renderWithIntl(
    <ClientsPanel>
      <ClientsTable ok rows={[CLIENT]} matching={1} total={1} />
    </ClientsPanel>,
  );
  fireEvent.click(screen.getByText("Ana Gómez").closest("tr")!);
  await screen.findByRole("dialog", { name: "Ana Gómez" });
}

async function openVehicle() {
  await openClient();
  fireEvent.click(within((await screen.findByText("AB 123 CD")).closest("li")!).getByRole("button"));
  return screen.findByRole("heading", { name: /Fiat Cronos 2021/ });
}

const button = (name: string | RegExp) => screen.getByRole("button", { name });
const click = async (name: string | RegExp) => act(async () => fireEvent.click(await screen.findByRole("button", { name })));

describe("a vehicle of the client", () => {
  it("opens from its row in the same dialog, with its details and a Volver", async () => {
    await openVehicle();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector('[data-slot="plate"]')).toHaveTextContent("AB 123 CD");
    expect(within(dialog).getByText("90.000 km")).toBeInTheDocument();
    expect(within(dialog).getByText("Ana Gómez")).toBeInTheDocument();
    expect(button("Volver")).toBeInTheDocument();
    expect(mocks.getVehicleJobs).toHaveBeenCalledWith(VEHICLE.id);
  });

  it("goes back to the client with Volver, with the focus on the vehicle it came from", async () => {
    await openVehicle();
    await click("Volver");

    expect(await screen.findByRole("heading", { name: "Ana Gómez" })).toBeInTheDocument();
    const row = (await screen.findByText("AB 123 CD")).closest("li")!;
    await waitFor(() => expect(within(row).getByRole("button")).toHaveFocus());
    expect(mocks.getClientVehicles).toHaveBeenCalledTimes(2);
  });

  it("closes every modal of the chain with the X", async () => {
    await openVehicle();
    await click("Cerrar");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes the whole chain after editing the vehicle, with a toast", async () => {
    const saved = { ...VEHICLE, year: 2022 };
    mocks.updateVehicle.mockResolvedValue({ ok: true, data: saved });
    await openVehicle();
    await click("Editar vehículo");
    fireEvent.change(await screen.findByLabelText("Año"), { target: { value: "2022" } });
    await click("Guardar cambios");

    expect(mocks.toast).toHaveBeenCalledWith("Cambios guardados", { description: "AB 123 CD" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("goes back to the vehicle, not the client, when the edit is cancelled", async () => {
    await openVehicle();
    await click("Editar vehículo");
    await click("Cancelar");
    expect(await screen.findByRole("heading", { name: /Fiat Cronos 2021/ })).toBeInTheDocument();
    expect(button("Volver")).toBeInTheDocument();
  });

  it("archives it with the standard flow: the whole chain closes and a toast confirms", async () => {
    mocks.setVehicleArchived.mockResolvedValue({ ok: true, data: { ...VEHICLE, enabled: false } });
    await openVehicle();
    await click("Archivar");
    const confirm = await screen.findByRole("alertdialog");
    await act(async () => fireEvent.click(within(confirm).getByRole("button", { name: "Archivar" })));

    expect(mocks.setVehicleArchived).toHaveBeenCalledWith(VEHICLE.id, true);
    expect(mocks.toast).toHaveBeenCalledWith("Vehículo archivado", { description: "AB 123 CD" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("creating a vehicle from the client", () => {
  async function openCreate() {
    await openClient();
    await click("Agregar vehículo");
    await click(/Crear un vehículo nuevo/);
    return screen.findByRole("dialog", { name: "Agregar vehículo" });
  }

  it("opens the vehicle form with the client chosen and locked", async () => {
    await openCreate();
    expect(screen.getByLabelText("Cliente")).toHaveValue("Ana Gómez");
    expect(screen.getByLabelText("Cliente")).toHaveAttribute("readonly");
    expect(screen.queryByText("Crear cliente nuevo")).toBeNull();
  });

  it("goes back one step, to the choice, from Cancelar", async () => {
    await openCreate();
    await click("Cancelar");
    expect(await screen.findByRole("button", { name: /Crear un vehículo nuevo/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
  });

  it("saves the vehicle for the client, confirms with a toast and closes the whole chain", async () => {
    mocks.createVehicle.mockResolvedValue({ ok: true, data: CREATED });
    await openCreate();

    fireEvent.change(screen.getByLabelText("Patente *"), { target: { value: "zz999zz" } });
    await chooseOption(screen.getByLabelText("Marca *"), "fia", /Fiat/);
    await waitFor(() => expect(screen.getByLabelText("Modelo *")).toBeEnabled());
    await chooseOption(screen.getByLabelText("Modelo *"), "cro", /Cronos/);
    await click("Agregar vehículo");

    expect(mocks.createVehicle).toHaveBeenCalledWith(
      expect.objectContaining({ plate: "ZZ999ZZ", clientId: CLIENT_ID, newClient: null }),
    );
    expect(mocks.toast).toHaveBeenCalledWith("Vehículo agregado", { description: "ZZ 999 ZZ" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
