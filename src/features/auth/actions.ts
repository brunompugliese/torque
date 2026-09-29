"use server";

import { redirect } from "next/navigation";

import { getSafeRedirectPath, LOGIN_PATH } from "@/lib/auth/redirects";
import { createServerSupabase } from "@/lib/supabase/server";
import { toFieldErrors, type ValidationErrorKey } from "@/lib/validation/fields";

import { mapAuthError, type AuthErrorKey } from "./errors";
import { loginSchema } from "./schemas";

// Never contains the email or password: the form keeps the email itself, so
// nothing sensitive travels back in the response.
export type SignInState =
  | { status: "idle" }
  | {
      status: "error";
      formError?: AuthErrorKey;
      fieldErrors?: Partial<Record<"email" | "password", ValidationErrorKey>>;
    };

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: toFieldErrors(parsed.error) };
  }

  const { supabase, store, persist } = await createServerSupabase();

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const formError = mapAuthError(error);
    if (formError === "unexpected") {
      // Code and status only: never the email or password.
      console.error("[auth] sign-in failed", { code: error.code, status: error.status });
    }
    return { status: "error", formError };
  }

  const { data } = await supabase.auth.getClaims();
  if (typeof data?.claims?.shop_id !== "string") {
    // Valid credentials but no profile (or the token hook isn't set up).
    await supabase.auth.signOut({ scope: "local" });
    store.clear();
    await persist();
    return { status: "error", formError: "accountUnavailable" };
  }

  store.touch(Date.now());
  await persist();

  redirect(getSafeRedirectPath(formData.get("next")));
}

export async function signOut(): Promise<never> {
  const { supabase, store, persist } = await createServerSupabase();
  // "local" ends this device's session only and revokes its refresh token.
  await supabase.auth.signOut({ scope: "local" });
  store.clear();
  await persist();
  redirect(LOGIN_PATH);
}
