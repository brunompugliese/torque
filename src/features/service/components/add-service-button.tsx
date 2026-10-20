"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { useServicesPanel } from "./services-panel";

export function AddServiceButton() {
  const t = useTranslations("services");
  const { openCreate } = useServicesPanel();

  return (
    <Button size="lg" onClick={openCreate}>
      <PlusIcon aria-hidden="true" />
      {t("add")}
    </Button>
  );
}
