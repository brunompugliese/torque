import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import type { JobSheet } from "../sheet";
import { JobSheetView } from "./job-sheet";

const SHEET: JobSheet = {
  number: "N° 000123",
  shop: { name: "Taller Ejemplo", address: "Av. Siempreviva 742", phone: "11 1234-5678", hasLogo: true },
  createdOn: "27/10/2026",
  printedOn: "28/10/2026",
  plate: "AB 123 CD",
  vehicle: "Chevrolet S10 2025",
  vin: "8AP359A1XMU123456",
  client: "Juan Pérez",
  clientPhone: "11 1234-5678",
  kilometers: "20.257 km",
  services: [
    { id: "i1", name: "Service de 10.000 km", quantity: 1 },
    { id: "i2", name: "Cambio de pastillas de freno", quantity: 2 },
  ],
};

function renderSheet(sheet: Partial<JobSheet> = {}) {
  return renderWithIntl(<JobSheetView sheet={{ ...SHEET, ...sheet }} />);
}

describe("JobSheetView header", () => {
  it("shows the shop's logo, name, address and phone, the number as the title and the creation date", () => {
    const { container } = renderSheet();
    expect(container.querySelector("img")).toHaveAttribute("src", "/logo");
    expect(screen.getByText("Taller Ejemplo", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Av. Siempreviva 742 · Tel. 11 1234-5678")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "N° 000123" })).toBeInTheDocument();
    expect(screen.getByText("Creado el 27/10/2026")).toBeInTheDocument();
  });

  it("draws the app's mark when the shop has no logo", () => {
    const { container } = renderSheet({ shop: { ...SHEET.shop, hasLogo: false } });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-slot="logo-mark"]')).toBeInTheDocument();
  });

  it("leaves out a missing address or phone, not showing them empty", () => {
    const { unmount } = renderSheet({ shop: { ...SHEET.shop, address: null } });
    expect(screen.getByText("Tel. 11 1234-5678")).toBeInTheDocument();
    unmount();
    renderSheet({ shop: { ...SHEET.shop, phone: null } });
    expect(screen.getByText("Av. Siempreviva 742")).toBeInTheDocument();
  });

  it("falls back to the app's name without a shop", () => {
    renderSheet({ shop: { name: null, address: null, phone: null, hasLogo: false } });
    expect(screen.getAllByText("Torque").length).toBeGreaterThan(0);
  });
});

describe("JobSheetView data", () => {
  it("shows the plate as plain text, the vehicle, the client, their phone and the kilometers, and no status", () => {
    const { container } = renderSheet();
    const data = screen.getByText("Patente").closest("dl") as HTMLElement;
    expect(container.querySelector('[data-slot="plate"]')).toBeNull();
    for (const text of ["AB 123 CD", "Chevrolet S10 2025", "8AP359A1XMU123456", "Juan Pérez", "11 1234-5678", "20.257 km"]) {
      expect(within(data).getByText(text)).toBeInTheDocument();
    }
    expect(screen.queryByText("Estado")).toBeNull();
  });

  it("words the missing values", () => {
    renderSheet({ client: null, clientPhone: null, kilometers: null, vin: null });
    expect(screen.getByText("Sin cliente")).toBeInTheDocument();
    expect(screen.getAllByText("Sin cargar")).toHaveLength(3);
  });
});

describe("JobSheetView services", () => {
  it("lists a numbered block per service, in order, with the quantity and a Hecho box", () => {
    renderSheet();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("1")).toBeInTheDocument();
    expect(within(items[0]).getByText("Service de 10.000 km")).toBeInTheDocument();
    expect(within(items[0]).getByText("x 1")).toBeInTheDocument();
    expect(within(items[1]).getByText("x 2")).toBeInTheDocument();
    for (const item of items) {
      expect(within(item).getByText("Hecho")).toBeInTheDocument();
      expect(within(item).queryByText("Trabajo realizado")).not.toBeInTheDocument();
    }
  });

  it("leaves blank space to write in under every service, with no ruled lines, and keeps a block whole", () => {
    renderSheet();
    const [first] = within(screen.getByRole("list")).getAllByRole("listitem");
    const space = first.querySelector('div[aria-hidden="true"]') as HTMLElement;
    expect(space).toHaveClass("h-[66px]");
    expect(first.querySelectorAll('[class*="border-b border-foreground/40"]')).toHaveLength(0);
    expect(first).toHaveClass("break-inside-avoid");
  });

  it("says so when there are no services, with no blocks", () => {
    renderSheet({ services: [] });
    expect(screen.getByText("Sin servicios cargados.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("JobSheetView end of the sheet", () => {
  it("has a blank Observaciones box, the signature and the aclaración together, and the footer", () => {
    renderSheet();
    const observations = screen.getByRole("heading", { name: "Observaciones" }).closest("section") as HTMLElement;
    expect(observations.textContent).toBe("Observaciones");
    const end = observations.parentElement as HTMLElement;
    expect(end).toHaveClass("break-inside-avoid");
    expect(within(end).getByText("Firma del cliente")).toBeInTheDocument();
    expect(within(end).getByText("Aclaración")).toBeInTheDocument();
    expect(within(end).getByText("Taller Ejemplo")).toBeInTheDocument();
    expect(within(end).getByText("Impreso el 28/10/2026")).toBeInTheDocument();
  });

  it("shows no price, total or status anywhere", () => {
    const { container } = renderSheet();
    expect(container.textContent).not.toMatch(/\$|Total|Precio|Presupuestado|Final/);
  });
});
