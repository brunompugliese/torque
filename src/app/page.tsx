import { redirect } from "next/navigation";

import { HOME_PATH } from "@/lib/auth/redirects";

// Inicio lives at its own address (docs/design.md); the root just points there.
export default function RootPage() {
  redirect(HOME_PATH);
}
