import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DetailModal } from "@/components/shared/detail-modal";
import { chooseOption } from "@/test/combobox";
import { renderWithIntl } from "@/test/render";
import { pressOption } from "@/test/select";

import type { AppointmentListItem } from "../schemas";

const mocks = vi.hoisted(() => ({
  createAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  setAppointmentStatus: vi.fn(),
  createJobFromAppointment: vi.fn(),
  getJobRow: vi.fn(),
  getJobDetails: vi.fn(),
  getOwnerOfVehicle: vi.fn(),
  searchVehicleOptions: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("../actions", () => ({
  createAppointment: mocks.createAppointment,
  updateAppointment: mocks.updateAppointment,
  setAppointmentStatus: mocks.setAppointmentStatus,
  createJobFromAppointment: mocks.createJobFromAppointment,
}));
vi.mock("@/features/job/actions", () => ({
  getJobRow: mocks.getJobRow,
  getJobDetails: mocks.getJobDetails,
  getOwnerOfVehicle: mocks.getOwnerOfVehicle,
  setJobArchived: vi.fn(),
  setJobStatus: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
  getVehicleKmFloor: vi.fn(async () => ({ ok: true, floor: null })),
  getServiceOptions: vi.fn(async () => ({ ok: true, rows: [] })),
}));
vi.mock("@/features/vehicle/actions", () => ({ searchVehicleOptions: mocks.searchVehicleOptions }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { useAppointmentModal, type AppointmentModalMode } from "./use-appointment-modal";

const CRONOS = "aa1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const GOL = "ab1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ANA = "cc1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JOB_ID = "ff1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const VEHICLE_ROWS = [
  { id: CRONOS, plate: "AE482KD", brandName: "Fiat", modelName: "Cronos", enabled: true },
  { id: GOL, plate: "AB123CD", brandName: "Volkswagen", modelName: "Gol", enabled: true },
];

const APPOINTMENT: AppointmentListItem = {
  id: "a1",
  date: "2026-10-14",
  time: "09:00",
  reason: "Ruido al frenar\nRevisar pastillas",
  status: "pendiente",
  createdAt: "2026-10-13T15:00:00+00:00",
  vehicle: { id: CRONOS, plate: "AE482KD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
  client: { id: ANA, name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
  jobId: null,
};

const JOB_ROW = {
  id: JOB_ID,
  status: "pendiente" as const,
  observations: null,
  kilometers: null,
  quotedTotal: null,
  finalTotal: null,
  enabled: true,
  createdAt: "2026-10-14T15:00:00+00:00",
  updatedAt: "2026-10-14T15:00:00+00:00",
  vehicle: APPOINTMENT.vehicle,
  client: APPOINTMENT.client,
  appointment: { id: "a1", date: "2026-10-14", time: "09:00", enabled: true },
};

type HostProps = {
  mode: AppointmentModalMode;
  appointment: AppointmentListItem | null;
  jobId?: string | null;
  createDate?: string;
  onModeChange: (mode: AppointmentModalMode, jobId?: string) => void;
  onClose: () => void;
  onSaved: (saved: AppointmentListItem) => void;
};

function Host({ jobId = null, createDate = "2026-10-20", ...props }: HostProps) {
  const { content, confirmDialog } = useAppointmentModal({ jobId, createDate, ...props });
  if (!content) return null;
  return (
    <>
      <DetailModal open onOpenChange={() => {}} {...content} />
      {confirmDialog}
    </>
  );
}

function renderModal(
  mode: AppointmentModalMode,
  appointment: AppointmentListItem | null = APPOINTMENT,
  extra: Partial<HostProps> = {},
) {
  const onModeChange = vi.fn();
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const view = renderWithIntl(
    <Host mode={mode} appointment={appointment} onModeChange={onModeChange} onClose={onClose} onSaved={onSaved} {...extra} />,
  );
  return { onModeChange, onClose, onSaved, unmount: view.unmount };
}

// A dropdown lists its options once the first search answered, as for a person who looks at it.
async function optionsLoaded() {
  await waitFor(() => expect(mocks.searchVehicleOptions).toHaveBeenCalled());
  await act(async () => {});
}

async function pickVehicle() {
  await optionsLoaded();
  await chooseOption(screen.getByLabelText(/^Vehículo/), "ae", /Fiat Cronos/);
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.toast.error = vi.fn();
  mocks.searchVehicleOptions.mockResolvedValue({ ok: true, rows: VEHICLE_ROWS });
  mocks.getOwnerOfVehicle.mockImplementation(async (vehicleId: string) => ({
    ok: true,
    owner: vehicleId === GOL ? null : { id: ANA, name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
  }));
  mocks.getJobRow.mockResolvedValue({ ok: true, row: JOB_ROW });
  mocks.getJobDetails.mockResolvedValue({ ok: true, items: [], history: [] });
});

describe("appointment modal: view", () => {
  it("titles itself with the date and the time and shows the status as a dropdown pill", () => {
    renderModal("view");
    expect(screen.getByRole("heading", { name: "14/10/2026 · 09:00 hs" })).toBeInTheDocument();
    const pill = screen.getByRole("combobox", { name: "Cambiar estado: Pendiente" });
    expect(within(pill).getByText("Pendiente")).toHaveClass("bg-status-pending");
    expect(screen.queryByText("Archivado")).toBeNull();
  });

  it("shows the client, the vehicle with its plate, the reason and the job", () => {
    renderModal("view");
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Escribir por WhatsApp" })).toBeInTheDocument();
    expect(screen.getByText("Fiat Cronos 2021")).toBeInTheDocument();
    expect(screen.getByText("AE 482 KD")).toBeInTheDocument();
    expect(screen.getByText(/Ruido al frenar/)).toHaveTextContent("Revisar pastillas");
    expect(screen.getByRole("button", { name: "Crear trabajo" })).toBeInTheDocument();
  });

  it("says what is missing", () => {
    renderModal("view", { ...APPOINTMENT, client: null, reason: null });
    expect(screen.getByText("Sin cliente")).toBeInTheDocument();
    expect(screen.getByText("Sin motivo")).toBeInTheDocument();
  });

  it("marks an archived vehicle", () => {
    renderModal("view", { ...APPOINTMENT, vehicle: { ...APPOINTMENT.vehicle, enabled: false } });
    expect(screen.getByText("Archivado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear trabajo" })).toBeDisabled();
  });

  it("has 'Creado el' in the footer and no archive action", () => {
    renderModal("view");
    expect(screen.getByText("Creado el 13/10/2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Archivar/ })).toBeNull();
  });

  it("has only 'Editar turno' in the footer, and no 'Volver'", () => {
    renderModal("view");
    expect(screen.getByRole("button", { name: "Editar turno" })).toBeInTheDocument();
    for (const name of ["Volver", "Confirmar turno", "Completar turno", "Cancelar turno", "Reactivar turno"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("changes to any status from the pill and closes the whole modal", async () => {
    mocks.setAppointmentStatus.mockResolvedValue({ ok: true, data: { ...APPOINTMENT, status: "completado" } });
    const { onClose } = renderModal("view");

    fireEvent.click(screen.getByRole("combobox", { name: "Cambiar estado: Pendiente" }));
    pressOption(await screen.findByRole("option", { name: "Completado" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.setAppointmentStatus).toHaveBeenCalledWith("a1", "completado");
    expect(mocks.toast).toHaveBeenCalledWith("Turno completado", { description: "Fiat Cronos, 14/10/2026 a las 09:00 hs" });
  });

  it("lets a cancelled appointment jump to any status, without asking", async () => {
    mocks.setAppointmentStatus.mockResolvedValue({ ok: true, data: { ...APPOINTMENT, status: "confirmado" } });
    const { onClose } = renderModal("view", { ...APPOINTMENT, status: "cancelado" });

    fireEvent.click(screen.getByRole("combobox", { name: "Cambiar estado: Cancelado" }));
    pressOption(await screen.findByRole("option", { name: "Confirmado" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.setAppointmentStatus).toHaveBeenCalledWith("a1", "confirmado");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("says 'Estado actualizado' when it goes back to Pendiente", async () => {
    mocks.setAppointmentStatus.mockResolvedValue({ ok: true, data: APPOINTMENT });
    renderModal("view", { ...APPOINTMENT, status: "confirmado" });

    fireEvent.click(screen.getByRole("combobox", { name: "Cambiar estado: Confirmado" }));
    pressOption(await screen.findByRole("option", { name: "Pendiente" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("Estado actualizado", expect.anything()));
  });

  it("asks before cancelling from the pill, and changes nothing if it is dismissed", async () => {
    const { onClose } = renderModal("view");

    fireEvent.click(screen.getByRole("combobox", { name: "Cambiar estado: Pendiente" }));
    pressOption(await screen.findByRole("option", { name: "Cancelado" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("¿Cancelar el turno?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(mocks.setAppointmentStatus).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancels once the question is confirmed", async () => {
    mocks.setAppointmentStatus.mockResolvedValue({ ok: true, data: { ...APPOINTMENT, status: "cancelado" } });
    const { onClose } = renderModal("view");

    fireEvent.click(screen.getByRole("combobox", { name: "Cambiar estado: Pendiente" }));
    pressOption(await screen.findByRole("option", { name: "Cancelado" }));
    const dialog = await screen.findByRole("alertdialog");
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar turno" })));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.setAppointmentStatus).toHaveBeenCalledWith("a1", "cancelado");
  });

  it("keeps the old status and says so when the change fails", async () => {
    mocks.setAppointmentStatus.mockResolvedValue({ ok: false, error: "unexpected" });
    const { onClose } = renderModal("view");

    fireEvent.click(screen.getByRole("combobox", { name: "Cambiar estado: Pendiente" }));
    pressOption(await screen.findByRole("option", { name: "Confirmado" }));

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Algo salió mal. Probá de nuevo."));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox", { name: "Cambiar estado: Pendiente" })).toBeInTheDocument();
  });

  it("goes to the edit form", () => {
    const { onModeChange } = renderModal("view");
    fireEvent.click(screen.getByRole("button", { name: "Editar turno" }));
    expect(onModeChange).toHaveBeenCalledWith("edit");
  });

  it("opens the job as a step", () => {
    const { onModeChange } = renderModal("view", { ...APPOINTMENT, jobId: JOB_ID });
    fireEvent.click(screen.getByRole("button", { name: "Ver trabajo" }));
    expect(onModeChange).toHaveBeenCalledWith("job-view", JOB_ID);
  });
});

describe("appointment modal: the job step", () => {
  it("shows the job's modal with 'Volver' back to the appointment", async () => {
    const { onModeChange } = renderModal("job-view", { ...APPOINTMENT, jobId: JOB_ID }, { jobId: JOB_ID });

    // Its list row loads behind the shared skeleton.
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    expect(await screen.findByText("Fiat Cronos 2021")).toBeInTheDocument();
    expect(mocks.getJobRow).toHaveBeenCalledWith(JOB_ID);

    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(onModeChange).toHaveBeenCalledWith("view");
  });

  it("offers 'Volver' and 'Reintentar' when the job can't be loaded", async () => {
    mocks.getJobRow.mockResolvedValue({ ok: false });
    const { onModeChange } = renderModal("job-view", { ...APPOINTMENT, jobId: JOB_ID }, { jobId: JOB_ID });

    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(onModeChange).toHaveBeenCalledWith("view");
  });
});

describe("appointment modal: create", () => {
  it("opens the form on the clicked day, with no time and Pendiente implied", () => {
    renderModal("create", null, { createDate: "2026-10-20" });
    expect(screen.getByRole("heading", { name: "Nuevo turno" })).toBeInTheDocument();
    expect(screen.getByText("Los campos con * son obligatorios.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Fecha/)).toHaveValue("2026-10-20");
    expect(screen.getByLabelText(/^Hora/)).toHaveValue("");
    expect(screen.queryByLabelText("Estado")).toBeNull();
    expect(screen.getByRole("button", { name: "Agregar turno" })).toBeInTheDocument();
  });

  it("'Cancelar' closes it", () => {
    const { onClose } = renderModal("create", null);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("saves, toasts, closes and tells the calendar where to go", async () => {
    const saved = { ...APPOINTMENT, date: "2026-10-20", time: "10:30" };
    mocks.createAppointment.mockResolvedValue({ ok: true, data: saved });
    const { onClose, onSaved } = renderModal("create", null, { createDate: "2026-10-20" });

    await pickVehicle();
    fireEvent.change(screen.getByLabelText(/^Hora/), { target: { value: "10:30" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Agregar turno" })));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.createAppointment).toHaveBeenCalledWith({
      vehicleId: CRONOS,
      date: "2026-10-20",
      time: "10:30",
      status: "pendiente",
      reason: null,
    });
    expect(mocks.toast).toHaveBeenCalledWith("Turno agregado", { description: "Fiat Cronos, 20/10/2026 a las 10:30 hs" });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("stays open with the server's field error", async () => {
    mocks.createAppointment.mockResolvedValue({
      ok: false,
      error: "vehicleArchived",
      fieldErrors: { vehicleId: "vehicleArchived" },
    });
    const { onClose, onSaved } = renderModal("create", null);

    await pickVehicle();
    fireEvent.change(screen.getByLabelText(/^Hora/), { target: { value: "08:00" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Agregar turno" })));

    expect(await screen.findByText("Este vehículo está archivado y no puede tener turnos nuevos.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe("appointment modal: edit", () => {
  it("prefills the form and names the appointment above the subtitle", () => {
    renderModal("edit");
    expect(screen.getByRole("heading", { name: "Editar turno" })).toBeInTheDocument();
    expect(screen.getByText("14/10/2026 · 09:00 hs", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Vehículo/)).toHaveValue("Fiat Cronos (AE 482 KD)");
    expect(screen.getByLabelText(/^Fecha/)).toHaveValue("2026-10-14");
    expect(screen.getByLabelText(/^Hora/)).toHaveValue("09:00");
    expect(screen.getByLabelText("Estado")).toHaveTextContent("Pendiente");
    expect(screen.getByLabelText("Motivo")).toHaveValue("Ruido al frenar\nRevisar pastillas");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
  });

  it("'Cancelar' goes back to the appointment", () => {
    const { onModeChange } = renderModal("edit");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onModeChange).toHaveBeenCalledWith("view");
  });

  it("goes back without a request or a toast when nothing changed", async () => {
    const { onModeChange, onClose } = renderModal("edit");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" })));
    await waitFor(() => expect(onModeChange).toHaveBeenCalledWith("view"));
    expect(mocks.updateAppointment).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("saves the change, toasts, closes and tells the calendar", async () => {
    const saved = { ...APPOINTMENT, reason: "Otro motivo" };
    mocks.updateAppointment.mockResolvedValue({ ok: true, data: saved });
    const { onClose, onSaved } = renderModal("edit");

    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Otro motivo" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" })));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.updateAppointment).toHaveBeenCalledWith("a1", expect.objectContaining({ reason: "Otro motivo" }));
    expect(mocks.toast).toHaveBeenCalledWith("Cambios guardados", expect.anything());
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it("asks before saving the appointment as cancelled", async () => {
    mocks.updateAppointment.mockResolvedValue({ ok: true, data: { ...APPOINTMENT, status: "cancelado" } });
    const { onClose } = renderModal("edit");

    fireEvent.click(screen.getByLabelText("Estado"));
    pressOption(await screen.findByRole("option", { name: "Cancelado" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" })));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("¿Cancelar el turno?");
    expect(mocks.updateAppointment).not.toHaveBeenCalled();

    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar turno" })));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mocks.updateAppointment).toHaveBeenCalledWith("a1", expect.objectContaining({ status: "cancelado" }));
  });
});
