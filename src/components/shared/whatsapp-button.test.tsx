import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WhatsappButton } from "./whatsapp-button";

describe("WhatsappButton", () => {
  it("links to the chat with the normalized number, in a new tab", () => {
    render(<WhatsappButton phone="11 1234-5678" label="Escribir por WhatsApp" />);
    const link = screen.getByRole("link", { name: "Escribir por WhatsApp" });
    expect(link).toHaveAttribute("href", "https://wa.me/5491112345678");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows only the icon: no visible text, the name comes from the label", () => {
    render(<WhatsappButton phone="11 1234-5678" label="Escribir por WhatsApp" />);
    const link = screen.getByRole("link", { name: "Escribir por WhatsApp" });
    expect(link).toHaveTextContent("");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the WhatsApp color token", () => {
    render(<WhatsappButton phone="11 1234-5678" label="Escribir por WhatsApp" />);
    expect(screen.getByRole("link")).toHaveClass("text-whatsapp");
  });

  it("always renders, whatever the phone is", () => {
    render(<WhatsappButton phone="abc" label="Escribir por WhatsApp" />);
    expect(screen.getByRole("link", { name: "Escribir por WhatsApp" })).toHaveAttribute("href", "https://wa.me/549");
  });
});
