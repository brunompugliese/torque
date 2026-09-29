import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase/server";

import { isSessionIdle } from "./inactivity";
import { LOGIN_PATH, SIGN_OUT_PATH, SIGN_OUT_REASONS } from "./redirects";

export type Session = {
  userId: string;
  shopId: string | null;
};

// The authoritative "who is this?" check for Server Components, Actions and
// Route Handlers. Uses verified claims (getClaims), never getSession(), which
// would trust the cookie without verifying it. Cached per request.
export const getSession = cache(async (): Promise<Session | null> => {
  const { supabase, store } = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  // The proxy normally catches this first; checking again keeps the DAL
  // correct on its own.
  if (isSessionIdle(store.lastSeenAt, Date.now())) return null;

  const shopId = data.claims.shop_id;
  return {
    userId: data.claims.sub,
    shopId: typeof shopId === "string" && shopId.length > 0 ? shopId : null,
  };
});

export type ShopSession = Session & { shopId: string };

// Call at the top of every app page and before every data access. Signed-out
// visitors go to the login page; users without a shop (no profile, or the
// access token hook isn't configured) are signed out.
export async function requireSession(): Promise<ShopSession> {
  const session = await getSession();
  if (!session) redirect(LOGIN_PATH);
  if (!session.shopId) redirect(`${SIGN_OUT_PATH}?motivo=${SIGN_OUT_REASONS.account}`);
  return { ...session, shopId: session.shopId };
}
