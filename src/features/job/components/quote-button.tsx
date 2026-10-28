"use client";

import { PaperPlaneTiltIcon } from "@phosphor-icons/react/ssr";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { WHATSAPP_BUTTON_CLASS } from "@/components/shared/whatsapp-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useShopName } from "@/features/shop/shop-context";
import { toWhatsappUrl } from "@/lib/format/whatsapp";
import { cn } from "@/lib/utils";

import { archivedEntities, buildQuoteMessage, quoteAvailability } from "../quote";
import type { JobItem, JobListItem } from "../schemas";

const DISABLED_CLASS = "cursor-default text-muted-foreground opacity-70";

type QuoteButtonProps = {
  job: JobListItem;
  // Null while the services load.
  items: readonly JobItem[] | null;
};

// "Enviar presupuesto": opens the client's WhatsApp chat with the quote written. It never
// changes the job; the shop updates the status by hand. Rebuilt from the saved job on every render.
export function QuoteButton({ job, items }: QuoteButtonProps) {
  const t = useTranslations("jobs.quote");
  const shopName = useShopName();
  const reasonId = useId();
  const [confirming, setConfirming] = useState(false);

  const availability = quoteAvailability(job, items);
  const icon = <PaperPlaneTiltIcon aria-hidden="true" className="size-4" />;

  if (!availability.ok) {
    const reason = availability.reason ? t(`reasons.${availability.reason}`) : null;
    const button = (
      <button
        type="button"
        disabled
        aria-describedby={reason ? reasonId : undefined}
        className={cn(WHATSAPP_BUTTON_CLASS, DISABLED_CLASS, "pointer-events-none hover:border-transparent hover:bg-transparent")}
      >
        {icon}
        {t("button")}
      </button>
    );
    if (!reason) return button;
    return (
      <Tooltip>
        {/* A disabled button gets no hover or focus, so its wrapper carries the tooltip. */}
        <TooltipTrigger render={<span tabIndex={0} className="inline-flex rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />}>
          {button}
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
        <span id={reasonId} className="sr-only">
          {reason}
        </span>
      </Tooltip>
    );
  }

  // `availability.ok` means the client and the services exist.
  const client = job.client;
  const saved = items;
  if (!client || !saved) return null;

  const message = buildQuoteMessage(job, saved, shopName, {
    message: (values) => t("message", values),
    signature: (values) => t("signature", values),
  });
  const url = toWhatsappUrl(client.phoneNumber, message);
  const archived = archivedEntities(job);
  const label = t("buttonFor", { name: client.name });

  if (archived.length === 0) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" aria-label={label} className={WHATSAPP_BUTTON_CLASS}>
        {icon}
        {t("button")}
      </a>
    );
  }

  return (
    <>
      <button type="button" aria-label={label} onClick={() => setConfirming(true)} className={WHATSAPP_BUTTON_CLASS}>
        {icon}
        {t("button")}
      </button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("archived.title")}
        description={
          <>
            {archived.map((entity) => (
              <p key={entity}>{t(`archived.${entity}`)}</p>
            ))}
            <p>{t("archived.question")}</p>
          </>
        }
        confirmLabel={t("archived.confirm")}
        onConfirm={() => {
          window.open(url, "_blank", "noopener");
          setConfirming(false);
        }}
      />
    </>
  );
}
