import { NextResponse, type NextRequest } from "next/server";

import { LOGIN_PATH, SIGN_OUT_REASONS } from "@/lib/auth/redirects";
import { createServerSupabase } from "@/lib/supabase/server";

// requireSession() redirects here when a signed-in user has no shop, because
// cookies can't be changed while a page renders. It only signs out, so a
// forged link can do no more than log the user out.
export async function GET(request: NextRequest) {
  const { supabase, store, persist } = await createServerSupabase();
  await supabase.auth.signOut({ scope: "local" });
  store.clear();
  await persist();

  const url = new URL(LOGIN_PATH, request.url);
  if (request.nextUrl.searchParams.get("motivo") === SIGN_OUT_REASONS.account) {
    url.searchParams.set("motivo", SIGN_OUT_REASONS.account);
  }
  return NextResponse.redirect(url);
}
