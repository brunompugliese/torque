"use client";

import { PlusIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { useVehiclesPanel } from "./vehicles-panel";

export function AddVehicleButton() {
  const t = useTranslations("vehicles");
  const { openCreate } = useVehiclesPanel();

  return (
    <Button size="lg" onClick={openCreate}>
      <PlusIcon aria-hidden="true" />
      {t("add")}
    </Button>
  );
}
