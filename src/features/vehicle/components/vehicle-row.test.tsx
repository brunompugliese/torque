import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import type { Vehicle } from "../schemas";
import { VehicleRow, VehicleRowsSkeleton } from "./vehicle-row";

const VEHICLE: Vehicle = {
  id: "v1",
  plate: "AB123CD",
  brandName: "Fiat",
  modelName: "Cronos",
  year: 2021,
  vin: "8AP359A1XMU123456",
  enabled: true,
};

describe("VehicleRow", () => {
  it("shows the plate drawn, brand and model, then year and VIN in secondary color", () => {
    const { container } = renderWithIntl(<VehicleRow vehicle={VEHICLE} />);
    expect(container.querySelector('[data-slot="plate"]')).toHaveTextContent("AB 123 CD");
    expect(screen.getByText("Fiat Cronos")).toHaveClass("font-medium");
    expect(screen.getByText("2021 · 8AP359A1XMU123456")).toHaveClass("text-muted-foreground");
    expect(screen.queryByText("Archivado")).toBeNull();
  });

  it("shows Sin VIN when there is none", () => {
    renderWithIntl(<VehicleRow vehicle={{ ...VEHICLE, vin: null }} />);
    expect(screen.getByText("2021 · Sin VIN")).toBeInTheDocument();
  });

  it("leaves the year out when there is none", () => {
    renderWithIntl(<VehicleRow vehicle={{ ...VEHICLE, year: null, vin: null }} />);
    expect(screen.getByText("Sin VIN")).toBeInTheDocument();
  });

  it("shows the badge when archived", () => {
    renderWithIntl(<VehicleRow vehicle={{ ...VEHICLE, enabled: false }} />);
    expect(screen.getByText("Archivado")).toBeInTheDocument();
  });

  it("accepts extra classes", () => {
    const { container } = renderWithIntl(<VehicleRow vehicle={VEHICLE} className="flex-1" />);
    expect(container.firstChild).toHaveClass("flex-1");
  });
});

describe("VehicleRowsSkeleton", () => {
  it("is a busy region announced once, with placeholder rows", () => {
    const { container } = renderWithIntl(<VehicleRowsSkeleton rows={3} />);
    expect(container.firstChild).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getAllByTestId("skeleton-block")).toHaveLength(9);
  });
});
