import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithIntl } from "@/test/render";

import { ClientSummary } from "./client-summary";

const CLIENT = { name: "Martín", surname: "Suárez", phoneNumber: "11 5555-0101", enabled: true };

describe("ClientSummary", () => {
  it("shows the name, the phone as text and the WhatsApp button", () => {
    renderWithIntl(<ClientSummary client={CLIENT} noClient="Sin cliente" />);
    expect(screen.getByText("Martín Suárez")).toBeInTheDocument();
    expect(screen.getByText(/11 5555-0101/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Escribir por WhatsApp" })).toBeInTheDocument();
    expect(screen.queryByText("Archivado")).toBeNull();
  });

  it("marks an archived client", () => {
    renderWithIntl(<ClientSummary client={{ ...CLIENT, enabled: false }} noClient="Sin cliente" />);
    expect(screen.getByText("Archivado")).toBeInTheDocument();
    expect(screen.getByText("Martín Suárez")).toHaveClass("text-muted-foreground");
  });

  it("says what the caller says when there is no client", () => {
    renderWithIntl(<ClientSummary client={null} noClient="Sin cliente" />);
    expect(screen.getByText("Sin cliente")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
