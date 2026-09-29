import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders the title as the page heading", () => {
    render(<PageHeader title="Vehículos" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Vehículos" }),
    ).toBeInTheDocument();
  });

  it("renders the optional description and actions", () => {
    render(
      <PageHeader
        title="Vehículos"
        description="Todos los vehículos del taller"
        actions={<button type="button">Nuevo</button>}
      />,
    );
    expect(screen.getByText("Todos los vehículos del taller")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuevo" })).toBeInTheDocument();
  });
});
