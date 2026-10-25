import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DetailModal } from "@/components/shared/detail-modal";
import { chooseOption, typeInCombobox } from "@/test/combobox";
import { renderWithIntl } from "@/test/render";

import type { JobItem, JobListItem } from "../schemas";

const mocks = vi.hoisted(() => ({
  createJob: vi.fn(),
  updateJob: vi.fn(),
  setJobArchived: vi.fn(),
  getJobDetails: vi.fn(),
  searchVehicleOptions: vi.fn(),
  getOwnerOfVehicle: vi.fn(),
  getVehicleKmFloor: vi.fn(),
  getServiceOptions: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("../actions", () => ({
  createJob: mocks.createJob,
  updateJob: mocks.updateJob,
  setJobArchived: mocks.setJobArchived,
  getJobDetails: mocks.getJobDetails,
  getOwnerOfVehicle: mocks.getOwnerOfVehicle,
  getVehicleKmFloor: mocks.getVehicleKmFloor,
  getServiceOptions: mocks.getServiceOptions,
}));
vi.mock("@/features/vehicle/actions", () => ({ searchVehicleOptions: mocks.searchVehicleOptions }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { useJobModal, type JobFromHost, type JobModalMode } from "./use-job-modal";

const CRONOS = "aa1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const GOL = "ab1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ANA = "cc1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ACEITE = "dd1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ALINEACION = "de1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const FRENOS = "df1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const APPOINTMENT = "ee1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const JOB_ID = "ff1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ITEM_ID = "fe1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const VEHICLE_ROWS = [
  { id: CRONOS, plate: "AE482KD", brandName: "Fiat", modelName: "Cronos", enabled: true },
  { id: GOL, plate: "AB123CD", brandName: "Volkswagen", modelName: "Gol", enabled: true },
];

const JOB: JobListItem = {
  id: JOB_ID,
  status: "presupuesto_enviado",
  observations: "Ruido en la rueda",
  kilometers: 68400,
  quotedTotal: 25001,
  finalTotal: null,
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
  updatedAt: "2026-10-14T15:00:00+00:00",
  vehicle: { id: CRONOS, plate: "AE482KD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
  client: { id: ANA, name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
  appointment: { id: APPOINTMENT, date: "2026-10-20", time: "09:00", enabled: true },
};
const ITEM: JobItem = {
  id: ITEM_ID,
  serviceId: ACEITE,
  serviceName: "Cambio de aceite",
  serviceEnabled: true,
  quantity: 2,
  quotedUnitPrice: 12500.5,
  finalUnitPrice: null,
  createdAt: "2026-10-13T15:00:00+00:00",
};

function Host(props: {
  mode: JobModalMode;
  job: JobListItem | null;
  onModeChange: (mode: JobModalMode, job?: JobListItem) => void;
  onClose: () => void;
  fromHost?: JobFromHost;
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

function renderModal(mode: JobModalMode, job: JobListItem | null = null, fromHost?: JobFromHost) {
  const onModeChange = vi.fn();
  const onClose = vi.fn();
  renderWithIntl(<Host mode={mode} job={job} onModeChange={onModeChange} onClose={onClose} fromHost={fromHost} />);
  return { onModeChange, onClose };
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.toast.error = vi.fn();
  mocks.searchVehicleOptions.mockResolvedValue({ ok: true, rows: VEHICLE_ROWS });
  mocks.getOwnerOfVehicle.mockImplementation(async (vehicleId: string) => ({
    ok: true,
    owner:
      vehicleId === CRONOS
        ? { id: ANA, name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true }
        : null,
  }));
  mocks.getVehicleKmFloor.mockImplementation(async (vehicleId: string) => ({
    ok: true,
    floor: vehicleId === CRONOS ? 68400 : null,
  }));
  mocks.getServiceOptions.mockResolvedValue({
    ok: true,
    rows: [
      { id: ACEITE, name: "Cambio de aceite", enabled: true },
      { id: ALINEACION, name: "Alineación", enabled: true },
      { id: FRENOS, name: "Frenos", enabled: false },
    ],
  });
  mocks.getJobDetails.mockResolvedValue({ ok: true, items: [ITEM], history: [] });
});

const field = (name: string | RegExp) => screen.getByLabelText(name);
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const save = async (name: string) => act(async () => fireEvent.click(await screen.findByRole("button", { name })));

// A dropdown lists its options once the first search answered, as for a person who looks at it.
async function optionsLoaded(search: ReturnType<typeof vi.fn>) {
  await waitFor(() => expect(search).toHaveBeenCalled());
  await act(async () => {});
}

// Picks a vehicle from the dropdown and waits for what that triggers.
async function pickVehicle(label = "Fiat Cronos", term = "ae") {
  await optionsLoaded(mocks.searchVehicleOptions);
  await chooseOption(field(/^Vehículo/), term, new RegExp(label));
  await waitFor(() => expect(mocks.getVehicleKmFloor).toHaveBeenCalled());
}

// A Select option is chosen on pointer release, as a mouse does it.
function pressOption(option: HTMLElement) {
  fireEvent.pointerDown(option);
  fireEvent.mouseDown(option);
  fireEvent.pointerUp(option);
  fireEvent.mouseUp(option);
  fireEvent.click(option);
}

// Opens a Select by its label and chooses an option.
async function chooseFromSelect(label: RegExp, optionName: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  pressOption(await screen.findByRole("option", { name: optionName }));
}

const chooseStatus = (name: string) => chooseFromSelect(/Estado/, name);

describe("new job form", () => {
  it("opens titled Nuevo trabajo with the required-fields note, the fields in order and no responsable", () => {
    renderModal("create");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Nuevo trabajo")).toBeInTheDocument();
    expect(within(dialog).getByText("Los campos con * son obligatorios.")).toBeInTheDocument();
    const labels = within(dialog)
      .getAllByText(/^(Vehículo|Cliente|Estado|Kilometraje|Turno|Observaciones|Servicios)/, { selector: "label, h3" })
      .map((node) => node.textContent);
    expect(labels).toEqual(["Vehículo *", "Cliente", "Estado *", "Kilometraje", "Observaciones", "Servicios"]);
    expect(screen.queryByText("Turno")).toBeNull();
    expect(screen.queryByText(/Responsable/i)).toBeNull();
    expect(button("Cancelar")).toBeInTheDocument();
    expect(button("Agregar trabajo")).toBeInTheDocument();
  });

  it("starts in Pendiente, with no km", () => {
    renderModal("create");
    expect(screen.getByRole("combobox", { name: /Estado/ })).toHaveTextContent("Pendiente");
    expect(field("Kilometraje")).toHaveValue("");
  });

  it("cancels by closing", () => {
    const { onClose } = renderModal("create");
    fireEvent.click(button("Cancelar"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("goes back one step on Cancelar when opened from another modal", () => {
    const onBack = vi.fn();
    const { onClose } = renderModal("create", null, { onBack });
    fireEvent.click(button("Cancelar"));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  describe("vehicle", () => {
    it("asks for it, with the focus on the field", async () => {
      renderModal("create");
      await save("Agregar trabajo");
      expect(await screen.findByText("Elegí el vehículo.")).toBeInTheDocument();
      expect(field(/^Vehículo/)).toHaveFocus();
      expect(mocks.createJob).not.toHaveBeenCalled();
    });

    it("rejects text that matches no vehicle", async () => {
      renderModal("create");
      await optionsLoaded(mocks.searchVehicleOptions);
      typeInCombobox(field(/^Vehículo/), "zzz");
      // An open list makes the rest of the page inert: close it, as a person would.
      fireEvent.keyDown(field(/^Vehículo/), { key: "Escape" });
      await save("Agregar trabajo");
      expect(await screen.findByText("Elegí un vehículo de la lista.")).toBeInTheDocument();
    });

    it("lists the vehicle with its plate in grey and shows both once chosen", async () => {
      renderModal("create");
      await optionsLoaded(mocks.searchVehicleOptions);
      typeInCombobox(field(/^Vehículo/), "ae");
      const option = await screen.findByRole("option", { name: /Fiat Cronos/ });
      expect(within(option).getByText("AE 482 KD")).toHaveClass("text-muted-foreground");
      fireEvent.click(option);
      await waitFor(() => expect(field(/^Vehículo/)).toHaveValue("Fiat Cronos (AE 482 KD)"));
    });

    it("searches the server with the typed text, in the request body", async () => {
      renderModal("create");
      typeInCombobox(field(/^Vehículo/), "gol");
      await waitFor(() => expect(mocks.searchVehicleOptions).toHaveBeenCalledWith("gol", undefined));
    });
  });

  describe("choosing a vehicle", () => {
    it("shows the vehicle's owner as the client and prefills the km with the latest", async () => {
      renderModal("create");
      await pickVehicle();

      await waitFor(() => expect(field("Cliente")).toHaveValue("Ana Gómez"));
      expect(screen.queryByText("Por defecto, el dueño del vehículo.")).toBeNull();
      await waitFor(() => expect(field("Kilometraje")).toHaveValue("68.400"));
      expect(screen.getByText("Último registrado: 68.400 km")).toBeInTheDocument();
      expect(mocks.getVehicleKmFloor).toHaveBeenCalledWith(CRONOS, undefined);
    });

    it("can't be changed: the client is a read-only field, with no list and no quick create", async () => {
      renderModal("create");
      expect(field("Cliente")).toHaveAttribute("readonly");
      expect(field("Cliente")).not.toHaveAttribute("role", "combobox");
      await pickVehicle();
      await waitFor(() => expect(field("Cliente")).toHaveValue("Ana Gómez"));
      expect(field("Cliente")).toHaveAttribute("readonly");
      expect(screen.queryByRole("option", { name: /Crear cliente nuevo/ })).toBeNull();
      expect(screen.queryByRole("region", { name: "Cliente nuevo" })).toBeNull();
    });

    it("tells, before saving, that an archived owner leaves the job without a client", async () => {
      mocks.getOwnerOfVehicle.mockResolvedValue({
        ok: true,
        owner: { id: ANA, name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: false },
      });
      mocks.createJob.mockResolvedValue({ ok: true, data: JOB });
      renderModal("create");
      await pickVehicle();

      await waitFor(() => expect(field("Cliente")).toHaveValue("Sin cliente"));
      const hint = screen.getByText("El dueño del vehículo (Ana Gómez) está archivado: el trabajo se guarda sin cliente.");
      expect(field("Cliente")).toHaveAccessibleDescription(hint.textContent ?? "");
      await save("Agregar trabajo");
      await waitFor(() => expect(mocks.createJob).toHaveBeenCalled());
      expect(mocks.createJob.mock.calls[0][0].clientId).toBeNull();
    });

    it("shows Sin cliente when the vehicle has no owner, and clears the km", async () => {
      renderModal("create");
      await pickVehicle();
      await waitFor(() => expect(field("Kilometraje")).toHaveValue("68.400"));

      await pickVehicle("Volkswagen Gol", "gol");
      await waitFor(() => expect(field("Kilometraje")).toHaveValue(""));
      await waitFor(() => expect(field("Cliente")).toHaveValue("Sin cliente"));
      expect(screen.queryByText(/Último registrado/)).toBeNull();
      expect(screen.queryByText(/archivado/)).toBeNull();
    });

    it("keeps the km the user typed when the vehicle changes", async () => {
      renderModal("create");
      await pickVehicle();
      await waitFor(() => expect(field("Kilometraje")).toHaveValue("68.400"));
      fireEvent.change(field("Kilometraje"), { target: { value: "70000" } });
      expect(field("Kilometraje")).toHaveValue("70.000");

      await pickVehicle("Volkswagen Gol", "gol");
      await waitFor(() => expect(mocks.getVehicleKmFloor).toHaveBeenCalledWith(GOL, undefined));
      expect(field("Kilometraje")).toHaveValue("70.000");
    });

  });

  describe("kilometers", () => {
    it("takes only digits and shows dot thousands", () => {
      renderModal("create");
      fireEvent.change(field("Kilometraje"), { target: { value: "1a2b3456" } });
      expect(field("Kilometraje")).toHaveValue("123.456");
    });

    it("refuses a km below the latest, saying which, with the focus on the field", async () => {
      renderModal("create");
      await pickVehicle();
      await waitFor(() => expect(field("Kilometraje")).toHaveValue("68.400"));
      fireEvent.change(field("Kilometraje"), { target: { value: "1000" } });
      await save("Agregar trabajo");

      expect(await screen.findByText("No puede ser menor que el último kilometraje registrado (68.400 km).")).toBeInTheDocument();
      expect(field("Kilometraje")).toHaveFocus();
      expect(mocks.createJob).not.toHaveBeenCalled();
    });

    it("accepts the latest km itself", async () => {
      mocks.createJob.mockResolvedValue({ ok: true, data: JOB });
      renderModal("create");
      await pickVehicle();
      await waitFor(() => expect(field("Kilometraje")).toHaveValue("68.400"));
      await save("Agregar trabajo");
      await waitFor(() => expect(mocks.createJob).toHaveBeenCalled());
      expect(mocks.createJob.mock.calls[0][0]).toMatchObject({ kilometers: 68400 });
    });
  });

  describe("status", () => {
    it("shows the closing warning for Entregado and Cancelado only", async () => {
      renderModal("create");
      expect(screen.queryByText(/queda cerrado/)).toBeNull();
      await chooseStatus("Entregado");
      expect(screen.getByText(/Al guardar como entregado/).closest('[role="status"]')).toHaveTextContent(
        "Al guardar como entregado, el trabajo queda cerrado y no se va a poder editar más.",
      );
      await chooseStatus("Cancelado");
      expect(screen.getByText(/Al guardar como cancelado/)).toBeInTheDocument();
      await chooseStatus("En progreso");
      expect(screen.queryByText(/queda cerrado/)).toBeNull();
    });

    it("asks before closing, and does nothing on Cancelar", async () => {
      mocks.createJob.mockResolvedValue({ ok: true, data: JOB });
      renderModal("create");
      await pickVehicle();
      await chooseStatus("Entregado");
      await save("Agregar trabajo");

      const confirm = await screen.findByRole("alertdialog");
      expect(within(confirm).getByText("¿Cerrar el trabajo?")).toBeInTheDocument();
      expect(within(confirm).getByText("Va a quedar como entregado y no se va a poder editar más.")).toBeInTheDocument();
      fireEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
      expect(mocks.createJob).not.toHaveBeenCalled();
    });

    it("saves once the closing is confirmed", async () => {
      mocks.createJob.mockResolvedValue({ ok: true, data: JOB });
      const { onClose } = renderModal("create");
      await pickVehicle();
      await chooseStatus("Cancelado");
      await save("Agregar trabajo");
      const confirm = await screen.findByRole("alertdialog");
      expect(within(confirm).getByText("Va a quedar como cancelado y no se va a poder editar más.")).toBeInTheDocument();
      await act(async () => fireEvent.click(within(confirm).getByRole("button", { name: "Guardar y cerrar" })));
      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
      expect(mocks.createJob.mock.calls[0][0]).toMatchObject({ status: "cancelado" });
    });

    it("asks nothing for an open status", async () => {
      mocks.createJob.mockResolvedValue({ ok: true, data: JOB });
      renderModal("create");
      await pickVehicle();
      await chooseStatus("Presupuesto aceptado");
      await save("Agregar trabajo");
      await waitFor(() => expect(mocks.createJob).toHaveBeenCalled());
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  });

  describe("saving", () => {
    it("creates the job, toasts with the plate and vehicle, and closes the modal", async () => {
      mocks.createJob.mockResolvedValue({ ok: true, data: JOB });
      const { onClose } = renderModal("create");
      await pickVehicle();
      await waitFor(() => expect(field("Cliente")).toHaveValue("Ana Gómez"));
      fireEvent.change(field("Observaciones"), { target: { value: "  Cambiar pastillas " } });
      await save("Agregar trabajo");

      await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
      expect(mocks.createJob.mock.calls[0][0]).toEqual({
        vehicleId: CRONOS,
        clientId: ANA,
        status: "pendiente",
        kilometers: 68400,
        appointmentId: null,
        observations: "Cambiar pastillas",
        items: [],
      });
      expect(mocks.toast).toHaveBeenCalledWith("Trabajo agregado", { description: "AE 482 KD, Fiat Cronos" });
    });

    it("can be saved without services", async () => {
      mocks.createJob.mockResolvedValue({ ok: true, data: JOB });
      renderModal("create");
      await pickVehicle();
      await save("Agregar trabajo");
      await waitFor(() => expect(mocks.createJob).toHaveBeenCalled());
      expect(mocks.createJob.mock.calls[0][0].items).toEqual([]);
    });

    it("stays open and shows the field error the server answers with", async () => {
      mocks.createJob.mockResolvedValue({
        ok: false,
        error: "kmBelowPrevious",
        fieldErrors: { kilometers: "kmBelowPrevious" },
      });
      const { onClose } = renderModal("create");
      await pickVehicle();
      await save("Agregar trabajo");
      expect(await screen.findByText("No puede ser menor que el último kilometraje registrado (68.400 km).")).toBeInTheDocument();
      expect(field("Kilometraje")).toHaveFocus();
      expect(onClose).not.toHaveBeenCalled();
      expect(mocks.toast).not.toHaveBeenCalled();
    });

    it.each([
      ["closed", "Este trabajo ya está cerrado y no se puede editar."],
      ["serviceArchived", "Alguno de los servicios está archivado. Quitalo o elegí otro."],
      ["unexpected", "Algo salió mal. Probá de nuevo."],
    ])("shows the form-level error %s", async (error, text) => {
      mocks.createJob.mockResolvedValue({ ok: false, error });
      const { onClose } = renderModal("create");
      await pickVehicle();
      await save("Agregar trabajo");
      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("maps an archived vehicle or client to its field", async () => {
      mocks.createJob.mockResolvedValue({
        ok: false,
        error: "vehicleArchived",
        fieldErrors: { vehicleId: "vehicleArchived" },
      });
      renderModal("create");
      await pickVehicle();
      await save("Agregar trabajo");
      expect(await screen.findByText("Este vehículo está archivado y no puede tener trabajos nuevos.")).toBeInTheDocument();
    });

    it("disables the buttons while saving", async () => {
      let resolve!: (value: unknown) => void;
      mocks.createJob.mockReturnValue(new Promise((done) => (resolve = done)));
      renderModal("create");
      await pickVehicle();
      await save("Agregar trabajo");
      await waitFor(() => expect(button("Guardando…")).toBeDisabled());
      expect(button("Cancelar")).toBeDisabled();
      await act(async () => resolve({ ok: true, data: JOB }));
    });
  });

});

describe("services editor", () => {
  async function addRow() {
    // The dialog moves the focus in when it opens: let it, as it has long before a person clicks.
    await waitFor(() => expect(document.activeElement).not.toBe(document.body));
    fireEvent.click(button("Agregar servicio"));
    return (await screen.findAllByRole("combobox", { name: /^Servicio/ })).at(-1)!;
  }

  // Waits for the service catalog, so the first dropdown opens with options.
  async function servicesLoaded() {
    await waitFor(() => expect(mocks.getServiceOptions).toHaveBeenCalled());
    await act(async () => {});
  }

  it("starts with no rows, an Agregar servicio button and a zero total", () => {
    renderModal("create");
    expect(screen.getByRole("heading", { name: "Servicios" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Cant.")).toBeNull();
    expect(button("Agregar servicio")).toBeInTheDocument();
    expect(screen.getByText("Total").nextSibling).toHaveTextContent("$ 0");
  });

  it("adds an empty row with quantity 1 and puts the focus on its service box", async () => {
    renderModal("create");
    const service = await addRow();
    expect(service).toHaveFocus();
    expect(screen.getByLabelText("Cant.")).toHaveValue("1");
    expect(screen.getByLabelText("Precio unit. *")).toHaveValue("");
    expect(screen.queryByLabelText(/Final unit/)).toBeNull();
    expect(button("Quitar servicio")).toBeInTheDocument();
  });

  it("takes only digits in the quantity and only a decimal comma in the price", async () => {
    renderModal("create");
    await addRow();
    fireEvent.change(screen.getByLabelText("Cant."), { target: { value: "a3b" } });
    expect(screen.getByLabelText("Cant.")).toHaveValue("3");
    fireEvent.change(screen.getByLabelText("Precio unit. *"), { target: { value: "$ 12.500,505" } });
    expect(screen.getByLabelText("Precio unit. *")).toHaveValue("12500,50");
  });

  it("updates the subtotal and the total as the user types", async () => {
    renderModal("create");
    await addRow();
    fireEvent.change(screen.getByLabelText("Cant."), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Precio unit. *"), { target: { value: "12500,50" } });
    expect(screen.getByRole("status", { name: "Subtotal" })).toHaveTextContent("$ 25.001");
    expect(screen.getByText("Total").nextSibling).toHaveTextContent("$ 25.001");

    await addRow();
    fireEvent.change(screen.getAllByLabelText("Precio unit. *")[1], { target: { value: "1000" } });
    expect(screen.getByText("Total").nextSibling).toHaveTextContent("$ 26.001");
  });

  it("removes a row and its amount", async () => {
    renderModal("create");
    await addRow();
    fireEvent.change(screen.getByLabelText("Precio unit. *"), { target: { value: "1000" } });
    fireEvent.click(button("Quitar servicio"));
    expect(screen.queryByLabelText("Cant.")).toBeNull();
    expect(screen.getByText("Total").nextSibling).toHaveTextContent("$ 0");
  });

  it("has no quick create: a service can only be picked from the catalog", async () => {
    renderModal("create");
    await pickVehicle();
    await servicesLoaded();
    const service = await addRow();
    typeInCombobox(service, "zzz");
    await waitFor(() => expect(screen.queryByRole("status", { name: "" })).toBeDefined());
    expect(screen.queryByRole("option", { name: /Crear servicio nuevo/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "Servicio nuevo" })).toBeNull();
  });

  it("picks an active service from the catalog", async () => {
    mocks.createJob.mockResolvedValue({ ok: true, data: JOB });
    renderModal("create");
    await pickVehicle();
    await servicesLoaded();
    await addRow();
    await chooseOption(screen.getAllByRole("combobox", { name: /^Servicio/ })[0], "ace", /Cambio de aceite/);
    fireEvent.change(screen.getByLabelText("Precio unit. *"), { target: { value: "12500,50" } });
    await save("Agregar trabajo");

    await waitFor(() => expect(mocks.createJob).toHaveBeenCalled());
    expect(mocks.createJob.mock.calls[0][0].items).toEqual([
      { id: null, serviceId: ACEITE, quantity: 1, quotedUnitPrice: 12500.5, finalUnitPrice: null },
    ]);
  });

  it("asks for the service and the price on the rows that miss them, focusing the first", async () => {
    renderModal("create");
    await pickVehicle();
    await addRow();
    await save("Agregar trabajo");
    expect(await screen.findByText("Elegí un servicio.")).toBeInTheDocument();
    expect(screen.getByText("Ingresá el precio.")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox", { name: /^Servicio/ })[0]).toHaveFocus();
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it("focuses the price of the first row that only misses that", async () => {
    renderModal("create");
    await pickVehicle();
    await servicesLoaded();
    await addRow();
    await chooseOption(screen.getAllByRole("combobox", { name: /^Servicio/ })[0], "ali", /Alineación/);
    await save("Agregar trabajo");
    expect(await screen.findByText("Ingresá el precio.")).toBeInTheDocument();
    expect(screen.queryByText("Elegí un servicio.")).toBeNull();
    expect(screen.getByLabelText("Precio unit. *")).toHaveFocus();
  });

  it("rejects service text that matches no service", async () => {
    renderModal("create");
    await pickVehicle();
    await servicesLoaded();
    const service = await addRow();
    typeInCombobox(service, "zzz");
    fireEvent.keyDown(service, { key: "Escape" });
    fireEvent.change(screen.getByLabelText("Precio unit. *"), { target: { value: "100" } });
    await save("Agregar trabajo");
    expect(await screen.findByText("Elegí un servicio de la lista.")).toBeInTheDocument();
  });

  it("accepts a price of zero", async () => {
    mocks.createJob.mockResolvedValue({ ok: true, data: JOB });
    renderModal("create");
    await pickVehicle();
    await servicesLoaded();
    await addRow();
    await chooseOption(screen.getAllByRole("combobox", { name: /^Servicio/ })[0], "ace", /Cambio de aceite/);
    fireEvent.change(screen.getByLabelText("Precio unit. *"), { target: { value: "0" } });
    await save("Agregar trabajo");
    await waitFor(() => expect(mocks.createJob).toHaveBeenCalled());
    expect(mocks.createJob.mock.calls[0][0].items[0].quotedUnitPrice).toBe(0);
  });

  describe("the work phase", () => {
    async function inWorkPhase() {
      renderModal("create");
      await pickVehicle();
      await servicesLoaded();
      await addRow();
      await chooseOption(screen.getAllByRole("combobox", { name: /^Servicio/ })[0], "ace", /Cambio de aceite/);
      fireEvent.change(screen.getByLabelText("Precio unit. *"), { target: { value: "1000" } });
      await chooseStatus("En progreso");
    }

    it("shows the quoted and the final price, the final one starting as the quoted", async () => {
      await inWorkPhase();
      expect(screen.getByLabelText("Presup. unit.")).toHaveValue("1000");
      expect(screen.getByLabelText("Final unit. *")).toHaveValue("1000");
      expect(screen.queryByLabelText("Precio unit. *")).toBeNull();
    });

    it("totals the quoted and the final prices separately", async () => {
      await inWorkPhase();
      fireEvent.change(screen.getByLabelText("Final unit. *"), { target: { value: "1500" } });
      expect(screen.getByText("Presupuestado").nextSibling).toHaveTextContent("$ 1.000");
      expect(screen.getByText("Final").nextSibling).toHaveTextContent("$ 1.500");
      expect(screen.getByRole("status", { name: "Subtotal" })).toHaveTextContent("$ 1.500");
    });

    it("lets a row added in the work phase follow its quoted price with the final one", async () => {
      await inWorkPhase();
      await addRow();
      fireEvent.change(screen.getAllByLabelText("Presup. unit.")[1], { target: { value: "200" } });
      expect(screen.getAllByLabelText("Final unit. *")[1]).toHaveValue("200");
      fireEvent.change(screen.getAllByLabelText("Final unit. *")[1], { target: { value: "250" } });
      fireEvent.change(screen.getAllByLabelText("Presup. unit.")[1], { target: { value: "300" } });
      expect(screen.getAllByLabelText("Final unit. *")[1]).toHaveValue("250");
    });

    it("asks for a final price that was cleared", async () => {
      await inWorkPhase();
      fireEvent.change(screen.getByLabelText("Final unit. *"), { target: { value: "" } });
      await save("Agregar trabajo");
      expect(await screen.findByText("Ingresá el precio.")).toBeInTheDocument();
      expect(screen.getByLabelText("Final unit. *")).toHaveFocus();
    });

    it("sends both prices", async () => {
      mocks.createJob.mockResolvedValue({ ok: true, data: JOB });
      await inWorkPhase();
      fireEvent.change(screen.getByLabelText("Final unit. *"), { target: { value: "1500,50" } });
      await save("Agregar trabajo");
      await waitFor(() => expect(mocks.createJob).toHaveBeenCalled());
      expect(mocks.createJob.mock.calls[0][0]).toMatchObject({
        status: "en_progreso",
        items: [{ quotedUnitPrice: 1000, finalUnitPrice: 1500.5 }],
      });
    });

    it("clears the final prices when the status goes back to the quote phase", async () => {
      await inWorkPhase();
      await chooseStatus("Presupuesto enviado");
      expect(screen.queryByLabelText("Final unit. *")).toBeNull();
      expect(screen.getByLabelText("Precio unit. *")).toHaveValue("1000");
      await chooseStatus("En progreso");
      expect(screen.getByLabelText("Final unit. *")).toHaveValue("1000");
    });
  });
});

describe("edit job form", () => {
  const WORK_JOB: JobListItem = { ...JOB, status: "en_progreso", finalTotal: 26000 };
  const WORK_ITEM: JobItem = { ...ITEM, finalUnitPrice: 13000 };

  async function renderEdit(job: JobListItem = JOB, fromHost?: JobFromHost) {
    const handlers = renderModal("edit", job, fromHost);
    await screen.findByLabelText("Cant.");
    return handlers;
  }

  it("shows the body skeleton, announced once, until the saved services arrive", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getJobDetails.mockReturnValue(new Promise((done) => (resolve = done)));
    renderModal("edit", JOB);
    expect(screen.getAllByText("Cargando…")).toHaveLength(1);
    expect(screen.queryByLabelText("Cant.")).toBeNull();

    await act(async () => resolve({ ok: true, items: [ITEM], history: [] }));
    expect(await screen.findByLabelText("Cant.")).toBeInTheDocument();
  });

  it("offers to retry when the saved services can not be loaded", async () => {
    mocks.getJobDetails.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ ok: true, items: [ITEM], history: [] });
    renderModal("edit", JOB);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByLabelText("Cant.")).toBeInTheDocument();
  });

  it("is titled Editar trabajo with the plate and vehicle above the required-fields note", async () => {
    await renderEdit();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Editar trabajo")).toBeInTheDocument();
    expect(within(dialog).getByText("AE 482 KD · Fiat Cronos 2021")).toBeInTheDocument();
    expect(within(dialog).getByText("Los campos con * son obligatorios.")).toBeInTheDocument();
    expect(button("Cancelar")).toBeInTheDocument();
    expect(button("Guardar cambios")).toBeInTheDocument();
  });

  it("prefills every field with the saved job", async () => {
    await renderEdit();
    expect(field(/^Vehículo/)).toHaveValue("Fiat Cronos (AE 482 KD)");
    expect(field("Cliente")).toHaveValue("Ana Gómez");
    expect(screen.getByRole("combobox", { name: /Estado/ })).toHaveTextContent("Presupuesto enviado");
    expect(field("Kilometraje")).toHaveValue("68.400");
    expect(field("Observaciones")).toHaveValue("Ruido en la rueda");
    expect(screen.getByLabelText("Cant.")).toHaveValue("2");
    expect(screen.getByLabelText("Precio unit. *")).toHaveValue("12500,5");
    await waitFor(() =>
      expect(screen.getAllByRole("combobox", { name: /^Servicio/ })[0]).toHaveValue("Cambio de aceite"),
    );
  });

  it("does not offer the owner as a default, and keeps the saved km instead of the latest", async () => {
    mocks.getVehicleKmFloor.mockResolvedValue({ ok: true, floor: 50000 });
    await renderEdit();
    await waitFor(() => expect(mocks.getVehicleKmFloor).toHaveBeenCalledWith(CRONOS, JOB_ID));
    await screen.findByText("Último registrado: 50.000 km");
    expect(field("Kilometraje")).toHaveValue("68.400");
    expect(screen.queryByText("Por defecto, el dueño del vehículo.")).toBeNull();
  });

  it("keeps an archived vehicle, client and service labelled as archived", async () => {
    mocks.getOwnerOfVehicle.mockResolvedValue({
      ok: true,
      owner: { id: ANA, name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: false },
    });
    mocks.getJobDetails.mockResolvedValue({
      ok: true,
      items: [{ ...ITEM, serviceEnabled: false }],
      history: [],
    });
    mocks.getServiceOptions.mockResolvedValue({
      ok: true,
      rows: [{ id: ACEITE, name: "Cambio de aceite", enabled: false }],
    });
    await renderEdit({
      ...JOB,
      vehicle: { ...JOB.vehicle, enabled: false },
      client: { ...JOB.client!, enabled: false },
    });
    expect(field(/^Vehículo/)).toHaveValue("Fiat Cronos (Archivado) (AE 482 KD)");
    await waitFor(() => expect(field("Cliente")).toHaveValue("Ana Gómez (Archivado)"));
    expect(screen.queryByText(/está archivado: el trabajo se guarda sin cliente/)).toBeNull();
    await waitFor(() =>
      expect(screen.getAllByRole("combobox", { name: /^Servicio/ })[0]).toHaveValue("Cambio de aceite (Archivado)"),
    );
  });

  it("goes back to the job from Cancelar, without a request", async () => {
    const { onModeChange } = await renderEdit();
    fireEvent.click(button("Cancelar"));
    expect(onModeChange).toHaveBeenCalledWith("view");
    expect(mocks.updateJob).not.toHaveBeenCalled();
  });

  it("goes back to the job without a request or a toast when nothing changed", async () => {
    const { onModeChange, onClose } = await renderEdit();
    await save("Guardar cambios");
    await waitFor(() => expect(onModeChange).toHaveBeenCalledWith("view"));
    expect(mocks.updateJob).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("saves the changes with the saved rows' ids, toasts and closes the modal", async () => {
    mocks.updateJob.mockResolvedValue({ ok: true, data: JOB });
    const { onClose } = await renderEdit();
    fireEvent.change(field("Observaciones"), { target: { value: "Cambiar también la correa" } });
    fireEvent.change(screen.getByLabelText("Cant."), { target: { value: "3" } });
    await save("Guardar cambios");

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(mocks.updateJob).toHaveBeenCalledWith(JOB_ID, {
      vehicleId: CRONOS,
      clientId: ANA,
      status: "presupuesto_enviado",
      kilometers: 68400,
      appointmentId: APPOINTMENT,
      observations: "Cambiar también la correa",
      items: [
        { id: ITEM_ID, serviceId: ACEITE, quantity: 3, quotedUnitPrice: 12500.5, finalUnitPrice: null },
      ],
    });
    expect(mocks.toast).toHaveBeenCalledWith("Cambios guardados", { description: "AE 482 KD, Fiat Cronos" });
  });

  it("stays open and shows the error the server answers with", async () => {
    mocks.updateJob.mockResolvedValue({ ok: false, error: "closed" });
    const { onClose } = await renderEdit();
    fireEvent.change(field("Observaciones"), { target: { value: "Otra cosa" } });
    await save("Guardar cambios");
    expect(await screen.findByText("Este trabajo ya está cerrado y no se puede editar.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("can take away a saved service, and add one", async () => {
    mocks.updateJob.mockResolvedValue({ ok: true, data: JOB });
    await renderEdit();
    await waitFor(() => expect(mocks.getServiceOptions).toHaveBeenCalled());
    fireEvent.click(button("Quitar servicio"));
    expect(screen.queryByLabelText("Cant.")).toBeNull();
    await save("Guardar cambios");
    await waitFor(() => expect(mocks.updateJob).toHaveBeenCalled());
    expect(mocks.updateJob.mock.calls[0][1].items).toEqual([]);
  });

  describe("prices of the saved services", () => {
    it("can be edited in the quote phase", async () => {
      await renderEdit();
      expect(screen.getByLabelText("Precio unit. *")).not.toHaveAttribute("readonly");
    });

    it("keeps the quoted price read only once the status goes into the work phase", async () => {
      await renderEdit();
      await chooseStatus("En progreso");
      expect(screen.getByLabelText("Presup. unit.")).toHaveAttribute("readonly");
      expect(screen.getByLabelText("Final unit. *")).toHaveValue("12500,5");
      expect(screen.getByLabelText("Final unit. *")).not.toHaveAttribute("readonly");
    });

    it("keeps the quoted price of a job in the work phase read only, with an editable final price", async () => {
      mocks.getJobDetails.mockResolvedValue({ ok: true, items: [WORK_ITEM], history: [] });
      await renderEdit(WORK_JOB);
      expect(screen.getByLabelText("Presup. unit.")).toHaveAttribute("readonly");
      expect(screen.getByLabelText("Presup. unit.")).toHaveValue("12500,5");
      expect(screen.getByLabelText("Final unit. *")).toHaveValue("13000");
      fireEvent.change(screen.getByLabelText("Final unit. *"), { target: { value: "14000" } });
      expect(screen.getByRole("status", { name: "Subtotal" })).toHaveTextContent("$ 28.000");
    });

    it("lets a row added in the work phase have its own quoted price", async () => {
      mocks.getJobDetails.mockResolvedValue({ ok: true, items: [WORK_ITEM], history: [] });
      await renderEdit(WORK_JOB);
      fireEvent.click(button("Agregar servicio"));
      const quoted = (await screen.findAllByLabelText("Presup. unit."))[1];
      expect(quoted).not.toHaveAttribute("readonly");
    });

    it("keeps the quoted price of a saved service locked when a work-phase job goes back to the quote phase", async () => {
      mocks.getJobDetails.mockResolvedValue({ ok: true, items: [WORK_ITEM], history: [] });
      await renderEdit(WORK_JOB);
      await chooseStatus("Pendiente");
      expect(screen.queryByLabelText("Final unit. *")).toBeNull();
      expect(screen.getByLabelText("Precio unit. *")).toHaveAttribute("readonly");
    });

    it("sends the final price as null when the job goes back to the quote phase", async () => {
      mocks.updateJob.mockResolvedValue({ ok: true, data: JOB });
      mocks.getJobDetails.mockResolvedValue({ ok: true, items: [WORK_ITEM], history: [] });
      await renderEdit(WORK_JOB);
      await chooseStatus("Presupuesto aceptado");
      await save("Guardar cambios");
      await waitFor(() => expect(mocks.updateJob).toHaveBeenCalled());
      expect(mocks.updateJob.mock.calls[0][1]).toMatchObject({
        status: "presupuesto_aceptado",
        items: [{ id: ITEM_ID, finalUnitPrice: null }],
      });
    });

    it("shows a cancelled job's phase: work prices when its services had final prices", async () => {
      mocks.getJobDetails.mockResolvedValue({ ok: true, items: [WORK_ITEM], history: [] });
      await renderEdit(WORK_JOB);
      await chooseStatus("Cancelado");
      expect(screen.getByLabelText("Final unit. *")).toHaveValue("13000");
    });
  });

  it("closing a job from the edit asks first, like a new one", async () => {
    mocks.updateJob.mockResolvedValue({ ok: true, data: JOB });
    await renderEdit();
    await chooseStatus("Entregado");
    // Delivered is the work phase: the final price starts as the quoted one.
    await save("Guardar cambios");
    const confirm = await screen.findByRole("alertdialog");
    await act(async () => fireEvent.click(within(confirm).getByRole("button", { name: "Guardar y cerrar" })));
    await waitFor(() => expect(mocks.updateJob).toHaveBeenCalled());
    expect(mocks.updateJob.mock.calls[0][1]).toMatchObject({
      status: "entregado",
      items: [{ quotedUnitPrice: 12500.5, finalUnitPrice: 12500.5 }],
    });
  });

  it("shows a closed job as it is, without a form, even if asked to edit it", async () => {
    renderModal("edit", { ...JOB, status: "entregado" });
    expect(await screen.findByText("Cerrado, no se puede editar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
  });
});
