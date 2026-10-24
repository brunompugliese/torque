import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DetailModal } from "@/components/shared/detail-modal";
import { renderWithIntl } from "@/test/render";

import type { JobDetail } from "../queries";
import type { JobItem, JobListItem } from "../schemas";

const mocks = vi.hoisted(() => ({
  setJobArchived: vi.fn(),
  getJobDetails: vi.fn(),
  setJobStatus: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("../actions", () => ({
  setJobArchived: mocks.setJobArchived,
  getJobDetails: mocks.getJobDetails,
  setJobStatus: mocks.setJobStatus,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { useJobModal, type JobFromHost, type JobModalMode } from "./use-job-modal";

const JOB: JobListItem = {
  id: "j1",
  status: "presupuesto_enviado",
  observations: "Ruido en la rueda\nPidió aceite 5W30.",
  kilometers: 68400,
  quotedTotal: 25001,
  finalTotal: null,
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
  updatedAt: "2026-10-14T15:00:00+00:00",
  vehicle: { id: "v1", plate: "AB123CD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
  client: { id: "c1", name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
  appointment: { id: "a1", date: "2026-10-20", time: "09:00", enabled: true },
};
const BARE: JobListItem = { ...JOB, kilometers: null, observations: null, client: null, appointment: null };

function item(overrides: Partial<JobItem>): JobItem {
  return {
    id: "i1",
    serviceId: "s1",
    serviceName: "Cambio de aceite",
    serviceEnabled: true,
    quantity: 2,
    quotedUnitPrice: 12500.5,
    finalUnitPrice: null,
    createdAt: "2026-10-13T15:00:00+00:00",
    ...overrides,
  };
}

const DETAIL: JobDetail = {
  ok: true,
  items: [item({}), item({ id: "i2", serviceId: "s2", serviceName: "Alineación", quantity: 1, quotedUnitPrice: 50000 })],
  history: [
    {
      id: "h2",
      oldStatus: "pendiente",
      newStatus: "presupuesto_enviado",
      changedAt: "2026-10-14T15:00:00+00:00",
      changedBy: "Usuario B",
    },
    { id: "h1", oldStatus: null, newStatus: "pendiente", changedAt: "2026-10-13T15:00:00+00:00", changedBy: "Usuario A" },
  ],
};

function Host(props: {
  mode: JobModalMode;
  job: JobListItem | null;
  onModeChange: (mode: JobModalMode, job?: JobListItem) => void;
  onClose: () => void;
  fromHost?: JobFromHost;
  readOnly?: boolean;
}) {
  const { content, confirmDialog } = useJobModal(props);
  if (!content) return null;
  return (
    <>
      <DetailModal open onOpenChange={() => {}} {...content} />
      {confirmDialog}
    </>
  );
}

function renderModal(job: JobListItem | null = JOB, extra: { fromHost?: JobFromHost; readOnly?: boolean } = {}) {
  const onModeChange = vi.fn();
  const onClose = vi.fn();
  renderWithIntl(<Host mode="view" job={job} onModeChange={onModeChange} onClose={onClose} {...extra} />);
  return { onModeChange, onClose };
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.toast.error = vi.fn();
  mocks.getJobDetails.mockResolvedValue(DETAIL);
});

describe("job modal header", () => {
  it("shows the plate drawn with brand, model and year, and no update time", async () => {
    renderModal();
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector('[data-slot="plate"]')).toHaveTextContent("AB 123 CD");
    expect(within(dialog).getByText("Fiat Cronos 2021")).toBeInTheDocument();
    expect(within(dialog).queryByText(/Actualizado/)).toBeNull();
    expect(within(dialog).queryByText("Archivado")).toBeNull();
  });

  it("leaves the year out when the vehicle has none, and badges an archived job", () => {
    renderModal({ ...JOB, enabled: false, vehicle: { ...JOB.vehicle, year: null } });
    expect(screen.getByText("Fiat Cronos")).toBeInTheDocument();
    expect(screen.getByText("Archivado")).toBeInTheDocument();
  });

  it("offers Archivar and Editar trabajo on an open job", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Archivar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar trabajo" })).toBeInTheDocument();
  });

  it("offers Desarchivar on an archived job", () => {
    renderModal({ ...JOB, enabled: false });
    expect(screen.getByRole("button", { name: "Desarchivar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archivar" })).toBeNull();
  });

  it.each([["entregado"], ["cancelado"]] as const)(
    "hides Editar trabajo on a %s job but keeps Archivar",
    (status) => {
      renderModal({ ...JOB, status });
      expect(screen.queryByRole("button", { name: "Editar trabajo" })).toBeNull();
      expect(screen.getByRole("button", { name: "Archivar" })).toBeInTheDocument();
    },
  );

  it("has no actions when read only", () => {
    renderModal(JOB, { readOnly: true });
    expect(screen.queryByRole("button", { name: "Archivar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desarchivar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar trabajo" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });

  it("goes to the edit form from Editar trabajo", () => {
    const { onModeChange } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Editar trabajo" }));
    expect(onModeChange).toHaveBeenCalledWith("edit");
  });

  it("shows nothing without a job", () => {
    renderModal(null);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("job modal status and actions", () => {
  const header = () => screen.getByRole("dialog").querySelector('[data-slot="dialog-title"]')!.closest<HTMLElement>(".border-b")!;

  it("has the status in the header, as a dropdown, and not among the details", () => {
    renderModal();
    expect(within(header()).getByRole("combobox", { name: "Cambiar estado: Presupuesto enviado" })).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).queryByText("Estado")).toBeNull();
  });

  it("shows a closed job's status with a lock inside the pill and no hint under the title", () => {
    renderModal({ ...JOB, status: "entregado" });
    expect(within(screen.getByRole("dialog")).queryByRole("combobox")).toBeNull();
    expect(within(header()).getByText("Entregado").querySelector("svg")).not.toBeNull();
    expect(within(header()).getByText("Cerrado, no se puede editar")).toHaveClass("sr-only");
  });

  it("shows an archived job's status as a plain pill, next to the Archivado badge", () => {
    renderModal({ ...JOB, enabled: false });
    expect(within(header()).queryByRole("combobox")).toBeNull();
    expect(within(header()).getByText("Archivado")).toBeInTheDocument();
  });

  it("shows a plain pill when the modal is read only", () => {
    renderModal(JOB, { readOnly: true });
    expect(within(screen.getByRole("dialog")).queryByRole("combobox")).toBeNull();
  });

  it("puts Archivar and Editar trabajo in the footer, not in the header", () => {
    renderModal();
    const footer = screen.getByText("Creado el 13/10/2026").parentElement!.parentElement!;
    expect(within(footer).getByRole("button", { name: "Archivar" })).toBeInTheDocument();
    expect(within(footer).getByRole("button", { name: "Editar trabajo" })).toBeInTheDocument();
    expect(within(header()).queryByRole("button", { name: "Archivar" })).toBeNull();
    expect(within(header()).queryByRole("button", { name: "Editar trabajo" })).toBeNull();
  });

  it("changes the status from the header, confirms with a toast and closes the modal", async () => {
    mocks.setJobStatus.mockResolvedValue({ ok: true, data: { ...JOB, status: "en_progreso" } });
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("combobox", { name: /Cambiar estado/ }));
    const option = await screen.findByRole("option", { name: "En progreso" });
    fireEvent.pointerDown(option);
    fireEvent.pointerUp(option);
    fireEvent.click(option);

    await waitFor(() => expect(mocks.setJobStatus).toHaveBeenCalledWith("j1", "en_progreso"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.toast).toHaveBeenCalledWith("Estado actualizado", { description: "AB 123 CD, Fiat Cronos" });
  });
});

describe("job modal details", () => {
  it("shows the client with phone and WhatsApp, km and observations, and no appointment", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByText("Presupuesto enviado").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Ana Gómez")).toBeInTheDocument();
    expect(within(dialog).getByText("11 1234-5678")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Escribir por WhatsApp" })).toBeInTheDocument();
    expect(within(dialog).getByText("68.400 km")).toBeInTheDocument();
    expect(within(dialog).queryByText("Turno")).toBeNull();
    expect(within(dialog).queryByText("20/10/2026 09:00 hs")).toBeNull();
    expect(within(dialog).getByText(/Ruido en la rueda/)).toBeInTheDocument();
    expect(within(dialog).queryByText("Cerrado, no se puede editar")).toBeNull();
  });

  it("does not show a responsable anywhere", () => {
    renderModal();
    expect(screen.queryByText(/Responsable/i)).toBeNull();
  });

  it("says what is missing in words", () => {
    renderModal(BARE);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Sin cliente")).toBeInTheDocument();
    expect(within(dialog).getByText("Sin cargar")).toBeInTheDocument();
    expect(within(dialog).queryByText("Turno")).toBeNull();
    expect(within(dialog).queryByText("Sin turno")).toBeNull();
    expect(within(dialog).getByText("Sin observaciones")).toBeInTheDocument();
  });

  it("marks an archived client", () => {
    renderModal({ ...JOB, client: { ...JOB.client!, enabled: false } });
    expect(within(screen.getByRole("dialog")).getByText("Archivado")).toBeInTheDocument();
  });

  it.each([["entregado"], ["cancelado"]] as const)("locks a %s job with a lock and the reason in words", (status) => {
    renderModal({ ...JOB, status });
    expect(within(screen.getByRole("dialog")).getByText("Cerrado, no se puede editar")).toBeInTheDocument();
  });

  it("shows when it was created, and Volver only inside another modal", () => {
    renderModal();
    expect(screen.getByText("Creado el 13/10/2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Volver" })).toBeNull();
  });

  it("goes back one step from Volver when it was opened from another modal", () => {
    const onBack = vi.fn();
    renderModal(JOB, { fromHost: { onBack } });
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe("job modal services and history", () => {
  it("loads both with the shared skeleton, announced once", async () => {
    let resolve!: (detail: JobDetail) => void;
    mocks.getJobDetails.mockReturnValue(new Promise<JobDetail>((done) => (resolve = done)));
    renderModal();
    expect(mocks.getJobDetails).toHaveBeenCalledWith("j1");
    expect(screen.getAllByText("Cargando…")).toHaveLength(2);
    expect(screen.queryByRole("table", { name: "Servicios" })).toBeNull();

    resolve(DETAIL);
    expect(await screen.findByRole("table", { name: "Servicios" })).toBeInTheDocument();
    expect(screen.queryByText("Cargando…")).toBeNull();
  });

  it("shows the quote phase: service, quantity and price, with the total in the last row", async () => {
    renderModal();
    const table = await screen.findByRole("table", { name: "Servicios" });
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Servicio",
      "Cant.",
      "Precio",
    ]);
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]).getByText("Cambio de aceite")).toBeInTheDocument();
    expect(within(rows[1]).getByText("$ 12.500,50")).toBeInTheDocument();
    expect(rows[rows.length - 1]).toHaveTextContent("Total");
    expect(rows[rows.length - 1]).toHaveTextContent("$ 75.001");
  });

  it("shows the work phase: quoted and final, with both totals", async () => {
    mocks.getJobDetails.mockResolvedValue({
      ...DETAIL,
      items: [item({ finalUnitPrice: 13000 }), item({ id: "i2", serviceName: "Alineación", quantity: 1, quotedUnitPrice: 50000, finalUnitPrice: 52000 })],
    });
    renderModal({ ...JOB, status: "en_progreso", finalTotal: 78000 });
    const table = await screen.findByRole("table", { name: "Servicios" });
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Servicio",
      "Cant.",
      "Presupuestado",
      "Final",
    ]);
    const last = within(table).getAllByRole("row").at(-1)!;
    expect(last).toHaveTextContent("$ 75.001");
    expect(last).toHaveTextContent("$ 78.000");
  });

  it("shows a cancelled job with the columns of the phase it was in", async () => {
    mocks.getJobDetails.mockResolvedValue({ ...DETAIL, items: [item({ finalUnitPrice: 13000 })] });
    renderModal({ ...JOB, status: "cancelado" });
    const table = await screen.findByRole("table", { name: "Servicios" });
    expect(within(table).getByRole("columnheader", { name: "Final" })).toBeInTheDocument();
  });

  it("marks an archived service and says when there are no services", async () => {
    mocks.getJobDetails.mockResolvedValue({ ...DETAIL, items: [item({ serviceEnabled: false })] });
    const { unmount } = renderWithIntl(
      <Host mode="view" job={JOB} onModeChange={vi.fn()} onClose={vi.fn()} />,
    );
    expect(await screen.findByText("Cambio de aceite (Archivado)")).toBeInTheDocument();
    unmount();

    mocks.getJobDetails.mockResolvedValue({ ...DETAIL, items: [] });
    renderModal();
    expect(await screen.findByText("Todavía no hay servicios cargados.")).toBeInTheDocument();
  });

  it("shows the status history as a list, newest first, with who and when", async () => {
    renderModal();
    const list = await screen.findByRole("list", { name: "Historial de estados" });
    const entries = within(list).getAllByRole("listitem");
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent("Presupuesto enviado");
    expect(entries[0]).not.toHaveTextContent("desde");
    expect(entries[0]).toHaveTextContent("Usuario B · 14/10/2026 12:00");
    expect(entries[1]).toHaveTextContent("Pendiente");
    expect(entries[1]).not.toHaveTextContent("creación");
    expect(entries[1]).toHaveTextContent("Usuario A · 13/10/2026 12:00");
  });

  it("shows an error with Reintentar for both when loading fails, and loads again", async () => {
    mocks.getJobDetails.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(DETAIL);
    renderModal();
    const retries = await screen.findAllByRole("button", { name: "Reintentar" });
    expect(retries).toHaveLength(2);
    fireEvent.click(retries[0]);
    expect(await screen.findByRole("table", { name: "Servicios" })).toBeInTheDocument();
    expect(mocks.getJobDetails).toHaveBeenCalledTimes(2);
  });

  it("treats a failed read as an error too", async () => {
    mocks.getJobDetails.mockResolvedValue({ ok: false });
    renderModal();
    expect(await screen.findAllByRole("button", { name: "Reintentar" })).toHaveLength(2);
  });
});

describe("archiving", () => {
  const SAVED = { ...JOB, enabled: false };

  it("asks first, then archives, closes the modal and toasts with the plate and vehicle", async () => {
    mocks.setJobArchived.mockResolvedValue({ ok: true, data: SAVED });
    const { onClose } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Archivar" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText("¿Archivar este trabajo?")).toBeInTheDocument();
    expect(within(confirm).getByText(/Su kilometraje deja de contar como último kilometraje del vehículo\./)).toBeInTheDocument();
    expect(mocks.setJobArchived).not.toHaveBeenCalled();

    await act(async () => fireEvent.click(within(confirm).getByRole("button", { name: "Archivar" })));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(mocks.setJobArchived).toHaveBeenCalledWith("j1", true);
    expect(mocks.toast).toHaveBeenCalledWith("Trabajo archivado", { description: "AB 123 CD, Fiat Cronos" });
  });

  it("keeps everything as it was when the confirmation is cancelled", async () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Archivar" }));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(mocks.setJobArchived).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("archives a closed job too", async () => {
    mocks.setJobArchived.mockResolvedValue({ ok: true, data: { ...SAVED, status: "entregado" } });
    const { onClose } = renderModal({ ...JOB, status: "entregado" });
    fireEvent.click(screen.getByRole("button", { name: "Archivar" }));
    const confirm = await screen.findByRole("alertdialog");
    await act(async () => fireEvent.click(within(confirm).getByRole("button", { name: "Archivar" })));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("unarchives right away, without asking", async () => {
    mocks.setJobArchived.mockResolvedValue({ ok: true, data: JOB });
    const { onClose } = renderModal({ ...JOB, enabled: false });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Desarchivar" })));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(mocks.setJobArchived).toHaveBeenCalledWith("j1", false);
    expect(mocks.toast).toHaveBeenCalledWith("Trabajo desarchivado", { description: "AB 123 CD, Fiat Cronos" });
  });

  it("stays open with an error toast when it fails", async () => {
    mocks.setJobArchived.mockResolvedValue({ ok: false, error: "unexpected" });
    const { onClose } = renderModal({ ...JOB, enabled: false });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Desarchivar" })));
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Algo salió mal. Probá de nuevo."));
    expect(onClose).not.toHaveBeenCalled();
  });
});
