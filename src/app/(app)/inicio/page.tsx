import { requireSession } from "@/lib/auth/session";

// The homepage is intentionally empty for now; its content has its own spec.
export default async function HomePage() {
  await requireSession();
  return null;
}
