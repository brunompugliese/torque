import { getShopLogoPath, SHOP_LOGOS_BUCKET } from "@/features/shop/queries";
import { requireSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

// The types the bucket accepts. Anything else is never served.
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// A replaced logo shows up within the hour. `private` keeps shared caches out.
const CACHE_CONTROL = "private, max-age=3600";

function notFound() {
  return new Response(null, { status: 404 });
}

// Serves the signed-in user's shop logo. The file lives in a private bucket:
// it is downloaded with the user's session, so the Storage policy decides who
// reads what, and the browser only ever sees this same-origin address. The
// path, the file name and the storage URL are never logged or sent out.
export async function GET() {
  await requireSession();

  const logoPath = await getShopLogoPath();
  if (!logoPath) return notFound();

  const { supabase } = await createServerSupabase();
  const { data, error } = await supabase.storage.from(SHOP_LOGOS_BUCKET).download(logoPath);
  if (error || !data) {
    console.error("[shop] logo download failed");
    return notFound();
  }
  if (!IMAGE_TYPES.has(data.type)) return notFound();

  return new Response(data, {
    headers: { "Content-Type": data.type, "Cache-Control": CACHE_CONTROL },
  });
}
