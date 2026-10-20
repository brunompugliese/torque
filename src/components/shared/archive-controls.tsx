"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { ArchiveFlow } from "@/hooks/use-archive-flow";

import { ConfirmDialog } from "./confirm-dialog";

// "Archivar" (asks first) or "Desarchivar" (immediate) for the detail modal
// header, depending on whether the record is archived.
export function ArchiveToggleButton({ archived, flow }: { archived: boolean; flow: ArchiveFlow }) {
  const t = useTranslations("common");

  return archived ? (
    <Button variant="outline" onClick={flow.unarchive} disabled={flow.pending}>
      {t("unarchive")}
    </Button>
  ) : (
    <Button variant="outline" onClick={flow.askToArchive}>
      {t("archive")}
    </Button>
  );
}

type ArchiveConfirmDialogProps = {
  flow: ArchiveFlow;
  // "¿Archivar este cliente?"
  title: string;
  // What is specific to this entity, shown after the shared text.
  detail?: string;
};

export function ArchiveConfirmDialog({ flow, title, detail }: ArchiveConfirmDialogProps) {
  const t = useTranslations("common");

  return (
    <ConfirmDialog
      open={flow.confirmOpen}
      onOpenChange={flow.setConfirmOpen}
      title={title}
      description={
        <>
          <p>{t("archiveConfirmBody")}</p>
          {detail ? <p>{detail}</p> : null}
        </>
      }
      confirmLabel={t("archive")}
      onConfirm={flow.archive}
      pending={flow.pending}
    />
  );
}
