import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShopProvider } from "@/features/shop/shop-context";
import { renderWithIntl } from "@/test/render";

import type { JobItem, JobListItem } from "../schemas";
import { QuoteButton } from "./quote-button";

const JOB: JobListItem = {
  id: "j1",
  number: 123,
  status: "presupuesto_enviado",
  observations: null,
  kilometers: null,
  quotedTotal: 185000,
  finalTotal: null,
  enabled: true,
  createdAt: "2026-10-13T15:00:00+00:00",
  updatedAt: "2026-10-14T15:00:00+00:00",
  vehicle: { id: "v1", plate: "AF107RS", year: 2022, brandName: "Toyota", modelName: "Hilux", enabled: true },
  client: { id: "c1", name: "Carolina", surname: "Gómez", phoneNumber: "11 1234-5678", enabled: true },
  appointment: null,
};

const ITEMS: JobItem[] = [
  {
    id: "i1",
    serviceId: "s1",
    serviceName: "Service completo",
    serviceEnabled: true,
    quantity: 1,
    quotedUnitPrice: 185000,
    finalUnitPrice: null,
    createdAt: "2026-10-13T15:00:00+00:00",
  },
];

function renderButton(job: JobListItem = JOB, items: JobItem[] | null = ITEMS) {
  return renderWithIntl(
    <ShopProvider shop={{ name: "BC Motors", address: null, phone: null, hasLogo: false }}>
      <QuoteButton job={job} items={items} />
    </ShopProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("QuoteButton enabled", () => {
  it("is a link to the client's chat with the message, in a new tab", () => {
    renderButton();
    const link = screen.getByRole("link", { name: "Enviar presupuesto por mensaje a Carolina" });
    const url = new URL(link.getAttribute("href")!);
    expect(url.origin + url.pathname).toBe("https://wa.me/5491112345678");
    expect(url.searchParams.get("text")).toContain("Hola Carolina, te paso el presupuesto para tu Toyota Hilux (AF 107 RS):");
    expect(url.searchParams.get("text")).toContain("— BC Motors");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("Enviar presupuesto");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is available for Cancelado", () => {
    renderButton({ ...JOB, status: "cancelado" });
    expect(screen.getByRole("link", { name: /Enviar presupuesto/ })).toBeInTheDocument();
  });
});

describe("QuoteButton disabled", () => {
  it.each([
    ["a status without quote", { ...JOB, status: "en_progreso" as const }, ITEMS, "No disponible en este estado"],
    ["no client", { ...JOB, client: null }, ITEMS, "Cargá un cliente con teléfono"],
    ["no services", JOB, [], "Cargá al menos un servicio"],
  ])("is a real disabled button for %s, with the reason linked", (_, job, items, reason) => {
    renderButton(job, items);
    const button = screen.getByRole("button", { name: "Enviar presupuesto" });
    expect(button).toBeDisabled();
    expect(screen.queryByRole("link")).toBeNull();
    const described = button.getAttribute("aria-describedby")!;
    expect(document.getElementById(described)).toHaveTextContent(reason);
  });

  it("puts the disabled button in a keyboard-focusable tooltip trigger", () => {
    renderButton({ ...JOB, client: null });
    const wrapper = screen.getByRole("button", { name: "Enviar presupuesto" }).parentElement!;
    expect(wrapper).toHaveAttribute("tabindex", "0");
    expect(wrapper).toHaveAttribute("data-slot", "tooltip-trigger");
  });

  it("is disabled with no reason while the services load", () => {
    renderButton(JOB, null);
    const button = screen.getByRole("button", { name: "Enviar presupuesto" });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-describedby");
  });
});

describe("QuoteButton with archived records", () => {
  const ALL_ARCHIVED: JobListItem = {
    ...JOB,
    enabled: false,
    client: { ...JOB.client!, enabled: false },
    vehicle: { ...JOB.vehicle, enabled: false },
  };

  it("asks first, listing every archived one, and is a button instead of a link", async () => {
    renderButton(ALL_ARCHIVED);
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enviar presupuesto por mensaje a Carolina" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Este trabajo está archivado.")).toBeInTheDocument();
    expect(within(dialog).getByText("El cliente está archivado.")).toBeInTheDocument();
    expect(within(dialog).getByText("El vehículo está archivado.")).toBeInTheDocument();
  });

  it("lists only the archived ones", async () => {
    renderButton({ ...JOB, vehicle: { ...JOB.vehicle, enabled: false } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar presupuesto/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("El vehículo está archivado.")).toBeInTheDocument();
    expect(within(dialog).queryByText("Este trabajo está archivado.")).toBeNull();
  });

  it("opens the chat on Confirmar and closes the dialog", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderButton(ALL_ARCHIVED);
    fireEvent.click(screen.getByRole("button", { name: /Enviar presupuesto/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toMatch(/^https:\/\/wa\.me\/5491112345678\?text=/);
    expect(open.mock.calls[0].slice(1)).toEqual(["_blank", "noopener"]);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("opens nothing on Cancelar", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderButton(ALL_ARCHIVED);
    fireEvent.click(screen.getByRole("button", { name: /Enviar presupuesto/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(open).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});
