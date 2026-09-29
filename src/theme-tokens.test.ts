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
