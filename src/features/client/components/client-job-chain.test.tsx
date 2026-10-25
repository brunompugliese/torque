import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { JobListItem } from "@/features/job/schemas";
import type { VehicleListItem } from "@/features/vehicle/schemas";
import { renderWithIntl } from "@/test/render";

import type { Client } from "../schemas";

// client → vehicle → job: three steps in one dialog, through the real panel so the modes, the
// state and the dialog are the real ones.

const mocks = vi.hoisted(() => ({
  getClientVehicles: vi.fn(),
  getVehicleJobs: vi.fn(),
  getJobRow: vi.fn(),
  getJobDetails: vi.fn(),
  setJobArchived: vi.fn(),
  updateJob: vi.fn(),
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
  getUnassignedVehicles: vi.fn(async () => ({ ok: true, rows: [] })),
  assignVehiclesToClient: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  setVehicleArchived: vi.fn(),
  getBrandOptions: vi.fn(async () => ({ ok: true, rows: [] })),
  getModelOptions: vi.fn(async () => ({ ok: true, rows: [] })),
}));
vi.mock("@/features/job/actions", () => ({
  getVehicleJobs: mocks.getVehicleJobs,
  getJobRow: mocks.getJobRow,
  getJobDetails: mocks.getJobDetails,
  setJobArchived: mocks.setJobArchived,
  updateJob: mocks.updateJob,
  createJob: vi.fn(),
  searchVehicleOptions: vi.fn(async () => ({ ok: true, rows: [] })),
  getOwnerOfVehicle: vi.fn(async () => ({ ok: true, owner: null })),
  getVehicleKmFloor: vi.fn(async () => ({ ok: true, floor: null })),
  getServiceOptions: vi.fn(async () => ({ ok: true, rows: [] })),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { ClientsPanel } from "./clients-panel";
import { ClientsTable } from "./clients-table";

beforeAll(async () => {
  await import("./client-modal");
});

const CLIENT_ID = "cc1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const VEHICLE_ID = "dd1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JOB_ID = "ff1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

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
  id: VEHICLE_ID,
  plate: "AB123CD",
  brandId: "aa1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
  modelId: "bb1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
  brandName: "Fiat",
  modelName: "Cronos",
  year: 2021,
  vin: null,
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
  lastKm: 90000,
  client: { id: CLIENT_ID, name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
};
const HISTORY_JOB = {
  id: JOB_ID,
  status: "completado" as const,
  kilometers: 90000,
  quotedTotal: 60000,
  finalTotal: 65000,
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
  services: ["Cambio de aceite"],
};
const JOB: JobListItem = {
  id: JOB_ID,
  status: "completado",
  observations: null,
  kilometers: 90000,
  quotedTotal: 60000,
  finalTotal: 65000,
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
  updatedAt: "2026-10-14T15:00:00+00:00",
  vehicle: { id: VEHICLE_ID, plate: "AB123CD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
  client: { id: CLIENT_ID, name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
  appointment: null,
};

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.toast.error = vi.fn();
  mocks.getClientVehicles.mockResolvedValue({ ok: true, rows: [VEHICLE] });
  mocks.getVehicleJobs.mockResolvedValue({ ok: true, rows: [HISTORY_JOB] });
  mocks.getJobRow.mockResolvedValue({ ok: true, row: JOB });
  mocks.getJobDetails.mockResolvedValue({ ok: true, items: [], history: [] });
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
  await screen.findByRole("heading", { name: /Fiat Cronos 2021/ });
}

async function openJob() {
  await openVehicle();
  fireEvent.click(within((await screen.findByText("Cambio de aceite")).closest("li")!).getByRole("button"));
  return screen.findByText("Creado el 13/10/2026");
}

const button = (name: string | RegExp) => screen.getByRole("button", { name });
const click = async (name: string | RegExp) => act(async () => fireEvent.click(await screen.findByRole("button", { name })));

describe("a job of the vehicle of the client", () => {
  it("opens from the history in the same dialog, with its details and a Volver", async () => {
    await openJob();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector('[data-slot="plate"]')).toHaveTextContent("AB 123 CD");
    expect(within(dialog).getByText("Fiat Cronos 2021")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Completado").length).toBeGreaterThan(0);
    expect(button("Volver")).toBeInTheDocument();
    expect(button("Archivar")).toBeInTheDocument();
    expect(button("Editar trabajo")).toBeInTheDocument();
    expect(mocks.getJobRow).toHaveBeenCalledWith(JOB_ID);
  });

  it("shows a skeleton, announced once, while the job loads", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getJobRow.mockReturnValue(new Promise((done) => (resolve = done)));
    await openVehicle();
    fireEvent.click(within((await screen.findByText("Cambio de aceite")).closest("li")!).getByRole("button"));

    expect(await screen.findByRole("heading", { name: "Trabajo" })).toBeInTheDocument();
    expect(screen.getAllByText("Cargando…")).toHaveLength(1);
    expect(button("Volver")).toBeInTheDocument();

    await act(async () => resolve({ ok: true, row: JOB }));
    expect(await screen.findByText("Creado el 13/10/2026")).toBeInTheDocument();
  });

  it("offers to retry when the job can not be loaded", async () => {
    mocks.getJobRow.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ ok: true, row: JOB });
    await openVehicle();
    fireEvent.click(within((await screen.findByText("Cambio de aceite")).closest("li")!).getByRole("button"));
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Creado el 13/10/2026")).toBeInTheDocument();
  });

  it("goes back to the vehicle with Volver, with the focus on the job it came from", async () => {
    await openJob();
    await click("Volver");

    expect(await screen.findByRole("heading", { name: /Fiat Cronos 2021/ })).toBeInTheDocument();
    const row = (await screen.findByText("Cambio de aceite")).closest("li")!;
    await waitFor(() => expect(within(row).getByRole("button")).toHaveFocus());
  });

  it("goes all the way back to the client with a second Volver", async () => {
    await openJob();
    await click("Volver");
    await screen.findByRole("heading", { name: /Fiat Cronos 2021/ });
    await click("Volver");
    expect(await screen.findByRole("heading", { name: "Ana Gómez" })).toBeInTheDocument();
  });

  it("closes every modal of the chain with the X", async () => {
    await openJob();
    fireEvent.click(button("Cerrar"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("archives it with the standard flow: the whole chain closes and a toast confirms", async () => {
    mocks.setJobArchived.mockResolvedValue({ ok: true, data: { ...JOB, enabled: false } });
    await openJob();
    fireEvent.click(button("Archivar"));
    const confirm = await screen.findByRole("alertdialog");
    await act(async () => fireEvent.click(within(confirm).getByRole("button", { name: "Archivar" })));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.setJobArchived).toHaveBeenCalledWith(JOB_ID, true);
    expect(mocks.toast).toHaveBeenCalledWith("Trabajo archivado", { description: "AB 123 CD, Fiat Cronos" });
  });

  it("opens the edit form for an open job, and goes back to the job when it is cancelled", async () => {
    await openJob();
    await click("Editar trabajo");
    expect(await screen.findByRole("heading", { name: "Editar trabajo" })).toBeInTheDocument();
    await click("Cancelar");
    expect(await screen.findByText("Creado el 13/10/2026")).toBeInTheDocument();
    expect(mocks.getJobRow).toHaveBeenCalledTimes(1);
  });

  it("closes the whole chain after saving the edit, with a toast", async () => {
    mocks.updateJob.mockResolvedValue({ ok: true, data: JOB });
    await openJob();
    await click("Editar trabajo");
    await screen.findByRole("heading", { name: "Editar trabajo" });
    fireEvent.change(await screen.findByLabelText("Observaciones"), { target: { value: "Revisar frenos" } });
    await click("Guardar cambios");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.updateJob).toHaveBeenCalledWith(JOB_ID, expect.objectContaining({ observations: "Revisar frenos" }));
    expect(mocks.toast).toHaveBeenCalledWith("Cambios guardados", { description: "AB 123 CD, Fiat Cronos" });
  });

  it("does not offer to edit a closed job", async () => {
    mocks.getJobRow.mockResolvedValue({ ok: true, row: { ...JOB, status: "entregado" } });
    await openJob();
    expect(screen.queryByRole("button", { name: "Editar trabajo" })).toBeNull();
    expect(screen.getByText("Cerrado, no se puede editar")).toBeInTheDocument();
    expect(button("Archivar")).toBeInTheDocument();
  });
});
