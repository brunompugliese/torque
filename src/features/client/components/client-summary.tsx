"use client";

import { useTranslations } from "next-intl";

import { ArchivedBadge } from "@/components/shared/archived-badge";
import { WhatsappButton } from "@/components/shared/whatsapp-button";

import { formatClientName } from "../format";

type ClientSummaryProps = {
  client: { name: string; surname: string | null; phoneNumber: string; enabled: boolean } | null;
  // What a record without a client says ("Sin cliente"), in the caller's words.
  noClient: string;
};

// A record's client in a detail modal (a vehicle's owner, a job's or an appointment's client): the
// name with "Archivado" when it is, then the phone as plain text with the WhatsApp button.
export function ClientSummary({ client, noClient }: ClientSummaryProps) {
  const tCommon = useTranslations("common");

  if (!client) return <span className="text-muted-foreground">{noClient}</span>;

  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-2">
        <span className={client.enabled ? undefined : "text-muted-foreground"}>{formatClientName(client)}</span>
        {client.enabled ? null : <ArchivedBadge />}
      </span>
      <span className="inline-flex items-center gap-1">
        {client.phoneNumber}
        <WhatsappButton phone={client.phoneNumber} label={tCommon("whatsapp")} text={tCommon("whatsappText")} />
      </span>
    </span>
  );
}
