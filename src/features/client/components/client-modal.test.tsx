import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import type { Client } from "../schemas";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
  setClientArchived: vi.fn(),
  getClientVehicles: vi.fn(),
  getUnassignedVehicles: vi.fn(),
  assignVehiclesToClient: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("../actions", () => ({
  createClient: mocks.createClient,
  updateClient: mocks.updateClient,
  setClientArchived: mocks.setClientArchived,
}));
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
  // The 13th in Argentina.
  createdAt: "2026-10-14T01:30:00+00:00",
};

function renderModal(mode: ClientModalMode, client: Client | null = CLIENT) {
  const onModeChange = vi.fn();
  const onOpenChange = vi.fn();
  const view = renderWithIntl(
    <ClientModal open mode={mode} client={client} onModeChange={onModeChange} onOpenChange={onOpenChange} />,
  );
  return { onModeChange, onOpenChange, ...view };
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = async (name: string) => act(async () => fireEvent.click(screen.getByRole("button", { name })));

beforeEach(() => {
  for (const mock of [
    mocks.createClient,
    mocks.updateClient,
    mocks.setClientArchived,
    mocks.getClientVehicles,
    mocks.getUnassignedVehicles,
    mocks.assignVehiclesToClient,
    mocks.toast,
    mocks.toast.error,
  ]) {
    mock.mockReset();
  }
  mocks.getClientVehicles.mockResolvedValue({ ok: true, rows: [] });
  mocks.getUnassignedVehicles.mockResolvedValue({ ok: true, rows: [] });
});

describe("ClientModal: details", () => {
  it("shows the name, actions, data and creation date", async () => {
    renderModal("view");
    const dialog = await screen.findByRole("dialog", { name: "Ana Gómez" });
    expect(within(dialog).getByRole("button", { name: "Archivar" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Editar cliente" })).toBeInTheDocument();
    expect(within(dialog).getByText("28.456.123")).toBeInTheDocument();
    expect(within(dialog).getByText("ana@example.com")).toBeInTheDocument();
    expect(within(dialog).getByText("Creado el 13/10/2026")).toBeInTheDocument();
    expect(within(dialog).queryByText("Archivado")).toBeNull();
  });

  it("shows the phone as plain text with an icon-only WhatsApp button and no call link", async () => {
    renderModal("view");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("11 12345678")).toBeInTheDocument();
    const links = within(dialog).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("Escribir por WhatsApp");
    expect(links[0]).toHaveAttribute("href", "https://wa.me/5491112345678");
    expect(links[0]).toHaveTextContent("");
  });

  it("shows only the name without a surname and Sin cargar for a missing DNI and email", async () => {
    renderModal("view", { ...CLIENT, surname: null, dni: null, email: null });
    const dialog = await screen.findByRole("dialog", { name: "Ana" });
    expect(within(dialog).getAllByText("Sin cargar")).toHaveLength(2);
  });

  it("shows the badge and Desarchivar for an archived client", async () => {
    renderModal("view", { ...CLIENT, enabled: false });
    expect(await screen.findByText("Archivado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desarchivar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archivar" })).toBeNull();
  });

  it("switches to the form with Editar cliente", async () => {
    const { onModeChange } = renderModal("view");
    fireEvent.click(await screen.findByRole("button", { name: "Editar cliente" }));
    expect(onModeChange).toHaveBeenCalledWith("edit");
  });

  it("renders nothing without a client outside create mode", () => {
    const { baseElement } = renderModal("view", null);
    expect(within(baseElement).queryByRole("dialog")).toBeNull();
  });
});

describe("ClientModal: archive", () => {
  it("asks first with the shared text plus the client sentence, then archives with a toast", async () => {
    mocks.setClientArchived.mockResolvedValue({ ok: true, data: { ...CLIENT, enabled: false } });
    const { onModeChange } = renderModal("view");

    fireEvent.click(await screen.findByRole("button", { name: "Archivar" }));
    const confirm = await screen.findByRole("alertdialog", { name: "¿Archivar este cliente?" });
    expect(confirm).toHaveTextContent(
      "Va a dejar de aparecer en el listado. Lo podés ver activando Mostrar archivados y desarchivarlo cuando quieras.",
    );
    expect(confirm).toHaveTextContent("Sus vehículos no cambian y lo siguen mostrando como “(Archivado)”.");
    expect(mocks.setClientArchived).not.toHaveBeenCalled();

    await act(async () => fireEvent.click(within(confirm).getByRole("button", { name: "Archivar" })));

    expect(mocks.setClientArchived).toHaveBeenCalledWith(CLIENT.id, true);
    expect(mocks.toast).toHaveBeenCalledWith("Cliente archivado", { description: "Ana Gómez" });
    expect(onModeChange).toHaveBeenCalledWith("view", { ...CLIENT, enabled: false });
  });

  it("archives nothing when the confirmation is cancelled", async () => {
    renderModal("view");
    fireEvent.click(await screen.findByRole("button", { name: "Archivar" }));
    const confirm = await screen.findByRole("alertdialog");
    await act(async () => fireEvent.click(within(confirm).getByRole("button", { name: "Cancelar" })));
    expect(mocks.setClientArchived).not.toHaveBeenCalled();
  });

  it("unarchives right away, without confirmation", async () => {
    mocks.setClientArchived.mockResolvedValue({ ok: true, data: CLIENT });
    renderModal("view", { ...CLIENT, enabled: false });

    await act(async () => fireEvent.click(await screen.findByRole("button", { name: "Desarchivar" })));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(mocks.setClientArchived).toHaveBeenCalledWith(CLIENT.id, false);
    expect(mocks.toast).toHaveBeenCalledWith("Cliente desarchivado", { description: "Ana Gómez" });
  });

  it("shows an error toast when it fails", async () => {
    mocks.setClientArchived.mockResolvedValue({ ok: false, error: "unexpected" });
    renderModal("view", { ...CLIENT, enabled: false });
    await act(async () => fireEvent.click(await screen.findByRole("button", { name: "Desarchivar" })));
    expect(mocks.toast.error).toHaveBeenCalledWith("Algo salió mal. Probá de nuevo.");
  });
});

describe("ClientModal: create", () => {
  it("shows the empty form with the required-fields subtitle and the right keyboards", async () => {
    renderModal("create", null);
    expect(await screen.findByRole("dialog", { name: "Agregar cliente" })).toHaveTextContent(
      "Los campos con * son obligatorios.",
    );
    for (const label of ["Nombre *", "Apellido", "Teléfono *", "DNI", "Email"]) {
      expect(screen.getByLabelText(label)).toHaveValue("");
    }
    const phone = screen.getByLabelText("Teléfono *");
    expect(phone).toHaveAttribute("inputmode", "tel");
    expect(phone).toHaveAttribute("placeholder", "11 1234-5678");
    expect(screen.getByLabelText("DNI")).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByLabelText("Email")).toHaveAttribute("inputmode", "email");
  });

  it("marks only the name and the phone as required", async () => {
    renderModal("create", null);
    await screen.findByRole("dialog");
    expect(screen.getByText("Nombre *")).toBeInTheDocument();
    expect(screen.getByText("Teléfono *")).toBeInTheDocument();
    for (const label of ["Apellido", "DNI", "Email"]) expect(screen.queryByText(`${label} *`)).toBeNull();
  });

  it("requires the name and the phone without calling the server, and focuses the first error", async () => {
    renderModal("create", null);
    await screen.findByRole("dialog");
    await submit("Agregar cliente");

    expect(await screen.findByText("Ingresá el nombre.")).toBeInTheDocument();
    expect(screen.getByText("Ingresá el teléfono.")).toBeInTheDocument();
    const name = screen.getByLabelText("Nombre *");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Ingresá el nombre.");
    await waitFor(() => expect(name).toHaveFocus());
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("checks the DNI and the email formats", async () => {
    renderModal("create", null);
    await screen.findByRole("dialog");
    type("Nombre *", "Ana");
    type("Teléfono *", "11 1");
    type("DNI", "28a456");
    type("Email", "ana@");
    await submit("Agregar cliente");

    expect(await screen.findByText("Revisá el DNI.")).toBeInTheDocument();
    expect(screen.getByText("Revisá el formato del email.")).toBeInTheDocument();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("creates with the tidied values, toasts and opens the new client", async () => {
    mocks.createClient.mockResolvedValue({ ok: true, data: CLIENT });
    const { onModeChange } = renderModal("create", null);

    await screen.findByRole("dialog");
    type("Nombre *", "  Ana ");
    type("Apellido", "Gómez");
    type("Teléfono *", "11 1234-5678");
    type("DNI", "28.456.123");
    type("Email", " ana@example.com ");
    await submit("Agregar cliente");

    expect(mocks.createClient).toHaveBeenCalledWith({
      name: "Ana",
      surname: "Gómez",
      phoneNumber: "11 12345678",
      dni: "28456123",
      email: "ana@example.com",
    });
    expect(mocks.toast).toHaveBeenCalledWith("Cliente agregado", { description: "Ana Gómez" });
    expect(onModeChange).toHaveBeenCalledWith("view", CLIENT);
  });

  it("sends the optional fields as null when left empty", async () => {
    mocks.createClient.mockResolvedValue({ ok: true, data: CLIENT });
    renderModal("create", null);
    await screen.findByRole("dialog");
    type("Nombre *", "Zoe");
    type("Teléfono *", "11 1");
    await submit("Agregar cliente");
    expect(mocks.createClient).toHaveBeenCalledWith({
      name: "Zoe",
      surname: null,
      phoneNumber: "11 1",
      dni: null,
      email: null,
    });
  });

  it.each([
    ["dniTaken", "Ya hay un cliente con este DNI."],
    ["dniTakenArchived", "Ya hay un cliente archivado con este DNI."],
  ])("shows %s under DNI and focuses it", async (error, message) => {
    mocks.createClient.mockResolvedValue({ ok: false, error, fieldErrors: { dni: error } });
    renderModal("create", null);

    await screen.findByRole("dialog");
    type("Nombre *", "Ana");
    type("Teléfono *", "11 1");
    type("DNI", "28456123");
    await submit("Agregar cliente");

    expect(await screen.findByText(message)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("DNI")).toHaveFocus());
    expect(screen.getByLabelText("DNI")).toHaveAccessibleDescription(message);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("shows a form alert for unexpected errors", async () => {
    mocks.createClient.mockResolvedValue({ ok: false, error: "unexpected" });
    renderModal("create", null);
    await screen.findByRole("dialog");
    type("Nombre *", "Ana");
    type("Teléfono *", "11 1");
    await submit("Agregar cliente");
    expect(await screen.findByText("Algo salió mal. Probá de nuevo.")).toBeInTheDocument();
  });

  it("closes with Cancelar", async () => {
    const { onOpenChange } = renderModal("create", null);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("ClientModal: edit", () => {
  it("prefills the form (DNI without dots) under Editar cliente with the name above the subtitle", async () => {
    renderModal("edit");
    const dialog = await screen.findByRole("dialog", { name: "Editar cliente" });
    expect(dialog).toHaveTextContent("Ana GómezLos campos con * son obligatorios.");
    expect(screen.getByLabelText("Nombre *")).toHaveValue("Ana");
    expect(screen.getByLabelText("Apellido")).toHaveValue("Gómez");
    expect(screen.getByLabelText("Teléfono *")).toHaveValue("11 12345678");
    expect(screen.getByLabelText("DNI")).toHaveValue("28456123");
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
  });

  it("prefills empty optional fields as empty", async () => {
    renderModal("edit", { ...CLIENT, surname: null, dni: null, email: null });
    await screen.findByRole("dialog");
    for (const label of ["Apellido", "DNI", "Email"]) expect(screen.getByLabelText(label)).toHaveValue("");
  });

  it("goes back to the details with Cancelar", async () => {
    const { onModeChange } = renderModal("edit");
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(onModeChange).toHaveBeenCalledWith("view");
  });

  it("saves and returns to the details with Cambios guardados", async () => {
    const updated = { ...CLIENT, email: null };
    mocks.updateClient.mockResolvedValue({ ok: true, data: updated });
    const { onModeChange } = renderModal("edit");

    await screen.findByRole("dialog");
    type("Email", "");
    await submit("Guardar cambios");

    expect(mocks.updateClient).toHaveBeenCalledWith(CLIENT.id, {
      name: "Ana",
      surname: "Gómez",
      phoneNumber: "11 12345678",
      dni: "28456123",
      email: null,
    });
    expect(mocks.toast).toHaveBeenCalledWith("Cambios guardados", { description: "Ana Gómez" });
    expect(onModeChange).toHaveBeenCalledWith("view", updated);
  });

  it.each([
    ["untouched", {}],
    ["only extra spaces and dots", { name: "  Ana ", dni: "28.456.123", phone: "11 1234-5678" }],
  ])("goes back to the details without saving when the form is %s", async (_case, edits) => {
    const { onModeChange } = renderModal("edit");
    await screen.findByRole("dialog");
    if ("name" in edits) type("Nombre *", edits.name!);
    if ("dni" in edits) type("DNI", edits.dni!);
    if ("phone" in edits) type("Teléfono *", edits.phone!);
    await submit("Guardar cambios");

    expect(mocks.updateClient).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(onModeChange).toHaveBeenCalledWith("view");
  });

  it("lets an archived client be edited like an active one", async () => {
    const archived = { ...CLIENT, enabled: false };
    mocks.updateClient.mockResolvedValue({ ok: true, data: { ...archived, name: "Anita" } });
    renderModal("edit", archived);
    await screen.findByRole("dialog");
    type("Nombre *", "Anita");
    await submit("Guardar cambios");
    expect(mocks.updateClient).toHaveBeenCalledWith(archived.id, expect.objectContaining({ name: "Anita" }));
  });

  it("shows a DNI taken by another client under DNI", async () => {
    mocks.updateClient.mockResolvedValue({ ok: false, error: "dniTaken", fieldErrors: { dni: "dniTaken" } });
    const { onModeChange } = renderModal("edit");
    await screen.findByRole("dialog");
    type("DNI", "11111111");
    await submit("Guardar cambios");
    expect(await screen.findByText("Ya hay un cliente con este DNI.")).toBeInTheDocument();
    expect(onModeChange).not.toHaveBeenCalled();
  });
});
