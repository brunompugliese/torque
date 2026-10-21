import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WhatsappButton } from "./whatsapp-button";

function renderButton(phone = "11 1234-5678") {
  render(<WhatsappButton phone={phone} label="Escribir por WhatsApp" text="WhatsApp" />);
  return screen.getByRole("link", { name: "Escribir por WhatsApp" });
}

describe("WhatsappButton", () => {
  it("links to the chat with the normalized number, in a new tab", () => {
    const link = renderButton();
    expect(link).toHaveAttribute("href", "https://wa.me/5491112345678");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows the icon and the visible word, and the accessible name contains that word", () => {
    const link = renderButton();
    expect(link).toHaveTextContent("WhatsApp");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(link.getAttribute("aria-label")).toContain("WhatsApp");
  });

  it("is green with no border or fill at rest", () => {
    const link = renderButton();
    expect(link).toHaveClass("text-whatsapp", "border-transparent");
    expect(link).not.toHaveClass("bg-whatsapp/10");
  });

  it("gets a light green fill and border on hover and on keyboard focus", () => {
    const link = renderButton();
    expect(link).toHaveClass("hover:bg-whatsapp/10", "hover:border-whatsapp/40");
    expect(link).toHaveClass("focus-visible:bg-whatsapp/10", "focus-visible:border-whatsapp/40", "focus-visible:ring-3");
  });

  it("always renders, whatever the phone is", () => {
    expect(renderButton("abc")).toHaveAttribute("href", "https://wa.me/549");
  });
});
