"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { useAppointmentsPanel } from "./appointments-panel";

export function NewAppointmentButton() {
  const t = useTranslations("appointments");
  const { openCreate } = useAppointmentsPanel();

  return (
    <Button size="lg" onClick={() => openCreate()}>
      <PlusIcon aria-hidden="true" />
      {t("add")}
    </Button>
  );
}
