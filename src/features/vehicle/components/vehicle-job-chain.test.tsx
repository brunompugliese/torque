import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ListSearchProvider } from "@/components/shared/list-search-provider";
import type { JobListItem } from "@/features/job/schemas";
import { renderWithIntl } from "@/test/render";

import type { VehicleListItem } from "../schemas";

// vehicle → job on the Vehículos page: a job of the history is one more step of the dialog.

const mocks = vi.hoisted(() => ({
  getVehicleJobs: vi.fn(),
  getJobRow: vi.fn(),
  setJobArchived: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/vehiculos",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("../actions", () => ({
  searchVehicles: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  setVehicleArchived: vi.fn(),
  getBrandOptions: vi.fn(async () => ({ ok: true, rows: [] })),
  getModelOptions: vi.fn(async () => ({ ok: true, rows: [] })),
  searchVehicleOptions: vi.fn(async () => ({ ok: true, rows: [] })),
}));
vi.mock("@/features/client/actions", () => ({ searchClientOptions: vi.fn(async () => ({ ok: true, rows: [] })) }));
vi.mock("@/features/job/actions", () => ({
  getVehicleJobs: mocks.getVehicleJobs,
  getJobRow: mocks.getJobRow,
  getJobDetails: vi.fn(async () => ({ ok: true, items: [], history: [] })),
  setJobArchived: mocks.setJobArchived,
  updateJob: vi.fn(),
  createJob: vi.fn(),
  getOwnerOfVehicle: vi.fn(async () => ({ ok: true, owner: null })),
  getVehicleKmFloor: vi.fn(async () => ({ ok: true, floor: null })),
  getServiceOptions: vi.fn(async () => ({ ok: true, rows: [] })),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { VehiclesPanel } from "./vehicles-panel";
import { VehiclesTable } from "./vehicles-table";

beforeAll(async () => {
  await import("./vehicle-modal");
});

const VEHICLE_ID = "dd1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JOB_ID = "ff1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

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
  client: null,
};
const JOB: JobListItem = {
  id: JOB_ID,
  number: 123,
  status: "en_progreso",
  observations: "Ruido",
  kilometers: 90000,
  quotedTotal: 60000,
  finalTotal: null,
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
  updatedAt: "2026-10-14T15:00:00+00:00",
  vehicle: { id: VEHICLE_ID, plate: "AB123CD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
  client: null,
  appointment: null,
};

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.toast.error = vi.fn();
  mocks.getVehicleJobs.mockResolvedValue({
    ok: true,
    rows: [
      {
        id: JOB_ID,
        status: "en_progreso",
        kilometers: 90000,
        quotedTotal: 60000,
        finalTotal: null,
        enabled: true,
        createdAt: "2026-10-13T15:00:00+00:00",
        services: ["Cambio de aceite"],
      },
    ],
  });
  mocks.getJobRow.mockResolvedValue({ ok: true, row: JOB });
});

async function openJob() {
  renderWithIntl(
    <ListSearchProvider>
      <VehiclesPanel>
        <VehiclesTable ok rows={[VEHICLE]} matching={1} total={1} />
      </VehiclesPanel>
    </ListSearchProvider>,
  );
  fireEvent.click(screen.getByText("Fiat Cronos").closest("tr")!);
  await screen.findByRole("heading", { name: /Fiat Cronos 2021/ });
  fireEvent.click(within((await screen.findByText("Cambio de aceite")).closest("li")!).getByRole("button"));
  await screen.findByText("Creado el 13/10/2026");
}

const button = (name: string | RegExp) => screen.getByRole("button", { name });

describe("a job of the vehicle on the Vehículos page", () => {
  it("opens from the history in the same dialog, with Volver to the vehicle", async () => {
    await openJob();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText("Ruido")).toBeInTheDocument();
    expect(button("Volver")).toBeInTheDocument();
    expect(mocks.getJobRow).toHaveBeenCalledWith(JOB_ID);
  });

  it("goes back to the vehicle, with the focus on the job it came from", async () => {
    await openJob();
    await act(async () => fireEvent.click(button("Volver")));
    expect(await screen.findByRole("heading", { name: /Fiat Cronos 2021/ })).toBeInTheDocument();
    const row = (await screen.findByText("Cambio de aceite")).closest("li")!;
    await waitFor(() => expect(within(row).getByRole("button")).toHaveFocus());
  });

  it("closes the dialog with the X", async () => {
    await openJob();
    fireEvent.click(button("Cerrar"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes the dialog after archiving the job, with a toast", async () => {
    mocks.setJobArchived.mockResolvedValue({ ok: true, data: { ...JOB, enabled: false } });
    await openJob();
    fireEvent.click(button("Archivar"));
    const confirm = await screen.findByRole("alertdialog");
    await act(async () => fireEvent.click(within(confirm).getByRole("button", { name: "Archivar" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.toast).toHaveBeenCalledWith("Trabajo archivado", { description: "AB 123 CD, Fiat Cronos" });
  });
});
