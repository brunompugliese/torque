"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { useClientsPanel } from "./clients-panel";

export function AddClientButton() {
  const t = useTranslations("clients");
  const { openCreate } = useClientsPanel();

  return (
    <Button size="lg" onClick={openCreate}>
      <PlusIcon aria-hidden="true" />
      {t("add")}
    </Button>
  );
}
