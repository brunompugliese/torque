import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import type { AppointmentListItem } from "../schemas";

const mocks = vi.hoisted(() => ({
  createJobFromAppointment: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("../actions", () => ({ createJobFromAppointment: mocks.createJobFromAppointment }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { AppointmentJob } from "./appointment-job";

const APPOINTMENT: AppointmentListItem = {
  id: "a1",
  date: "2026-10-14",
  time: "09:00",
  reason: null,
  status: "pendiente",
  createdAt: "2026-10-13T15:00:00+00:00",
  vehicle: { id: "v1", plate: "AE482KD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
  client: null,
  jobId: null,
};

const JOB = {
  ok: true,
  data: { vehicle: { plate: "AE482KD", brandName: "Fiat", modelName: "Cronos" } },
};

function renderJob(overrides: Partial<AppointmentListItem> = {}) {
  const onView = vi.fn();
  const onCreated = vi.fn();
  renderWithIntl(<AppointmentJob appointment={{ ...APPOINTMENT, ...overrides }} onView={onView} onCreated={onCreated} />);
  return { onView, onCreated };
}

beforeEach(() => {
  mocks.createJobFromAppointment.mockReset();
  mocks.toast.mockReset();
  mocks.toast.error = vi.fn();
});

describe("AppointmentJob", () => {
  it("opens the appointment's job when it has one", () => {
    const { onView } = renderJob({ jobId: "j1" });
    fireEvent.click(screen.getByRole("button", { name: "Ver trabajo" }));
    expect(onView).toHaveBeenCalledWith("j1");
    expect(screen.queryByRole("button", { name: "Crear trabajo" })).toBeNull();
  });

  it("still shows the job of a cancelled appointment", () => {
    renderJob({ jobId: "j1", status: "cancelado" });
    expect(screen.getByRole("button", { name: "Ver trabajo" })).toBeInTheDocument();
  });

  it("creates a job straight away, with a toast, when it has none", async () => {
    mocks.createJobFromAppointment.mockResolvedValue(JOB);
    const { onCreated } = renderJob();

    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(mocks.createJobFromAppointment).toHaveBeenCalledWith("a1");
    expect(mocks.toast).toHaveBeenCalledWith("Trabajo agregado", { description: "AE 482 KD, Fiat Cronos" });
  });

  it("is busy while the job is created", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.createJobFromAppointment.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderJob();

    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));

    const busy = await screen.findByRole("button", { name: "Creando…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    finish({ ok: false, error: "unexpected" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear trabajo" })).toBeEnabled());
  });

  it("offers no new job for a cancelled appointment", () => {
    renderJob({ status: "cancelado" });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("disables the button, with the reason, when the vehicle is archived", () => {
    renderJob({ vehicle: { ...APPOINTMENT.vehicle, enabled: false } });
    const button = screen.getByRole("button", { name: "Crear trabajo" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("El vehículo está archivado.");
    fireEvent.click(button);
    expect(mocks.createJobFromAppointment).not.toHaveBeenCalled();
  });

  it.each([
    ["cancelled", "Un turno cancelado no puede tener trabajos nuevos."],
    ["vehicleArchived", "Este vehículo está archivado y no puede tener turnos nuevos."],
    ["notFound", "Este turno ya no existe. Actualizá la página."],
    ["kmBelowPrevious", "Algo salió mal. Probá de nuevo."],
  ])("keeps the modal open and says why when it fails with %s", async (error, message) => {
    mocks.createJobFromAppointment.mockResolvedValue({ ok: false, error });
    const { onCreated } = renderJob();

    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith(message));
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("treats a rejected request as a failure", async () => {
    mocks.createJobFromAppointment.mockRejectedValue(new Error("offline"));
    const { onCreated } = renderJob();

    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Algo salió mal. Probá de nuevo."));
    expect(onCreated).not.toHaveBeenCalled();
  });
});
