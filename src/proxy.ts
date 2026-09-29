import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except the build assets and favicon the login page itself
  // needs; see specs/002-login/design.md.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
