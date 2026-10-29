import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("the sheet's page rule", () => {
  const css = readFileSync(join(__dirname, "sheet.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("is A4 with no margin, so the browser prints neither its own date nor the app's address", () => {
    expect(css).toMatch(/@page\s*{[^}]*size:\s*A4/);
    expect(css).toMatch(/@page\s*{[^}]*margin:\s*0\s*;/);
  });
});
