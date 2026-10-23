"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { useJobsPanel } from "./jobs-panel";

export function NewJobButton() {
  const t = useTranslations("jobs");
  const { openCreate } = useJobsPanel();

  return (
    <Button size="lg" onClick={openCreate}>
      <PlusIcon aria-hidden="true" />
      {t("add")}
    </Button>
  );
}
