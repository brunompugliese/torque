import { describe, expect, it } from "vitest";

import { toWhatsappUrl } from "./whatsapp";

describe("toWhatsappUrl", () => {
  it("keeps the digits and adds 549", () => {
    expect(toWhatsappUrl("11 1234-5678")).toBe("https://wa.me/5491112345678");
  });

  it("drops leading zeros", () => {
    expect(toWhatsappUrl("011 4444-5555")).toBe("https://wa.me/5491144445555");
  });

  it("ignores any other symbol", () => {
    expect(toWhatsappUrl("(011) 4444.5555")).toBe("https://wa.me/5491144445555");
  });

  it("keeps a number that already starts with 54", () => {
    expect(toWhatsappUrl("+54 9 11 4444-5555")).toBe("https://wa.me/5491144445555");
  });

  it("appends the message, fully encoded", () => {
    expect(toWhatsappUrl("11 1234-5678", "Hola Ana\n• Service: $ 1.000 ¡Gracias!")).toBe(
      "https://wa.me/5491112345678?text=Hola%20Ana%0A%E2%80%A2%20Service%3A%20%24%201.000%20%C2%A1Gracias!",
    );
  });

  it("adds no query without a message", () => {
    expect(toWhatsappUrl("11 1234-5678", "")).toBe("https://wa.me/5491112345678");
  });

  it("always returns a link, whatever the phone is", () => {
    expect(toWhatsappUrl("abc")).toBe("https://wa.me/549");
    expect(toWhatsappUrl("")).toBe("https://wa.me/549");
  });
});
