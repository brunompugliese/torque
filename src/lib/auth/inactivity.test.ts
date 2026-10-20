import { describe, expect, it } from "vitest";

import { isSessionIdle, shouldRefreshStamp } from "./inactivity";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOW = Date.UTC(2026, 8, 29, 12, 0, 0);

describe("isSessionIdle", () => {
  it.each([
    ["used 1 minute ago", NOW - MINUTE, false],
    ["used 23 h 59 m ago", NOW - 24 * HOUR + MINUTE, false],
    ["used exactly 24 h ago", NOW - 24 * HOUR, false],
    ["used 24 h 1 m ago", NOW - 24 * HOUR - MINUTE, true],
    ["used 3 days ago", NOW - 72 * HOUR, true],
    ["no stamp", null, true],
    ["stamp in the future", NOW + MINUTE, true],
  ])("%s → idle: %s", (_label, lastSeenAt, expected) => {
    expect(isSessionIdle(lastSeenAt, NOW)).toBe(expected);
  });
});

describe("shouldRefreshStamp", () => {
  it.each([
    ["no stamp", null, true],
    ["4 minutes old", NOW - 4 * MINUTE, false],
    ["5 minutes old", NOW - 5 * MINUTE, true],
    ["1 hour old", NOW - HOUR, true],
  ])("%s → refresh: %s", (_label, lastSeenAt, expected) => {
    expect(shouldRefreshStamp(lastSeenAt, NOW)).toBe(expected);
  });
});
