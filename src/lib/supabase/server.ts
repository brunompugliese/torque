import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { createSessionStore, SUPABASE_STORAGE_KEY } from "@/lib/auth/session-store";
import { importAesKey } from "@/lib/crypto/aes-gcm";
import { getServerEnv } from "@/lib/env";

// Supabase client for Server Components, Server Actions and Route Handlers.
// Create one per request. Call `persist()` after anything that may change the
// session (sign-in, sign-out, activity stamp).
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const env = getServerEnv();

  const store = await createSessionStore({
    cookies: cookieStore.getAll(),
    key: await importAesKey(env.SESSION_COOKIE_SECRET),
    secure: process.env.NODE_ENV !== "development",
  });

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookieOptions: { name: SUPABASE_STORAGE_KEY },
    cookies: store.supabaseCookies,
  });

  async function persist() {
    const writes = await store.commit();
    try {
      for (const { name, value, options } of writes) {
        cookieStore.set(name, value, options);
      }
    } catch {
      // Server Components can't set cookies. The proxy already refreshed the
      // session for this request, so there's nothing to lose here.
    }
  }

  return { supabase, store, persist };
}
