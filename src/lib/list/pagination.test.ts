import { describe, expect, it } from "vitest";

import { pageCount, pageRange, pageWindow } from "./pagination";

describe("pageCount", () => {
  it.each([
    [0, 1],
    [1, 1],
    [25, 1],
    [26, 2],
    [140, 6],
  ])("%i rows → %i pages", (total, expected) => {
    expect(pageCount(total, 25)).toBe(expected);
  });
});

describe("pageRange", () => {
  it.each([
    [1, 140, { from: 1, to: 25 }],
    [2, 140, { from: 26, to: 50 }],
    [6, 140, { from: 126, to: 140 }],
    [1, 0, { from: 0, to: 0 }],
  ])("page %i of %i rows", (page, total, expected) => {
    expect(pageRange(page, 25, total)).toEqual(expected);
  });
});

describe("pageWindow", () => {
  it.each([
    [1, 1, [1]],
    [1, 3, [1, 2, 3]],
    [1, 12, [1, 2, "gap", 12]],
    [5, 12, [1, "gap", 4, 5, 6, "gap", 12]],
    [3, 12, [1, 2, 3, 4, "gap", 12]],
    [12, 12, [1, "gap", 11, 12]],
    [4, 6, [1, 2, 3, 4, 5, 6]],
  ])("page %i of %i", (current, count, expected) => {
    expect(pageWindow(current, count)).toEqual(expected);
  });
});
