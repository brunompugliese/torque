import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { ConfirmDialog } from "./confirm-dialog";
import { DetailList } from "./detail-list";
import { DetailModal, DetailModalBodySkeleton } from "./detail-modal";

describe("DetailModal closing", () => {
  it("tells when it has fully closed, not when it starts to", async () => {
    const onClosed = vi.fn();
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <DetailModal open={open} onOpenChange={setOpen} onClosed={onClosed} title="Turno">
          <p>Cuerpo</p>
        </DetailModal>
      );
    }
    renderWithIntl(<Host />);
    await screen.findByRole("dialog", { name: "Turno" });
    expect(onClosed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("DetailModal", () => {
  it("shows the title, badge, actions, body and the Creado el footer", async () => {
    renderWithIntl(
      <DetailModal
        open
        onOpenChange={() => {}}
        title="Cambio de aceite"
        badge={<span>Archivado</span>}
        actions={<button type="button">Editar servicio</button>}
        createdOn="13/10/2026"
      >
        <p>Cuerpo</p>
      </DetailModal>,
    );

    const dialog = await screen.findByRole("dialog", { name: "Cambio de aceite" });
    expect(dialog).toHaveTextContent("Archivado");
    expect(screen.getByRole("button", { name: "Editar servicio" })).toBeInTheDocument();
    expect(screen.getByText("Cuerpo")).toBeInTheDocument();
    expect(screen.getByText("Creado el 13/10/2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Volver" })).toBeNull();
  });

  it("puts the actions in the footer, after Volver, and keeps the header for the title and badges", async () => {
    renderWithIntl(
      <DetailModal
        open
        onOpenChange={() => {}}
        title="Servicio"
        badge={<span>Archivado</span>}
        onBack={() => {}}
        actions={
          <>
            <button type="button">Archivar</button>
            <button type="button">Editar servicio</button>
          </>
        }
        createdOn="13/10/2026"
      >
        <p>Cuerpo</p>
      </DetailModal>,
    );

    const footer = (await screen.findByText("Creado el 13/10/2026")).parentElement!.parentElement!;
    expect(within(footer).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Volver",
      "Archivar",
      "Editar servicio",
    ]);
    const header = screen.getByRole("dialog").querySelector('[data-slot="dialog-title"]')!.closest<HTMLElement>(".border-b")!;
    expect(within(header).queryByRole("button", { name: "Archivar" })).toBeNull();
    expect(within(header).getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });

  it("shows the footer for actions alone, without Creado el or Volver", async () => {
    renderWithIntl(
      <DetailModal open onOpenChange={() => {}} title="Servicio" actions={<button type="button">Editar servicio</button>}>
        <p>Cuerpo</p>
      </DetailModal>,
    );
    expect(await screen.findByRole("button", { name: "Editar servicio" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Volver" })).toBeNull();
  });

  it("closes with the X and goes back with Volver", async () => {
    const onOpenChange = vi.fn();
    const onBack = vi.fn();
    renderWithIntl(
      <DetailModal open onOpenChange={onOpenChange} title="Servicio" onBack={onBack}>
        <p>Cuerpo</p>
      </DetailModal>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Volver" }));
    expect(onBack).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("uses a custom footer instead of the default one", async () => {
    renderWithIntl(
      <DetailModal open onOpenChange={() => {}} title="Editar" createdOn="13/10/2026" footer={<button type="button">Guardar cambios</button>}>
        <p>Form</p>
      </DetailModal>,
    );
    expect(await screen.findByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
    expect(screen.queryByText("Creado el 13/10/2026")).toBeNull();
  });
});

describe("DetailModalBodySkeleton", () => {
  it("is a busy region announced once", () => {
    const { container } = renderWithIntl(<DetailModalBodySkeleton />);
    expect(container.firstChild).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});

describe("DetailList", () => {
  it("renders label/value pairs", () => {
    renderWithIntl(<DetailList items={[{ label: "Descripción", value: "Sin descripción" }]} />);
    expect(screen.getByText("Descripción").tagName).toBe("DT");
    expect(screen.getByText("Sin descripción").tagName).toBe("DD");
  });

  it("is one column by default and two from sm up when asked, a wide item taking the whole row", () => {
    const items = [
      { label: "Estado", value: "En progreso" },
      { label: "Observaciones", value: "Ruido", wide: true },
    ];
    const { rerender } = renderWithIntl(<DetailList items={items} />);
    expect(screen.getByText("Estado").closest("dl")).not.toHaveClass("sm:grid-cols-2");

    rerender(<DetailList items={items} twoColumns />);
    expect(screen.getByText("Estado").closest("dl")).toHaveClass("sm:grid", "sm:grid-cols-2");
    expect(screen.getByText("Observaciones").parentElement).toHaveClass("sm:col-span-2");
    expect(screen.getByText("Estado").parentElement).not.toHaveClass("sm:col-span-2");
  });
});

describe("ConfirmDialog", () => {
  it("asks, then confirms or cancels", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderWithIntl(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="¿Archivar este servicio?"
        description={<p>No se va a poder agregar a trabajos nuevos.</p>}
        confirmLabel="Archivar"
        onConfirm={onConfirm}
      />,
    );

    const dialog = await screen.findByRole("alertdialog", { name: "¿Archivar este servicio?" });
    expect(dialog).toHaveTextContent("No se va a poder agregar a trabajos nuevos.");
    fireEvent.click(screen.getByRole("button", { name: "Archivar" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables both buttons while pending", async () => {
    renderWithIntl(
      <ConfirmDialog open onOpenChange={() => {}} title="¿Seguro?" description="Algo" confirmLabel="Cambiar nombre" onConfirm={() => {}} pending />,
    );
    expect(await screen.findByRole("button", { name: "Cambiar nombre" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});
