import "server-only";

import { requireSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

// RLS only returns the signed-in user's own shop; filtering by id as well
// keeps the query explicit.
export async function getShopName(): Promise<string | null> {
  const { shopId } = await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase.from("shop").select("name").eq("id", shopId).maybeSingle();
  if (error) {
    console.error("[shop] name query failed", { code: error.code });
    return null;
  }
  return typeof data?.name === "string" ? data.name : null;
}
