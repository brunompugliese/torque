import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DetailModal } from "@/components/shared/detail-modal";
import { FIELD_WIDTH } from "@/components/shared/form-layout";
import { chooseOption, typeInCombobox } from "@/test/combobox";
import { renderWithIntl } from "@/test/render";

import type { VehicleListItem } from "../schemas";

const mocks = vi.hoisted(() => ({
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  setVehicleArchived: vi.fn(),
  getBrandOptions: vi.fn(),
  getModelOptions: vi.fn(),
  searchClientOptions: vi.fn(),
  getVehicleJobs: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("../actions", () => ({
  createVehicle: mocks.createVehicle,
  updateVehicle: mocks.updateVehicle,
  setVehicleArchived: mocks.setVehicleArchived,
  getBrandOptions: mocks.getBrandOptions,
  getModelOptions: mocks.getModelOptions,
}));
vi.mock("@/features/client/actions", () => ({ searchClientOptions: mocks.searchClientOptions }));
vi.mock("@/features/job/actions", () => ({ getVehicleJobs: mocks.getVehicleJobs }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { useVehicleModal, type VehicleFromClient, type VehicleModalMode } from "./use-vehicle-modal";

const FIAT = "aa1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const VW = "ab1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const CRONOS = "bb1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const GOL = "bc1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const CLIENT_ID = "cc1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const VEHICLE_ID = "dd1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const VEHICLE: VehicleListItem = {
  id: VEHICLE_ID,
  plate: "AB123CD",
  brandId: FIAT,
  modelId: CRONOS,
  brandName: "Fiat",
  modelName: "Cronos",
  year: 2021,
  vin: "8AP359A1XMU123456",
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
  lastKm: 112500,
  client: { id: CLIENT_ID, name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
};
const BARE: VehicleListItem = { ...VEHICLE, year: null, vin: null, lastKm: null, client: null };

const ANA = { id: CLIENT_ID, name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true };

function Host(props: {
  mode: VehicleModalMode;
  vehicle: VehicleListItem | null;
  onModeChange: (mode: VehicleModalMode, vehicle?: VehicleListItem) => void;
  onClose: () => void;
  fromClient?: VehicleFromClient;
}) {
  const { content, confirmDialog } = useVehicleModal(props);
  if (!content) return null;
  return (
    <>
      <DetailModal open onOpenChange={() => {}} {...content} />
      {confirmDialog}
    </>
  );
}

function renderModal(mode: VehicleModalMode, vehicle: VehicleListItem | null = VEHICLE, fromClient?: VehicleFromClient) {
  const onModeChange = vi.fn();
  const onClose = vi.fn();
  renderWithIntl(<Host mode={mode} vehicle={vehicle} onModeChange={onModeChange} onClose={onClose} fromClient={fromClient} />);
  return { onModeChange, onClose };
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.toast.error = vi.fn();
  mocks.getBrandOptions.mockResolvedValue({
    ok: true,
    rows: [
      { id: FIAT, name: "Fiat" },
      { id: VW, name: "Volkswagen" },
    ],
  });
  mocks.getModelOptions.mockImplementation(async (brandId: string) => ({
    ok: true,
    rows: brandId === FIAT ? [{ id: CRONOS, name: "Cronos" }] : [{ id: GOL, name: "Gol" }],
  }));
  mocks.searchClientOptions.mockResolvedValue({ ok: true, rows: [ANA] });
  mocks.getVehicleJobs.mockResolvedValue({ ok: true, rows: [] });
});

const field = (name: string | RegExp) => screen.getByLabelText(name);
const button = (name: string) => screen.getByRole("button", { name });
// A dropdown that is open makes the rest of the page inert: close it first.
const closeList = async (input: HTMLElement) => {
  fireEvent.keyDown(input, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
};
const save = async (name: string) => act(async () => fireEvent.click(await screen.findByRole("button", { name })));

// Fills the required fields of the form with a Fiat Cronos.
async function fillVehicle(plate = "ab123cd") {
  fireEvent.change(field("Patente *"), { target: { value: plate } });
  await chooseOption(field("Marca *"), "fia", /Fiat/);
  await waitFor(() => expect(field("Modelo *")).toBeEnabled());
  await chooseOption(field("Modelo *"), "cro", /Cronos/);
}

describe("vehicle view", () => {
  it("shows the plate drawn with brand, model and year, and the actions", () => {
    renderModal("view");
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector('[data-slot="plate"]')).toHaveTextContent("AB 123 CD");
    expect(within(dialog).getByText("Fiat Cronos 2021")).toBeInTheDocument();
    expect(button("Archivar")).toBeInTheDocument();
    expect(button("Editar vehículo")).toBeInTheDocument();
    expect(within(dialog).queryByText("Archivado")).toBeNull();
  });

  it("leaves the year out of the title when there is none, and shows Archivado with Desarchivar", () => {
    renderModal("view", { ...BARE, enabled: false });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Fiat Cronos")).toBeInTheDocument();
    expect(within(dialog).getByText("Archivado")).toBeInTheDocument();
    expect(button("Desarchivar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archivar" })).toBeNull();
  });

  it("shows the client with a plain phone and the WhatsApp button, the VIN and the last km", () => {
    renderModal("view");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Ana Gómez")).toBeInTheDocument();
    expect(within(dialog).getByText(/11 1234-5678/)).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Escribir por WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/5491112345678",
    );
    expect(within(dialog).queryByRole("link", { name: /Ana/ })).toBeNull();
    expect(within(dialog).getByText("8AP359A1XMU123456")).toBeInTheDocument();
    expect(within(dialog).getByText("112.500 km")).toBeInTheDocument();
  });

  it("marks an archived client", () => {
    renderModal("view", { ...VEHICLE, client: { ...ANA, enabled: false } });
    expect(screen.getByText("Ana Gómez")).toHaveClass("text-muted-foreground");
    expect(screen.getByText("Archivado")).toBeInTheDocument();
  });

  it("says Sin cliente and Sin cargar when there is nothing to show", () => {
    renderModal("view", BARE);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Sin cliente")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Sin cargar")).toHaveLength(2);
    expect(within(dialog).queryByRole("link", { name: "Escribir por WhatsApp" })).toBeNull();
  });

  it("shows Creado el in Argentina's time and has no Volver on its own", () => {
    renderModal("view");
    expect(screen.getByText("Creado el 13/10/2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Volver" })).toBeNull();
  });

  it("loads the job history of the vehicle", async () => {
    mocks.getVehicleJobs.mockResolvedValue({ ok: true, rows: [] });
    renderModal("view");
    expect(screen.getByRole("heading", { name: "Historial de trabajos" })).toBeInTheDocument();
    expect(await screen.findByText("Este vehículo todavía no tiene trabajos.")).toBeInTheDocument();
    expect(mocks.getVehicleJobs).toHaveBeenCalledWith(VEHICLE_ID);
  });

  it("goes to the edit form", () => {
    const { onModeChange } = renderModal("view");
    fireEvent.click(button("Editar vehículo"));
    expect(onModeChange).toHaveBeenCalledWith("edit");
  });

  it("shows Volver when it is a step of the client modal, and goes back from it", () => {
    const fromClient: VehicleFromClient = { client: { id: CLIENT_ID, name: "Ana Gómez" }, onBack: vi.fn() };
    renderModal("view", VEHICLE, fromClient);
    fireEvent.click(button("Volver"));
    expect(fromClient.onBack).toHaveBeenCalledOnce();
  });
});

