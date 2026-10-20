import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Enforces docs/conventions.md#colors-and-theming: colors live only in
// globals.css, so components must use theme tokens.

const TAILWIND_COLOR_UTILITIES =
  "bg|text|border|ring|fill|stroke|outline|from|via|to|shadow|decoration|accent|caret|divide|placeholder";
const TAILWIND_PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const RULES: { name: string; pattern: RegExp }[] = [
  {
    name: "hex color",
    pattern: /(?<![\w&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/i,
  },
  { name: "color function", pattern: /\b(?:rgba?|hsla?|oklch|oklab)\(/i },
  {
    name: "Tailwind palette color",
    pattern: new RegExp(
      String.raw`\b(?:${TAILWIND_COLOR_UTILITIES})-(?:(?:${TAILWIND_PALETTE})-\d{2,3}|white|black)\b`,
    ),
  },
  {
    name: "arbitrary color value",
    pattern: new RegExp(String.raw`\b(?:${TAILWIND_COLOR_UTILITIES})-\[#`),
  },
];

function findColorViolations(source: string): string[] {
  return RULES.filter(({ pattern }) => pattern.test(source)).map(
    ({ name }) => name,
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .filter((entry) => !/\.test\.(ts|tsx)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

describe("findColorViolations", () => {
  it.each([
    ['<div className="bg-[#2F7A78]" />', "hex color"],
    ['style={{ color: "rgb(0 0 0)" }}', "color function"],
    ['<p className="text-gray-500" />', "Tailwind palette color"],
    ['<div className="bg-white" />', "Tailwind palette color"],
    ['<div className="border-[#fff]" />', "arbitrary color value"],
  ])("flags %s", (source, rule) => {
    expect(findColorViolations(source)).toContain(rule);
  });

  it.each([
    '<div className="bg-primary text-primary-foreground" />',
    '<div className="bg-primary/10 border-border" />',
    '<div className="bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]" />',
    '<a href="#main" />',
  ])("allows %s", (source) => {
    expect(findColorViolations(source)).toEqual([]);
  });
});

describe("token contrast", () => {
  const css = readFileSync(join(__dirname, "app", "globals.css"), "utf8");

  function token(name: string): string {
    const match = new RegExp(String.raw`--${name}:\s*(#[0-9a-f]{6})`, "i").exec(css);
    if (!match) throw new Error(`--${name} not found in globals.css`);
    return match[1];
  }

  function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5]
      .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
      .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrast(a: string, b: string): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  }

  // The hover fill: the token at 10% over the card, as bg-whatsapp/10 draws it.
  function tint(foreground: string, background: string, alpha: number): string {
    const channels = [1, 3, 5].map((start) => {
      const fg = parseInt(foreground.slice(start, start + 2), 16);
      const bg = parseInt(background.slice(start, start + 2), 16);
      return Math.round(fg * alpha + bg * (1 - alpha))
        .toString(16)
        .padStart(2, "0");
    });
    return `#${channels.join("")}`;
  }

  it("keeps the WhatsApp text at 4.5:1 (AA) on the card surface", () => {
    expect(contrast(token("whatsapp"), token("card"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the WhatsApp text at 4.5:1 (AA) on its hover fill", () => {
    const fill = tint(token("whatsapp"), token("card"), 0.1);
    expect(contrast(token("whatsapp"), fill)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the plate characters at 4.5:1 on the plate", () => {
    expect(contrast(token("plate-foreground"), token("plate"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("app source uses theme tokens only", () => {
  const root = join(__dirname, "..");
  const files = [
    // All of src (components, app, features, lib); globals.css isn't a
    // .ts/.tsx file, so the one place colors are defined stays exempt.
    ...sourceFiles(join(root, "src")),
  ];

  it.each(files.map((file) => [relative(root, file), file]))(
    "%s",
    (_name, file) => {
      expect(findColorViolations(readFileSync(file, "utf8"))).toEqual([]);
    },
  );
});
