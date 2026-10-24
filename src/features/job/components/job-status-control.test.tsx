import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import type { JobListItem } from "../schemas";

const mocks = vi.hoisted(() => ({
  setJobStatus: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("../actions", () => ({ setJobStatus: mocks.setJobStatus }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { JobStatusControl } from "./job-status-control";

const JOB: Pick<JobListItem, "id" | "status" | "enabled" | "vehicle"> = {
  id: "j1",
  status: "pendiente",
  enabled: true,
  vehicle: { id: "v1", plate: "AB123CD", year: 2021, brandName: "Fiat", modelName: "Cronos", enabled: true },
};

function press(option: HTMLElement) {
  fireEvent.pointerDown(option);
  fireEvent.mouseDown(option);
  fireEvent.pointerUp(option);
  fireEvent.mouseUp(option);
  fireEvent.click(option);
}

async function choose(name: string) {
  fireEvent.click(screen.getByRole("combobox"));
  press(await screen.findByRole("option", { name }));
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.toast.error = vi.fn();
});

describe("JobStatusControl", () => {
  it("is a dropdown for an open, active job", () => {
    renderWithIntl(<JobStatusControl job={JOB} />);
    expect(screen.getByRole("combobox", { name: "Cambiar estado: Pendiente" })).toBeInTheDocument();
  });

  it.each([["entregado", "Entregado"], ["cancelado", "Cancelado"]] as const)(
    "is a pill with a lock inside for a %s job, with the reason for a screen reader only",
    (status, label) => {
      renderWithIntl(<JobStatusControl job={{ ...JOB, status }} />);
      expect(screen.queryByRole("combobox")).toBeNull();
      const pill = screen.getByText(label);
      expect(pill.querySelector("svg")).not.toBeNull();
      expect(screen.getByText("Cerrado, no se puede editar")).toHaveClass("sr-only");
    },
  );

  it("shows the lock on a closed job even when archived or read only", () => {
    const { unmount } = renderWithIntl(<JobStatusControl job={{ ...JOB, status: "entregado", enabled: false }} />);
    expect(screen.getByText("Entregado").querySelector("svg")).not.toBeNull();
    unmount();
    renderWithIntl(<JobStatusControl job={{ ...JOB, status: "cancelado" }} readOnly />);
    expect(screen.getByText("Cancelado").querySelector("svg")).not.toBeNull();
  });

  it("has no lock on an open job that is archived or read only", () => {
    renderWithIntl(<JobStatusControl job={{ ...JOB, enabled: false }} readOnly />);
    expect(screen.getByText("Pendiente").querySelector("svg")).toBeNull();
  });

  it("is a plain pill for an archived job and when read only", () => {
    const { unmount } = renderWithIntl(<JobStatusControl job={{ ...JOB, enabled: false }} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    unmount();
    renderWithIntl(<JobStatusControl job={JOB} readOnly />);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("changes an open status right away, shows it, confirms with a toast and tells its host", async () => {
    mocks.setJobStatus.mockResolvedValue({ ok: true, data: { ...JOB, status: "en_progreso" } });
    const onChanged = vi.fn();
    renderWithIntl(<JobStatusControl job={JOB} onChanged={onChanged} />);
    await choose("En progreso");

    await waitFor(() => expect(mocks.setJobStatus).toHaveBeenCalledWith("j1", "en_progreso"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(mocks.toast).toHaveBeenCalledWith("Estado actualizado", { description: "AB 123 CD, Fiat Cronos" });
    expect(screen.getByRole("combobox", { name: "Cambiar estado: En progreso" })).toBeInTheDocument();
  });

  it.each([
    ["Entregado", "entregado"],
    ["Cancelado", "cancelado"],
  ])("asks before closing to %s, and saves nothing on Cancelar", async (label, status) => {
    renderWithIntl(<JobStatusControl job={JOB} />);
    await choose(label);

    const dialog = await screen.findByRole("alertdialog", { name: "¿Cerrar el trabajo?" });
    expect(dialog).toHaveTextContent(`Va a quedar como ${status} y no se va a poder editar más.`);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(mocks.setJobStatus).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox", { name: "Cambiar estado: Pendiente" })).toBeInTheDocument();
  });

  it("saves the close once confirmed", async () => {
    mocks.setJobStatus.mockResolvedValue({ ok: true, data: { ...JOB, status: "entregado" } });
    renderWithIntl(<JobStatusControl job={JOB} />);
    await choose("Entregado");
    fireEvent.click(await screen.findByRole("button", { name: "Guardar y cerrar" }));
    await waitFor(() => expect(mocks.setJobStatus).toHaveBeenCalledWith("j1", "entregado"));
  });

  it("keeps the old status and shows an error when the change is refused", async () => {
    mocks.setJobStatus.mockResolvedValue({ ok: false, error: "closed" });
    const onChanged = vi.fn();
    renderWithIntl(<JobStatusControl job={JOB} onChanged={onChanged} />);
    await choose("Completado");

    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith("Este trabajo ya está cerrado y no se puede editar."),
    );
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByRole("combobox", { name: "Cambiar estado: Pendiente" })).toBeInTheDocument();
  });

  it("shows the generic error for any other failure, even a thrown one", async () => {
    mocks.setJobStatus.mockRejectedValue(new Error("network"));
    renderWithIntl(<JobStatusControl job={JOB} />);
    await choose("Completado");
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Algo salió mal. Probá de nuevo."));
    expect(screen.getByRole("combobox", { name: "Cambiar estado: Pendiente" })).toBeInTheDocument();
  });

  it("doesn't let a click on the pill reach the list row behind it", () => {
    const onRowClick = vi.fn();
    renderWithIntl(
      <div onClick={onRowClick}>
        <JobStatusControl job={JOB} />
      </div>,
    );
    fireEvent.click(screen.getByRole("combobox"));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
