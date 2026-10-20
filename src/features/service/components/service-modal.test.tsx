import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import type { Service } from "../schemas";

const mocks = vi.hoisted(() => ({
  createService: vi.fn(),
  updateService: vi.fn(),
  setServiceArchived: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("../actions", () => ({
  createService: mocks.createService,
  updateService: mocks.updateService,
  setServiceArchived: mocks.setServiceArchived,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { ServiceModal, type ServiceModalMode } from "./service-modal";

const SERVICE: Service = {
  id: "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
  name: "Cambio de aceite",
  description: null,
  enabled: true,
  // The 13th in Argentina.
  createdAt: "2026-10-14T01:30:00+00:00",
};

function renderModal(mode: ServiceModalMode, service: Service | null = SERVICE) {
  const onModeChange = vi.fn();
  const onOpenChange = vi.fn();
  const view = renderWithIntl(
    <ServiceModal open mode={mode} service={service} onModeChange={onModeChange} onOpenChange={onOpenChange} />,
  );
  return { onModeChange, onOpenChange, ...view };
}

beforeEach(() => {
  for (const mock of [mocks.createService, mocks.updateService, mocks.setServiceArchived, mocks.toast, mocks.toast.error]) {
    mock.mockReset();
  }
});

describe("ServiceModal: details", () => {
  it("shows the name, actions, description fallback and creation date", async () => {
    renderModal("view");
    expect(await screen.findByRole("dialog", { name: "Cambio de aceite" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archivar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar servicio" })).toBeInTheDocument();
    expect(screen.getByText("Sin descripción")).toBeInTheDocument();
    expect(screen.getByText("Creado el 13/10/2026")).toBeInTheDocument();
    expect(screen.queryByText("Archivado")).toBeNull();
  });

  it("shows the badge and Desarchivar for an archived service", async () => {
    renderModal("view", { ...SERVICE, enabled: false, description: "Incluye filtro." });
    expect(await screen.findByText("Archivado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desarchivar" })).toBeInTheDocument();
    expect(screen.getByText("Incluye filtro.")).toBeInTheDocument();
  });

  it("switches to the form with Editar servicio", async () => {
    const { onModeChange } = renderModal("view");
    fireEvent.click(await screen.findByRole("button", { name: "Editar servicio" }));
    expect(onModeChange).toHaveBeenCalledWith("edit");
  });
});

describe("ServiceModal: archive", () => {
  it("asks first, then archives with a toast", async () => {
    mocks.setServiceArchived.mockResolvedValue({ ok: true, data: { ...SERVICE, enabled: false } });
    const { onModeChange, onOpenChange } = renderModal("view");

    fireEvent.click(await screen.findByRole("button", { name: "Archivar" }));
    const confirm = await screen.findByRole("alertdialog", { name: "¿Archivar este servicio?" });
    expect(confirm).toHaveTextContent("Va a dejar de aparecer en el listado.");
    expect(confirm).toHaveTextContent("No se va a poder agregar a trabajos nuevos. Los trabajos que ya lo tienen no cambian.");
    expect(mocks.setServiceArchived).not.toHaveBeenCalled();

    const buttons = screen.getAllByRole("button", { name: "Archivar" });
    await act(async () => fireEvent.click(buttons[buttons.length - 1]));

    expect(mocks.setServiceArchived).toHaveBeenCalledWith(SERVICE.id, true);
    expect(mocks.toast).toHaveBeenCalledWith("Servicio archivado", { description: "Cambio de aceite" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onModeChange).not.toHaveBeenCalled();
  });

  it("archives nothing, and keeps the modal open, when the confirmation is cancelled", async () => {
    const { onOpenChange } = renderModal("view");
    fireEvent.click(await screen.findByRole("button", { name: "Archivar" }));
    const confirm = await screen.findByRole("alertdialog");
    await act(async () => fireEvent.click(within(confirm).getByRole("button", { name: "Cancelar" })));
    expect(mocks.setServiceArchived).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("unarchives right away, without confirmation", async () => {
    mocks.setServiceArchived.mockResolvedValue({ ok: true, data: SERVICE });
    const { onOpenChange } = renderModal("view", { ...SERVICE, enabled: false });

    await act(async () => fireEvent.click(await screen.findByRole("button", { name: "Desarchivar" })));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.setServiceArchived).toHaveBeenCalledWith(SERVICE.id, false);
    expect(mocks.toast).toHaveBeenCalledWith("Servicio desarchivado", { description: "Cambio de aceite" });
  });

  it("shows an error toast when it fails", async () => {
    mocks.setServiceArchived.mockResolvedValue({ ok: false, error: "unexpected" });
    const { onOpenChange } = renderModal("view", { ...SERVICE, enabled: false });
    await act(async () => fireEvent.click(await screen.findByRole("button", { name: "Desarchivar" })));
    expect(mocks.toast.error).toHaveBeenCalledWith("Algo salió mal. Probá de nuevo.");
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("ServiceModal: create", () => {
  it("shows the empty form with the required-fields subtitle and hint", async () => {
    renderModal("create", null);
    expect(await screen.findByRole("dialog", { name: "Agregar servicio" })).toHaveTextContent(
      "Los campos con * son obligatorios.",
    );
    expect(screen.getByLabelText("Nombre *")).toHaveValue("");
    expect(screen.getByLabelText("Descripción")).toHaveAccessibleDescription("Qué incluye. Se muestra en el catálogo.");
  });

  it("leaves extra space between the last field and the footer", async () => {
    renderModal("create", null);
    await screen.findByRole("dialog");
    expect(screen.getByLabelText("Descripción").closest("form")).toHaveClass("pb-2");
  });

  it("requires a name without calling the server", async () => {
    renderModal("create", null);
    await act(async () => fireEvent.click(await screen.findByRole("button", { name: "Agregar servicio" })));
    expect(await screen.findByText("Ingresá el nombre.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre *")).toHaveAttribute("aria-invalid", "true");
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("creates, toasts and opens the new service", async () => {
    mocks.createService.mockResolvedValue({ ok: true, data: SERVICE });
    const { onModeChange } = renderModal("create", null);

    fireEvent.change(await screen.findByLabelText("Nombre *"), { target: { value: "  Cambio de aceite " } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Agregar servicio" })));

    expect(mocks.createService).toHaveBeenCalledWith({ name: "Cambio de aceite", description: null });
    expect(mocks.toast).toHaveBeenCalledWith("Servicio agregado", { description: "Cambio de aceite" });
    expect(onModeChange).toHaveBeenCalledWith("view", SERVICE);
  });

  it.each([
    ["nameTaken", "Ya hay un servicio con este nombre."],
    ["nameTakenArchived", "Ya hay un servicio archivado con este nombre."],
  ])("shows %s under Nombre and focuses it", async (error, message) => {
    mocks.createService.mockResolvedValue({ ok: false, error, fieldErrors: { name: error } });
    renderModal("create", null);

    const name = await screen.findByLabelText("Nombre *");
    fireEvent.change(name, { target: { value: "Cambio de aceite" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Agregar servicio" })));

    expect(await screen.findByText(message)).toBeInTheDocument();
    await waitFor(() => expect(name).toHaveFocus());
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("shows a form alert for unexpected errors", async () => {
    mocks.createService.mockResolvedValue({ ok: false, error: "unexpected" });
    renderModal("create", null);
    fireEvent.change(await screen.findByLabelText("Nombre *"), { target: { value: "Lavado" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Agregar servicio" })));
    expect(await screen.findByText("Algo salió mal. Probá de nuevo.")).toBeInTheDocument();
  });

  it("closes with Cancelar", async () => {
    const { onOpenChange } = renderModal("create", null);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("ServiceModal: edit", () => {
  it("prefills the form under Editar servicio with the name above the subtitle", async () => {
    renderModal("edit", { ...SERVICE, description: "Incluye filtro." });
    const dialog = await screen.findByRole("dialog", { name: "Editar servicio" });
    expect(dialog).toHaveTextContent("Cambio de aceiteLos campos con * son obligatorios.");
    expect(screen.getByLabelText("Nombre *")).toHaveValue("Cambio de aceite");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Incluye filtro.");
  });

  it("goes back to the details with Cancelar", async () => {
    const { onModeChange } = renderModal("edit");
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(onModeChange).toHaveBeenCalledWith("view");
  });

  it("saves and returns to the details with Cambios guardados", async () => {
    const updated = { ...SERVICE, description: "Incluye filtro." };
    mocks.updateService.mockResolvedValue({ ok: true, data: updated });
    const { onModeChange } = renderModal("edit");

    fireEvent.change(await screen.findByLabelText("Descripción"), { target: { value: "Incluye filtro." } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" })));

    expect(mocks.updateService).toHaveBeenCalledWith(SERVICE.id, { name: "Cambio de aceite", description: "Incluye filtro." });
    expect(mocks.toast).toHaveBeenCalledWith("Cambios guardados", { description: "Cambio de aceite" });
    expect(onModeChange).toHaveBeenCalledWith("view", updated);
  });

  it.each([
    ["untouched", "Cambio de aceite"],
    ["only extra spaces", "  Cambio   de aceite "],
  ])("goes back to the details without saving when the form is %s", async (_case, name) => {
    const { onModeChange } = renderModal("edit");

    fireEvent.change(await screen.findByLabelText("Nombre *"), { target: { value: name } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" })));

    expect(mocks.updateService).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(onModeChange).toHaveBeenCalledWith("view");
  });

  it("asks before renaming a service that is on jobs, and saves once confirmed", async () => {
    const renamed = { ...SERVICE, name: "Service completo" };
    mocks.updateService
      .mockResolvedValueOnce({ ok: false, error: "renameNeedsConfirmation" })
      .mockResolvedValueOnce({ ok: true, data: renamed });
    const { onModeChange } = renderModal("edit");

    fireEvent.change(await screen.findByLabelText("Nombre *"), { target: { value: "Service completo" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" })));

    const confirm = await screen.findByRole("alertdialog", { name: "¿Cambiar el nombre del servicio?" });
    expect(confirm).toHaveTextContent(
      "Este servicio ya se usó en trabajos. El nombre nuevo se va a ver en todos, incluso en los entregados.",
    );
    expect(mocks.toast).not.toHaveBeenCalled();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cambiar nombre" })));
    expect(mocks.updateService).toHaveBeenLastCalledWith(
      SERVICE.id,
      { name: "Service completo", description: null },
      { confirmRename: true },
    );
    expect(mocks.toast).toHaveBeenCalledWith("Cambios guardados", { description: "Service completo" });
    expect(onModeChange).toHaveBeenCalledWith("view", renamed);
  });

  it("keeps the form and saves nothing when the rename is cancelled", async () => {
    mocks.updateService.mockResolvedValue({ ok: false, error: "renameNeedsConfirmation" });
    const { onModeChange } = renderModal("edit");

    fireEvent.change(await screen.findByLabelText("Nombre *"), { target: { value: "Service completo" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" })));
    await screen.findByRole("alertdialog");
    const cancels = screen.getAllByRole("button", { name: "Cancelar" });
    await act(async () => fireEvent.click(cancels[cancels.length - 1]));

    expect(mocks.updateService).toHaveBeenCalledTimes(1);
    expect(onModeChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nombre *")).toHaveValue("Service completo");
  });
});
