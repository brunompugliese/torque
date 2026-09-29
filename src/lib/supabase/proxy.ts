import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isSessionIdle, shouldRefreshStamp } from "@/lib/auth/inactivity";
import { LOGIN_PATH, resolveAuthRedirect, SIGN_OUT_REASONS } from "@/lib/auth/redirects";
import { createSessionStore, SUPABASE_STORAGE_KEY } from "@/lib/auth/session-store";
import { importAesKey } from "@/lib/crypto/aes-gcm";
import { getServerEnv } from "@/lib/env";

// Runs on every request (see src/proxy.ts): refreshes the Supabase session,
// enforces the 24-hour inactivity window and routes signed-out visitors to
// the login page. This is the optimistic layer; requireSession() in the DAL
// is the authoritative check.
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const env = getServerEnv();
  const store = await createSessionStore({
    cookies: request.cookies.getAll(),
    key: await importAesKey(env.SESSION_COOKIE_SECRET),
    secure: process.env.NODE_ENV !== "development",
  });

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookieOptions: { name: SUPABASE_STORAGE_KEY },
    cookies: store.supabaseCookies,
  });

  // Verifies the access token and, if it expired, refreshes it with the
  // refresh token. Must run before anything else reads the session.
  const { data } = await supabase.auth.getClaims();
  const now = Date.now();
  let redirectTo: URL | null = null;

  if (data?.claims && isSessionIdle(store.lastSeenAt, now)) {
    // Revokes the refresh token in Supabase Auth, so a copied cookie is
    // useless too, then drops the local cookies.
    await supabase.auth.signOut({ scope: "local" });
    store.clear();
    redirectTo = new URL(LOGIN_PATH, request.url);
    redirectTo.searchParams.set("motivo", SIGN_OUT_REASONS.inactivity);
  } else {
    const isAuthenticated = Boolean(data?.claims);
    if (isAuthenticated && shouldRefreshStamp(store.lastSeenAt, now)) {
      store.touch(now);
    }
    const decision = resolveAuthRedirect(
      request.nextUrl.pathname,
      request.nextUrl.search,
      isAuthenticated,
    );
    if (decision) redirectTo = new URL(decision.redirectTo, request.url);
  }

  const writes = await store.commit();
  // The request copy lets Server Components in this same request see the
  // refreshed session; the response copy reaches the browser.
  for (const { name, value, options } of writes) {
    if (options.maxAge === 0) request.cookies.delete(name);
    else request.cookies.set(name, value);
  }

  const response = redirectTo ? NextResponse.redirect(redirectTo) : NextResponse.next({ request });
  for (const { name, value, options } of writes) {
    response.cookies.set(name, value, options);
  }
  for (const [name, value] of Object.entries(store.responseHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}
