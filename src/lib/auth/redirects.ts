export const LOGIN_PATH = "/ingresar";
export const SIGN_OUT_PATH = "/salir";
export const HOME_PATH = "/";

// Values of the `motivo` query parameter on the login page.
export const SIGN_OUT_REASONS = {
  inactivity: "inactividad",
  account: "cuenta",
} as const;

export type SignOutReason = (typeof SIGN_OUT_REASONS)[keyof typeof SIGN_OUT_REASONS];

// Returning here after signing in would be pointless (login) or would sign
// the user straight out again (sign-out).
const NON_RETURNABLE_PATHS = [LOGIN_PATH, SIGN_OUT_PATH];

const SAFE_BASE = "http://localhost";

// Only same-site relative paths survive; everything else becomes "/". This is
// what stops `?next=` from being used as an open redirect.
export function getSafeRedirectPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return HOME_PATH;
  }
  // Control characters (including tabs/newlines browsers strip) and
  // backslashes, which some browsers treat like "/".
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return HOME_PATH;
  if (!value.startsWith("/") || value.startsWith("//")) return HOME_PATH;

  let url: URL;
  try {
    url = new URL(value, SAFE_BASE);
  } catch {
    return HOME_PATH;
  }
  if (url.origin !== SAFE_BASE) return HOME_PATH;

  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (NON_RETURNABLE_PATHS.includes(pathname)) return HOME_PATH;

  return `${url.pathname}${url.search}${url.hash}`;
}

export type AuthRedirectDecision = { redirectTo: string } | null;

// The proxy's optimistic routing rule: only the login page is reachable
// without a session.
export function resolveAuthRedirect(
  pathname: string,
  search: string,
  isAuthenticated: boolean,
): AuthRedirectDecision {
  if (pathname === LOGIN_PATH) {
    return isAuthenticated ? { redirectTo: HOME_PATH } : null;
  }
  if (isAuthenticated) return null;

  const next = getSafeRedirectPath(`${pathname}${search}`);
  return {
    redirectTo: next === HOME_PATH ? LOGIN_PATH : `${LOGIN_PATH}?next=${encodeURIComponent(next)}`,
  };
}