describe("archive and unarchive", () => {
  it("asks first, then archives, closes the modal and confirms with a toast", async () => {
    mocks.setVehicleArchived.mockResolvedValue({ ok: true, data: { ...VEHICLE, enabled: false } });
    const { onClose } = renderModal("view");

    fireEvent.click(button("Archivar"));
    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText("¿Archivar este vehículo?")).toBeInTheDocument();
    expect(
      within(confirm).getByText(
        "Va a dejar de aparecer en el listado. Lo podés ver activando Mostrar archivados y desarchivarlo cuando quieras.",
      ),
    ).toBeInTheDocument();
    expect(within(confirm).getByText("No se le pueden crear turnos ni trabajos mientras esté archivado.")).toBeInTheDocument();
    expect(mocks.setVehicleArchived).not.toHaveBeenCalled();

    await act(async () => fireEvent.click(within(confirm).getByRole("button", { name: "Archivar" })));
    expect(mocks.setVehicleArchived).toHaveBeenCalledWith(VEHICLE_ID, true);
    expect(mocks.toast).toHaveBeenCalledWith("Vehículo archivado", { description: "AB 123 CD" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("changes nothing when the confirmation is cancelled", async () => {
    const { onClose } = renderModal("view");
    fireEvent.click(button("Archivar"));
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(mocks.setVehicleArchived).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("unarchives right away, without confirmation", async () => {
    mocks.setVehicleArchived.mockResolvedValue({ ok: true, data: VEHICLE });
    const { onClose } = renderModal("view", { ...VEHICLE, enabled: false });
    await act(async () => fireEvent.click(button("Desarchivar")));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(mocks.setVehicleArchived).toHaveBeenCalledWith(VEHICLE_ID, false);
    expect(mocks.toast).toHaveBeenCalledWith("Vehículo desarchivado", { description: "AB 123 CD" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays open with an error toast when it fails", async () => {
    mocks.setVehicleArchived.mockResolvedValue({ ok: false, error: "unexpected" });
    const { onClose } = renderModal("view", { ...VEHICLE, enabled: false });
    await act(async () => fireEvent.click(button("Desarchivar")));
    expect(mocks.toast.error).toHaveBeenCalledWith("Algo salió mal. Probá de nuevo.");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("vehicle form: add", () => {
  it("opens with the form, its subtitle and the footer", () => {
    renderModal("create", null);
    const dialog = screen.getByRole("dialog", { name: "Agregar vehículo" });
    expect(within(dialog).getByText("Los campos con * son obligatorios.")).toBeInTheDocument();
    expect(button("Cancelar")).toBeInTheDocument();
    expect(button("Agregar vehículo")).toBeInTheDocument();
  });

  it("has the fields in order, with the right hints and inputs", () => {
    renderModal("create", null);
    const labels = [...screen.getByRole("dialog").querySelectorAll("label")].map((label) => label.textContent);
    expect(labels).toEqual(["Patente *", "Año", "Marca *", "Modelo *", "VIN", "Cliente"]);
    expect(field("Patente *")).toHaveAttribute("placeholder", "AB 123 CD");
    expect(field("Año")).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByText("Dejalo vacío si el vehículo no tiene cliente.")).toBeInTheDocument();
  });

  it("lays the fields out two to a row, each as wide as its values need", () => {
    renderModal("create", null);
    const rowOf = (label: string) => field(label).closest('[data-slot="form-row"]');
    const fieldOf = (label: string) => field(label).closest('[data-slot="field"]');

    expect(rowOf("Patente *")).toContainElement(field("Año"));
    expect(rowOf("Marca *")).toContainElement(field("Modelo *"));
    expect(rowOf("Patente *")).not.toBe(rowOf("Marca *"));
    expect(rowOf("Patente *")).toHaveClass("sm:grid-cols-2");

    // Short values get short fields; the VIN is exactly 17 characters.
    expect(fieldOf("Año")).toHaveClass(FIELD_WIDTH.year);
    expect(fieldOf("Patente *")).toHaveClass(FIELD_WIDTH.plate);
    expect(fieldOf("VIN")).toHaveClass(FIELD_WIDTH.vin);

    // The VIN and the client are each alone in their row, the client with the full width.
    expect(rowOf("VIN")).toBeNull();
    expect(rowOf("Cliente")).toBeNull();
    expect(fieldOf("Cliente")).not.toHaveClass(...FIELD_WIDTH.vin.split(" "));
  });

  it("formats the plate, year and VIN as they are typed", () => {
    renderModal("create", null);
    fireEvent.change(field("Patente *"), { target: { value: "ab-123 cdxyz" } });
    expect(field("Patente *")).toHaveValue("AB 123 CD");
    fireEvent.change(field("Año"), { target: { value: "20a21999" } });
    expect(field("Año")).toHaveValue("2021");
    fireEvent.change(field("VIN"), { target: { value: "1hg-cm82633a 004352999" } });
    expect(field("VIN")).toHaveValue("1HGCM82633A004352");
  });

  it("keeps the model disabled until a brand is chosen, then lists that brand's models", async () => {
    renderModal("create", null);
    expect(field("Modelo *")).toBeDisabled();
    expect(field("Modelo *")).toHaveAttribute("placeholder", "Primero elegí la marca");

    await chooseOption(field("Marca *"), "vol", /Volkswagen/);
    await waitFor(() => expect(field("Modelo *")).toBeEnabled());
    expect(mocks.getModelOptions).toHaveBeenCalledWith(VW, undefined);
    typeInCombobox(field("Modelo *"), "");
    fireEvent.keyDown(field("Modelo *"), { key: "ArrowDown" });
    expect(await screen.findByRole("option", { name: "Gol" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Cronos" })).toBeNull();
  });

  it("clears the model when the brand changes", async () => {
    renderModal("create", null);
    await fillVehicle();
    expect(field("Modelo *")).toHaveValue("Cronos");

    await chooseOption(field("Marca *"), "volk", /Volkswagen/);
    expect(field("Modelo *")).toHaveValue("");
  });

  it("creates the vehicle with the tidied values, confirms with a toast and closes the modal", async () => {
    mocks.createVehicle.mockResolvedValue({ ok: true, data: VEHICLE });
    const { onModeChange, onClose } = renderModal("create", null);
    await fillVehicle();
    fireEvent.change(field("Año"), { target: { value: "2021" } });
    fireEvent.change(field("VIN"), { target: { value: "8ap359a1xmu123456" } });
    await save("Agregar vehículo");

    expect(mocks.createVehicle).toHaveBeenCalledWith({
      plate: "AB123CD",
      year: 2021,
      brandId: FIAT,
      modelId: CRONOS,
      vin: "8AP359A1XMU123456",
      clientId: null,
      newClient: null,
    });
    expect(mocks.toast).toHaveBeenCalledWith("Vehículo agregado", { description: "AB 123 CD" });
    expect(onClose).toHaveBeenCalledOnce();
    expect(onModeChange).not.toHaveBeenCalled();
  });

  it("asks for what is missing, linked to each field, with focus on the first", async () => {
    renderModal("create", null);
    await save("Agregar vehículo");

    expect(await screen.findByText("Ingresá la patente.")).toBeInTheDocument();
    expect(screen.getByText("Elegí la marca.")).toBeInTheDocument();
    expect(screen.getByText("Elegí el modelo.")).toBeInTheDocument();
    expect(field("Patente *")).toHaveAttribute("aria-invalid", "true");
    expect(field("Patente *")).toHaveAttribute("aria-describedby", expect.stringContaining("plate-error"));
    expect(field("Patente *")).toHaveFocus();
    expect(mocks.createVehicle).not.toHaveBeenCalled();
  });

  it("checks the plate length, the year and the VIN", async () => {
    renderModal("create", null);
    fireEvent.change(field("Patente *"), { target: { value: "ab12" } });
    fireEvent.change(field("Año"), { target: { value: "1800" } });
    fireEvent.change(field("VIN"), { target: { value: "ABC" } });
    await save("Agregar vehículo");

    expect(await screen.findByText("Revisá la patente: tiene que tener 6 o 7 caracteres.")).toBeInTheDocument();
    expect(screen.getByText(/^Ingresá un año entre 1886 y \d{4}\.$/)).toBeInTheDocument();
    expect(screen.getByText('El VIN debe tener 17 caracteres (Sin "I", "O", "Q" ni guiones).')).toBeInTheDocument();
  });

  it("rejects text left in the brand or model box that matches no option", async () => {
    renderModal("create", null);
    fireEvent.change(field("Patente *"), { target: { value: "ab123cd" } });
    typeInCombobox(field("Marca *"), "zzz");
    await closeList(field("Marca *"));
    await save("Agregar vehículo");

    expect(await screen.findByText("Elegí una marca de la lista.")).toBeInTheDocument();
    expect(field("Marca *")).toHaveFocus();

    await chooseOption(field("Marca *"), "fia", /Fiat/);
    await waitFor(() => expect(field("Modelo *")).toBeEnabled());
    typeInCombobox(field("Modelo *"), "zzz");
    await closeList(field("Modelo *"));
    await save("Agregar vehículo");
    expect(await screen.findByText("Elegí un modelo de la lista.")).toBeInTheDocument();
    expect(mocks.createVehicle).not.toHaveBeenCalled();
  });

  it("says when the plate is taken, and when the vehicle is archived, with focus on the plate", async () => {
    mocks.createVehicle.mockResolvedValue({ ok: false, error: "plateTaken", fieldErrors: { plate: "plateTaken" } });
    renderModal("create", null);
    await fillVehicle();
    await save("Agregar vehículo");
    expect(await screen.findByText("Ya hay un vehículo con esta patente.")).toBeInTheDocument();
    expect(field("Patente *")).toHaveFocus();

    mocks.createVehicle.mockResolvedValue({
      ok: false,
      error: "plateTakenArchived",
      fieldErrors: { plate: "plateTakenArchived" },
    });
    await save("Agregar vehículo");
    expect(await screen.findByText("Ya hay un vehículo archivado con esta patente.")).toBeInTheDocument();
  });

  it("shows a general error when the save fails without a field to blame", async () => {
    mocks.createVehicle.mockResolvedValue({ ok: false, error: "unexpected" });
    renderModal("create", null);
    await fillVehicle();
    await save("Agregar vehículo");
    expect(await screen.findByText("Algo salió mal. Probá de nuevo.")).toBeInTheDocument();
  });

  it("closes from Cancelar", () => {
    const { onClose } = renderModal("create", null);
    fireEvent.click(button("Cancelar"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("vehicle form: client", () => {
  it("searches the clients as the user types, showing the phone and archived ones labelled", async () => {
    mocks.searchClientOptions.mockResolvedValue({
      ok: true,
      rows: [ANA, { ...ANA, id: "ee1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b", name: "Zoe", surname: null, enabled: false }],
    });
    renderModal("create", null);
    typeInCombobox(field("Cliente"), "an");
    const option = await screen.findByRole("option", { name: /Ana Gómez/ });
    expect(within(option).getByText("11 1234-5678")).toHaveClass("text-muted-foreground");
    expect(screen.getByRole("option", { name: /Zoe \(Archivado\)/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Crear cliente nuevo" })).toBeInTheDocument();
    expect(mocks.searchClientOptions).toHaveBeenCalledWith("an");
  });

  it("saves the chosen client", async () => {
    mocks.createVehicle.mockResolvedValue({ ok: true, data: VEHICLE });
    renderModal("create", null);
    await fillVehicle();
    await chooseOption(field("Cliente"), "ana", /Ana Gómez/);
    expect(field("Cliente")).toHaveValue("Ana Gómez");
    await save("Agregar vehículo");
    expect(mocks.createVehicle).toHaveBeenCalledWith(expect.objectContaining({ clientId: CLIENT_ID, newClient: null }));
  });

  it("rejects text left in the client box that matches no client", async () => {
    renderModal("create", null);
    await fillVehicle();
    typeInCombobox(field("Cliente"), "zzz");
    await closeList(field("Cliente"));
    await save("Agregar vehículo");
    expect(await screen.findByText("Elegí un cliente de la lista.")).toBeInTheDocument();
    expect(field("Cliente")).toHaveFocus();
    expect(mocks.createVehicle).not.toHaveBeenCalled();
  });

  it("saves without a client when the box is empty", async () => {
    mocks.createVehicle.mockResolvedValue({ ok: true, data: VEHICLE });
    renderModal("create", null);
    await fillVehicle();
    await save("Agregar vehículo");
    expect(mocks.createVehicle).toHaveBeenCalledWith(expect.objectContaining({ clientId: null }));
  });

  it("opens the new client section from the last option, carrying over a typed name", async () => {
    renderModal("create", null);
    typeInCombobox(field("Cliente"), "Ana Gómez");
    fireEvent.click(await screen.findByRole("option", { name: "Crear cliente nuevo" }));

    const section = await screen.findByRole("region", { name: "Cliente nuevo" });
    expect(within(section).getByLabelText("Nombre *")).toHaveValue("Ana");
    expect(within(section).getByLabelText("Apellido")).toHaveValue("Gómez");
    expect(within(section).getByLabelText("Teléfono *")).toHaveValue("");
    expect(within(section).getByLabelText("DNI")).toHaveValue("");
    expect(within(section).queryByLabelText("Email")).toBeNull();
    expect(within(section).getByText(/Se crea junto con el vehículo/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Cliente" })).toBeNull();
  });

  it("lays the new client's fields out two to a row, like the client form", async () => {
    renderModal("create", null);
    typeInCombobox(field("Cliente"), "Ana");
    fireEvent.click(await screen.findByRole("option", { name: "Crear cliente nuevo" }));
    const section = await screen.findByRole("region", { name: "Cliente nuevo" });
    const rowOf = (label: string) => within(section).getByLabelText(label).closest('[data-slot="form-row"]');

    expect(rowOf("Nombre *")).toContainElement(within(section).getByLabelText("Apellido"));
    expect(rowOf("Teléfono *")).toContainElement(within(section).getByLabelText("DNI"));
    expect(rowOf("Nombre *")).not.toBe(rowOf("Teléfono *"));
    expect(within(section).getByLabelText("Teléfono *").closest('[data-slot="field"]')).toHaveClass(FIELD_WIDTH.phone);
    expect(within(section).getByLabelText("DNI").closest('[data-slot="field"]')).toHaveClass(FIELD_WIDTH.dni);
  });

  it("carries a typed number over to the phone", async () => {
    renderModal("create", null);
    typeInCombobox(field("Cliente"), "1112345678");
    fireEvent.click(await screen.findByRole("option", { name: "Crear cliente nuevo" }));
    const section = await screen.findByRole("region", { name: "Cliente nuevo" });
    expect(within(section).getByLabelText("Teléfono *")).toHaveValue("11 1234-5678");
    expect(within(section).getByLabelText("Nombre *")).toHaveValue("");
  });

  it("carries nothing over when a client was picked from the list", async () => {
    renderModal("create", null);
    await chooseOption(field("Cliente"), "ana", /Ana Gómez/);
    typeInCombobox(field("Cliente"), "Ana");
    await chooseOption(field("Cliente"), "ana", /Ana Gómez/);
    fireEvent.keyDown(field("Cliente"), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Crear cliente nuevo" }));
    const section = await screen.findByRole("region", { name: "Cliente nuevo" });
    expect(within(section).getByLabelText("Nombre *")).toHaveValue("");
  });

  it("discards the section with its X and brings back the client box", async () => {
    renderModal("create", null);
    typeInCombobox(field("Cliente"), "Ana");
    fireEvent.click(await screen.findByRole("option", { name: "Crear cliente nuevo" }));
    await screen.findByRole("region", { name: "Cliente nuevo" });

    fireEvent.click(button("Descartar cliente nuevo"));
    expect(screen.queryByRole("region", { name: "Cliente nuevo" })).toBeNull();
    expect(field("Cliente")).toBeInTheDocument();
  });

  it("applies the client form's input rules and messages to the new client", async () => {
    renderModal("create", null);
    await fillVehicle();
    typeInCombobox(field("Cliente"), "x");
    fireEvent.click(await screen.findByRole("option", { name: "Crear cliente nuevo" }));
    const section = await screen.findByRole("region", { name: "Cliente nuevo" });

    fireEvent.change(within(section).getByLabelText("Nombre *"), { target: { value: " " } });
    fireEvent.change(within(section).getByLabelText("Teléfono *"), { target: { value: "(011) 12" } });
    expect(within(section).getByLabelText("Teléfono *")).toHaveValue("11 12");
    fireEvent.change(within(section).getByLabelText("DNI"), { target: { value: "28.456.123.99" } });
    expect(within(section).getByLabelText("DNI")).toHaveValue("28456123");
    await save("Agregar vehículo");

    expect(await within(section).findByText("Ingresá el nombre.")).toBeInTheDocument();
    expect(within(section).getByText("Revisá el teléfono: tiene que tener 10 dígitos.")).toBeInTheDocument();
    expect(within(section).getByLabelText("Nombre *")).toHaveFocus();
    expect(mocks.createVehicle).not.toHaveBeenCalled();
  });

  it("creates the vehicle and the client together, confirming with one toast", async () => {
    mocks.createVehicle.mockResolvedValue({ ok: true, data: { ...VEHICLE, client: ANA } });
    const { onClose } = renderModal("create", null);
    await fillVehicle();
    typeInCombobox(field("Cliente"), "Ana Gómez");
    fireEvent.click(await screen.findByRole("option", { name: "Crear cliente nuevo" }));
    const section = await screen.findByRole("region", { name: "Cliente nuevo" });
    fireEvent.change(within(section).getByLabelText("Teléfono *"), { target: { value: "1112345678" } });
    fireEvent.change(within(section).getByLabelText("DNI"), { target: { value: "28456123" } });
    await save("Agregar vehículo");

    expect(mocks.createVehicle).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: null,
        newClient: { name: "Ana", surname: "Gómez", phoneNumber: "11 1234-5678", dni: "28456123" },
      }),
    );
    expect(mocks.toast).toHaveBeenCalledWith("Vehículo y cliente agregados", { description: "AB 123 CD" });
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("says under the DNI when it is taken, by an active or an archived client", async () => {
    mocks.createVehicle.mockResolvedValue({ ok: false, error: "dniTaken", fieldErrors: { "newClient.dni": "dniTaken" } });
    renderModal("create", null);
    await fillVehicle();
    typeInCombobox(field("Cliente"), "Ana Gómez");
    fireEvent.click(await screen.findByRole("option", { name: "Crear cliente nuevo" }));
    const section = await screen.findByRole("region", { name: "Cliente nuevo" });
    fireEvent.change(within(section).getByLabelText("Teléfono *"), { target: { value: "1112345678" } });
    fireEvent.change(within(section).getByLabelText("DNI"), { target: { value: "28456123" } });
    await save("Agregar vehículo");

    expect(await within(section).findByText("Ya hay un cliente con este DNI.")).toBeInTheDocument();
    expect(within(section).getByLabelText("DNI")).toHaveFocus();
    expect(within(section).getByLabelText("Nombre *")).toHaveValue("Ana");

    mocks.createVehicle.mockResolvedValue({
      ok: false,
      error: "dniTakenArchived",
      fieldErrors: { "newClient.dni": "dniTakenArchived" },
    });
    await save("Agregar vehículo");
    expect(await within(section).findByText("Ya hay un cliente archivado con este DNI.")).toBeInTheDocument();
  });

  it("has a locked client when the vehicle is created from a client", async () => {
    mocks.createVehicle.mockResolvedValue({ ok: true, data: VEHICLE });
    const fromClient: VehicleFromClient = { client: { id: CLIENT_ID, name: "Ana Gómez" }, onBack: vi.fn() };
    const { onClose } = renderModal("create", null, fromClient);

    expect(field("Cliente")).toHaveValue("Ana Gómez");
    expect(field("Cliente")).toHaveAttribute("readonly");
    expect(screen.queryByRole("combobox", { name: "Cliente" })).toBeNull();
    expect(screen.queryByText("Crear cliente nuevo")).toBeNull();

    await fillVehicle();
    await save("Agregar vehículo");
    expect(mocks.createVehicle).toHaveBeenCalledWith(expect.objectContaining({ clientId: CLIENT_ID, newClient: null }));
    expect(mocks.toast).toHaveBeenCalledWith("Vehículo agregado", { description: "AB 123 CD" });
    // The whole chain closes, as for any action.
    expect(onClose).toHaveBeenCalledOnce();
    expect(fromClient.onBack).not.toHaveBeenCalled();
  });

  it("goes back one step from Volver and Cancelar when created from a client", () => {
    const fromClient: VehicleFromClient = { client: { id: CLIENT_ID, name: "Ana Gómez" }, onBack: vi.fn() };
    const { onClose } = renderModal("create", null, fromClient);
    fireEvent.click(button("Cancelar"));
    expect(fromClient.onBack).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("vehicle form: edit", () => {
  it("shows the plate above the subtitle and prefills every field", async () => {
    renderModal("edit");
    const dialog = screen.getByRole("dialog", { name: "Editar vehículo" });
    expect(within(dialog).getByText("AB 123 CD")).toBeInTheDocument();
    expect(within(dialog).getByText("Los campos con * son obligatorios.")).toBeInTheDocument();
    expect(field("Patente *")).toHaveValue("AB 123 CD");
    expect(field("Año")).toHaveValue("2021");
    expect(field("Marca *")).toHaveValue("Fiat");
    expect(field("Modelo *")).toHaveValue("Cronos");
    expect(field("VIN")).toHaveValue("8AP359A1XMU123456");
    expect(field("Cliente")).toHaveValue("Ana Gómez");
    expect(button("Guardar cambios")).toBeInTheDocument();
    await waitFor(() => expect(mocks.getBrandOptions).toHaveBeenCalledWith(FIAT));
    expect(mocks.getModelOptions).toHaveBeenCalledWith(FIAT, CRONOS);
  });

  it("offers the archived client with its label", () => {
    renderModal("edit", { ...VEHICLE, client: { ...ANA, enabled: false } });
    expect(field("Cliente")).toHaveValue("Ana Gómez (Archivado)");
  });

  it("goes back to the vehicle from Cancelar", () => {
    const { onModeChange } = renderModal("edit");
    fireEvent.click(button("Cancelar"));
    expect(onModeChange).toHaveBeenCalledWith("view");
  });

  it("goes back without a request or a toast when nothing changed", async () => {
    const { onModeChange } = renderModal("edit");
    await save("Guardar cambios");
    expect(mocks.updateVehicle).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(onModeChange).toHaveBeenCalledWith("view");
  });

  it("saves the changes, confirms with a toast and closes the modal", async () => {
    const saved = { ...VEHICLE, year: 2022 };
    mocks.updateVehicle.mockResolvedValue({ ok: true, data: saved });
    const { onModeChange, onClose } = renderModal("edit");
    fireEvent.change(field("Año"), { target: { value: "2022" } });
    await save("Guardar cambios");

    expect(mocks.updateVehicle).toHaveBeenCalledWith(
      VEHICLE_ID,
      expect.objectContaining({ plate: "AB123CD", year: 2022, brandId: FIAT, modelId: CRONOS, clientId: CLIENT_ID }),
    );
    expect(mocks.toast).toHaveBeenCalledWith("Cambios guardados", { description: "AB 123 CD" });
    expect(onClose).toHaveBeenCalledOnce();
    expect(onModeChange).not.toHaveBeenCalled();
  });

  it("can take the client away", async () => {
    mocks.updateVehicle.mockResolvedValue({ ok: true, data: BARE });
    renderModal("edit");
    fireEvent.change(field("Cliente"), { target: { value: "" } });
    await save("Guardar cambios");
    expect(mocks.updateVehicle).toHaveBeenCalledWith(VEHICLE_ID, expect.objectContaining({ clientId: null }));
  });

  it("can be edited when archived, and when it has jobs: nothing is locked", async () => {
    mocks.updateVehicle.mockResolvedValue({ ok: true, data: VEHICLE });
    renderModal("edit", { ...VEHICLE, enabled: false });
    fireEvent.change(field("Patente *"), { target: { value: "zz999zz" } });
    await save("Guardar cambios");
    expect(mocks.updateVehicle).toHaveBeenCalledWith(VEHICLE_ID, expect.objectContaining({ plate: "ZZ999ZZ" }));
  });

  it("offers the new client section too, and saves with it", async () => {
    mocks.updateVehicle.mockResolvedValue({ ok: true, data: VEHICLE });
    renderModal("edit", BARE);
    typeInCombobox(field("Cliente"), "Ana Gómez");
    fireEvent.click(await screen.findByRole("option", { name: "Crear cliente nuevo" }));
    const section = await screen.findByRole("region", { name: "Cliente nuevo" });
    fireEvent.change(within(section).getByLabelText("Teléfono *"), { target: { value: "1112345678" } });
    await save("Guardar cambios");

    expect(mocks.updateVehicle).toHaveBeenCalledWith(
      VEHICLE_ID,
      expect.objectContaining({ newClient: expect.objectContaining({ name: "Ana", phoneNumber: "11 1234-5678" }) }),
    );
  });

  it("doesn't clash with its own plate but says when another vehicle has it", async () => {
    mocks.updateVehicle.mockResolvedValue({ ok: false, error: "plateTaken", fieldErrors: { plate: "plateTaken" } });
    renderModal("edit");
    fireEvent.change(field("Patente *"), { target: { value: "zz999zz" } });
    await save("Guardar cambios");
    expect(await screen.findByText("Ya hay un vehículo con esta patente.")).toBeInTheDocument();
    expect(field("Patente *")).toHaveFocus();
  });
});
