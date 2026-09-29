import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TopBar } from "./top-bar";

describe("TopBar", () => {
  it("shows only the app name without a shop", () => {
    render(<TopBar appName="Torque" />);
    expect(screen.getByRole("banner")).toHaveTextContent(/^Torque$/);
  });

  it("shows the app name and the shop name", () => {
    render(<TopBar appName="Torque" shopName="Taller Ejemplo" />);
    expect(screen.getByRole("banner")).toHaveTextContent(
      "Torque×Taller Ejemplo",
    );
  });
});
