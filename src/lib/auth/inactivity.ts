// 24-hour sliding inactivity window (specs/002-login/design.md).

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const SESSION_IDLE_LIMIT_MS = 24 * HOUR;
export const SESSION_MAX_AGE_SECONDS = SESSION_IDLE_LIMIT_MS / 1000;

// Rewriting the cookie on every request is wasteful; a 5-minute granularity
// keeps the window at 24 h ± 5 min.
export const STAMP_REFRESH_INTERVAL_MS = 5 * MINUTE;

// A missing stamp or one in the future can't be trusted, so both count as idle.
export function isSessionIdle(lastSeenAt: number | null, now: number): boolean {
  if (lastSeenAt === null || lastSeenAt > now) return true;
  return now - lastSeenAt > SESSION_IDLE_LIMIT_MS;
}

export function shouldRefreshStamp(lastSeenAt: number | null, now: number): boolean {
  return lastSeenAt === null || now - lastSeenAt >= STAMP_REFRESH_INTERVAL_MS;
}
