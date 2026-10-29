import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "@/test/render";

import { PrintControls } from "./print-controls";

const print = vi.fn();

beforeEach(() => {
  print.mockReset();
  window.print = print;
});

afterEach(() => {
  document.body.querySelectorAll("img").forEach((image) => image.remove());
});

describe("PrintControls", () => {
  it("opens the print dialog once, when the page is ready", async () => {
    renderWithIntl(<PrintControls />);
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  });

  it("waits for the logo, loaded or failed", async () => {
    const image = document.createElement("img");
    Object.defineProperty(image, "complete", { value: false });
    document.body.append(image);

    renderWithIntl(<PrintControls />);
    await Promise.resolve();
    expect(print).not.toHaveBeenCalled();

    fireEvent.error(image);
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  });

  it("prints again from its button, which is hidden on paper", async () => {
    renderWithIntl(<PrintControls />);
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));

    const button = screen.getByRole("button", { name: "Imprimir" });
    fireEvent.click(button);
    expect(print).toHaveBeenCalledTimes(2);
    expect(button.parentElement).toHaveClass("print:hidden");
  });
});
