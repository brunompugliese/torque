import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ShopLogo } from "@/components/shared/shop-logo";
import { SHOP_LOGO_PATH } from "@/features/shop/types";

import type { JobSheet } from "../sheet";

// Blank space the mechanic writes in, under every service: no ruled lines, the same height as three.
const WRITING_SPACE = "h-[66px]";

function Field({ label, value, missing }: { label: string; value: string | null; missing: string }) {
  return (
    <div className="flex min-h-7 items-baseline gap-2 border-b border-border py-1">
      <dt className="min-w-24 text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={value ? "font-medium" : "text-muted-foreground"}>{value ?? missing}</dd>
    </div>
  );
}

function Signature({ children }: { children: ReactNode }) {
  return <div className="border-t border-foreground pt-1 text-xs text-muted-foreground">{children}</div>;
}

// The printed job (spec 013): A4, black on white, with room to write on every service and the
// client's signature. No price and not the job's observations, so a missing value never looks like
// one. The empty "Hecho" box is decorative; the words next to them are real text.
export function JobSheetView({ sheet }: { sheet: JobSheet }) {
  // The page has no margin (see sheet.css), so the top and bottom margin of every printed page comes
  // from the header and footer rows of a layout table, which the browser repeats on each page.
  return (
    <table role="presentation" className="mx-auto w-[210mm] max-w-full print:w-full">
      <thead className="hidden print:table-header-group">
        <tr>
          <td className="h-[12mm] p-0" />
        </tr>
      </thead>
      <tfoot className="hidden print:table-footer-group">
        <tr>
          <td className="h-[12mm] p-0" />
        </tr>
      </tfoot>
      <tbody>
        <tr>
          <td className="p-0 align-top">
            <SheetBody sheet={sheet} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function SheetBody({ sheet }: { sheet: JobSheet }) {
  const t = useTranslations("jobs.print");
  const tJob = useTranslations("jobs");
  const tApp = useTranslations("app");

  const shopName = sheet.shop.name ?? tApp("name");
  const contact = [sheet.shop.address, sheet.shop.phone ? t("phone", { phone: sheet.shop.phone }) : null]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <article className="flex min-h-[268mm] w-full flex-col bg-background p-[14mm] text-[11pt] leading-normal text-foreground shadow-lg print:px-[14mm] print:py-0 print:shadow-none">
      <header className="flex items-center gap-3 border-b-2 border-foreground pb-2.5">
        <ShopLogo src={sheet.shop.hasLogo ? SHOP_LOGO_PATH : undefined} />
        <div className="min-w-0">
          <p className="text-[17px] font-bold">{shopName}</p>
          {contact ? <p className="text-xs text-muted-foreground">{contact}</p> : null}
        </div>
        <div className="ml-auto text-right">
          <h1 className="text-[22px] leading-tight font-bold tabular-nums">{sheet.number}</h1>
          <p className="text-xs text-muted-foreground">{t("createdOn", { date: sheet.createdOn })}</p>
        </div>
      </header>

      <dl className="my-3 grid grid-cols-2 gap-x-6">
        <Field label={tJob("columns.plate")} value={sheet.plate} missing="" />
        <Field label={tJob("columns.vehicle")} value={sheet.vehicle} missing="" />
        <Field label={tJob("details.client")} value={sheet.client} missing={tJob("noClient")} />
        <Field label={t("clientPhone")} value={sheet.clientPhone} missing={tJob("notLoaded")} />
        <Field label={tJob("details.kilometers")} value={sheet.kilometers} missing={tJob("notLoaded")} />
      </dl>

      <section aria-labelledby="sheet-services">
        <h2 id="sheet-services" className="mb-2 text-base font-bold">
          {tJob("services.title")}
        </h2>
        {sheet.services.length === 0 ? (
          <p className="text-muted-foreground">{t("noServices")}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {sheet.services.map((service, index) => (
              <li key={service.id} className="break-inside-avoid rounded-md border border-foreground">
                <div className="flex items-center gap-2.5 border-b border-foreground px-2.5 py-1.5">
                  <span className="text-xs font-bold text-muted-foreground">{index + 1}</span>
                  <span className="font-semibold">{service.name}</span>
                  <span className="text-xs font-medium">{t("quantity", { quantity: service.quantity })}</span>
                  <span className="ml-auto flex items-center gap-1.5 text-xs font-medium">
                    <span aria-hidden="true" className="size-3.5 rounded-[3px] border-[1.5px] border-foreground" />
                    {t("done")}
                  </span>
                </div>
                <div className="px-2.5 pt-1 pb-1">
                  <p className="text-xs text-muted-foreground">{t("workDone")}</p>
                  <div aria-hidden="true" className={WRITING_SPACE} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* The observations box and the signature stay together at the end of the last page. */}
      <div className="mt-auto break-inside-avoid pt-4">
        <section className="min-h-[90px] rounded-md border border-foreground px-2.5 py-1.5">
          <h2 className="text-xs font-medium text-muted-foreground">{tJob("details.observations")}</h2>
        </section>
        <div className="mt-4 grid grid-cols-2 gap-8 pt-8">
          <Signature>{t("clientSignature")}</Signature>
          <Signature>{t("clarification")}</Signature>
        </div>
        <footer className="mt-2.5 flex justify-between text-xs text-muted-foreground">
          <span>{shopName}</span>
          <span>{t("printedOn", { date: sheet.printedOn })}</span>
        </footer>
      </div>
    </article>
  );
}
