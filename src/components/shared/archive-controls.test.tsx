import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ArchiveFlow } from "@/hooks/use-archive-flow";
import { renderWithIntl } from "@/test/render";

import { ArchiveConfirmDialog, ArchiveToggleButton } from "./archive-controls";

function makeFlow(overrides: Partial<ArchiveFlow> = {}): ArchiveFlow {
  return {
    confirmOpen: false,
    setConfirmOpen: vi.fn(),
    pending: false,
    askToArchive: vi.fn(),
    archive: vi.fn(),
    unarchive: vi.fn(),
    ...overrides,
  };
}

describe("ArchiveToggleButton", () => {
  it("shows Archivar for an active record and asks first", () => {
    const flow = makeFlow();
    renderWithIntl(<ArchiveToggleButton archived={false} flow={flow} />);
    expect(screen.queryByRole("button", { name: "Desarchivar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Archivar" }));
    expect(flow.askToArchive).toHaveBeenCalledOnce();
    expect(flow.unarchive).not.toHaveBeenCalled();
  });

  it("shows Desarchivar for an archived record and restores it right away", () => {
    const flow = makeFlow();
    renderWithIntl(<ArchiveToggleButton archived flow={flow} />);
    expect(screen.queryByRole("button", { name: "Archivar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Desarchivar" }));
    expect(flow.unarchive).toHaveBeenCalledOnce();
    expect(flow.askToArchive).not.toHaveBeenCalled();
  });

  it("is disabled while an action runs", () => {
    renderWithIntl(<ArchiveToggleButton archived flow={makeFlow({ pending: true })} />);
    expect(screen.getByRole("button", { name: "Desarchivar" })).toBeDisabled();
  });
});

describe("ArchiveConfirmDialog", () => {
  it("shows the title with the shared text and the entity's own sentence", () => {
    renderWithIntl(
      <ArchiveConfirmDialog flow={makeFlow({ confirmOpen: true })} title="¿Archivar este cliente?" detail="Sus vehículos no cambian." />,
    );
    const dialog = screen.getByRole("alertdialog", { name: "¿Archivar este cliente?" });
    expect(dialog).toHaveTextContent(
      "Va a dejar de aparecer en el listado. Lo podés ver activando Mostrar archivados y desarchivarlo cuando quieras.",
    );
    expect(dialog).toHaveTextContent("Sus vehículos no cambian.");
  });

  it("works without an entity sentence", () => {
    renderWithIntl(<ArchiveConfirmDialog flow={makeFlow({ confirmOpen: true })} title="¿Archivar este vehículo?" />);
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Va a dejar de aparecer en el listado.");
  });

  it("is closed until the flow opens it", () => {
    renderWithIntl(<ArchiveConfirmDialog flow={makeFlow()} title="¿Archivar?" />);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("archives on Archivar and only asks to close on Cancelar", () => {
    const flow = makeFlow({ confirmOpen: true });
    renderWithIntl(<ArchiveConfirmDialog flow={flow} title="¿Archivar?" />);
    const dialog = screen.getByRole("alertdialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(flow.archive).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Archivar" }));
    expect(flow.archive).toHaveBeenCalledOnce();
  });
});
