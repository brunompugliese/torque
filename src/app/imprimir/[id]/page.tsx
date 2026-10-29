import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cache } from "react";

import { JobSheetView } from "@/features/job/components/job-sheet";
import { PrintControls } from "@/features/job/components/print-controls";
import { getJobSheet } from "@/features/job/queries";
import { jobIdSchema } from "@/features/job/schemas";
import { requireSession } from "@/lib/auth/session";

import "../sheet.css";

// The title and the page read the same sheet: one read per request.
const loadSheet = cache(getJobSheet);

// The job is read under the user's session, so a job of another shop is simply not found.
async function readSheet(id: string) {
  await requireSession();
  if (!jobIdSchema.safeParse(id).success) notFound();
  const result = await loadSheet(id);
  if (!result.ok) {
    if (result.reason === "notFound") notFound();
    throw new Error("job sheet failed");
  }
  return result.sheet;
}

export async function generateMetadata({ params }: PageProps<"/imprimir/[id]">): Promise<Metadata> {
  const [{ id }, t] = await Promise.all([params, getTranslations("jobs.print")]);
  const sheet = await readSheet(id);
  // The browser names the saved PDF after the title.
  return { title: t("pageTitle", { number: sheet.number }), robots: { index: false } };
}

export default async function PrintJobPage({ params }: PageProps<"/imprimir/[id]">) {
  const { id } = await params;
  const sheet = await readSheet(id);

  return (
    <main className="min-h-screen bg-muted px-4 py-6 print:bg-background print:p-0">
      <PrintControls />
      <JobSheetView sheet={sheet} />
    </main>
  );
}
