import "server-only";

import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

import type { Shop } from "./types";

// The private Storage bucket that holds the logos, one folder per shop.
export const SHOP_LOGOS_BUCKET = "shop-logos";

const shopRowSchema = z.object({
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  logo_path: z.string().nullable(),
});

// Text the owner typed in the dashboard: blank counts as missing.
function textOrNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// RLS only returns the signed-in user's own shop; filtering by id as well
// keeps the query explicit. Null when it can't be read, so the header falls
// back to the app's own brand.
export async function getShop(): Promise<Shop | null> {
  const { shopId } = await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("shop")
    .select("name, address, phone, logo_path")
    .eq("id", shopId)
    .maybeSingle();
  if (error) {
    console.error("[shop] query failed", { code: error.code });
    return null;
  }

  const parsed = shopRowSchema.safeParse(data);
  if (!parsed.success) return null;
  const row = parsed.data;
  return {
    name: row.name,
    address: textOrNull(row.address),
    phone: textOrNull(row.phone),
    hasLogo: textOrNull(row.logo_path) !== null,
  };
}

// The logo's path inside the bucket, for the route that serves it. Never sent
// to the browser.
export async function getShopLogoPath(): Promise<string | null> {
  const { shopId } = await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase.from("shop").select("logo_path").eq("id", shopId).maybeSingle();
  if (error) {
    console.error("[shop] logo path query failed", { code: error.code });
    return null;
  }
  return typeof data?.logo_path === "string" && data.logo_path.length > 0 ? data.logo_path : null;
}
