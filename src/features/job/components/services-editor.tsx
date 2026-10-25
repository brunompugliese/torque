"use client";

import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useWatch, type Path, type UseFormReturn } from "react-hook-form";

import { LINE_ITEM_COLUMNS } from "@/components/shared/form-layout";
import { FormattedInput } from "@/components/shared/formatted-input";
import { MoneyInput } from "@/components/shared/money-input";
import { SearchableSelect, type SelectOption } from "@/components/shared/searchable-select";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { formatMoney } from "@/lib/format/money";
import type { JobPhase } from "@/lib/status";

import { emptyJobRow, rowAmounts, type JobFormRow } from "../form";
import type { JobFormInput, JobFormValues } from "../schemas";
import { calculateTotals } from "../total";

type JobForm = UseFormReturn<JobFormInput, unknown, JobFormValues>;
type ErrorText = (key: string | undefined) => { message: string }[] | undefined;

const digitsOnly = (input: string) => input.replace(/\D/g, "").slice(0, 4);

// One service on one line from the `sm` breakpoint up (the widths are in form-layout.tsx).
const ROW_GRID: Record<JobPhase, string> = {
  quote: LINE_ITEM_COLUMNS.withPrice,
  work: LINE_ITEM_COLUMNS.withTwoPrices,
};

export function itemFieldId(formId: string, index: number, field: string) {
  return `${formId}-items-${index}-${field}`;
}

type ServicesEditorProps = {
  id: string;
  form: JobForm;
  phase: JobPhase;
  // The saved services keep their quoted price once the work started: it is what the client accepted.
  quotedLocked: boolean;
  options: SelectOption[];
  loadingOptions: boolean;
  noOptionsText: string;
  // What each row's service box holds (by the row's key), so text that matches no service can be
  // told from an empty box.
  rowTexts: Record<string, string>;
  onRowText: (rowKey: string, text: string) => void;
  // The rows' keys by position: the form reads the text of a row by its position.
  onRowKeys: (rowKeys: string[]) => void;
  errorText: ErrorText;
};

// The job's services as editable rows (docs: Trabajos, "Services editor"). Quote phase: a
// quoted price per row. Work phase: the quoted price (read only for saved rows) and a final
// price. The totals under the rows update as the user types.
export function ServicesEditor({
  id,
  form,
  phase,
  quotedLocked,
  options,
  loadingOptions,
  noOptionsText,
  rowTexts,
  onRowText,
  onRowKeys,
  errorText,
}: ServicesEditorProps) {
  const t = useTranslations("jobs.editor");
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items", keyName: "key" });
  const rows = useWatch({ control: form.control, name: "items" }) as JobFormRow[] | undefined;
  const [focusRow, setFocusRow] = useState<number | null>(null);

  useEffect(() => {
    onRowKeys(fields.map((field) => field.key));
  }, [fields, onRowKeys]);

  // A new row's service box takes the focus once it is on screen.
  useEffect(() => {
    if (focusRow === null) return;
    const target = document.getElementById(itemFieldId(id, focusRow, "serviceId"));
    if (!target) return;
    target.focus();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the request is served once
    setFocusRow(null);
  }, [focusRow, id, fields.length]);

  const totals = useMemo(() => calculateTotals(rowAmounts(rows ?? []), phase), [rows, phase]);

  const addRow = () => {
    // In the work phase a new row's final price starts as a copy of its quoted price (empty).
    append(emptyJobRow());
    setFocusRow(fields.length);
  };

  return (
    <section aria-labelledby={`${id}-items-title`} className="flex flex-col gap-3">
      <h3 id={`${id}-items-title`} className="text-base font-semibold">
        {t("title")}
      </h3>

      {fields.length > 0 ? (
        <div className="rounded-lg border">
          <div
            aria-hidden="true"
            className={`hidden items-center gap-3 border-b px-3 py-2 text-xs font-medium text-muted-foreground sm:grid ${ROW_GRID[phase]}`}
          >
            <span>{t("service")} *</span>
            <span>{t("quantity")}</span>
            <span>{phase === "work" ? t("quotedUnit") : `${t("unitPrice")} *`}</span>
            {phase === "work" ? <span>{`${t("finalUnit")} *`}</span> : null}
            <span className="text-right">{t("subtotal")}</span>
            <span />
          </div>
          <ul className="divide-y">
            {fields.map((field, index) => (
            <ServiceRow
              key={field.key}
              id={id}
              index={index}
              form={form}
              phase={phase}
              quotedLocked={quotedLocked}
              options={options}
              loadingOptions={loadingOptions}
              noOptionsText={noOptionsText}
              text={rowTexts[field.key]}
              onText={(next) => onRowText(field.key, next)}
              errorText={errorText}
              onRemove={() => remove(index)}
            />
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={addRow}>
          <PlusIcon aria-hidden="true" />
          {t("add")}
        </Button>
        <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
          {phase === "quote" ? (
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">{t("total")}</dt>
              <dd className="font-semibold tabular-nums">{formatMoney(totals.quoted)}</dd>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <dt className="text-muted-foreground">{t("quoted")}</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(totals.quoted)}</dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-muted-foreground">{t("final")}</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(totals.final ?? totals.quoted)}</dd>
              </div>
            </>
          )}
        </dl>
      </div>
    </section>
  );
}

type ServiceRowProps = Omit<ServicesEditorProps, "rowTexts" | "onRowText" | "onRowKeys"> & {
  index: number;
  // The text in the service box; undefined until the user types (the saved service's name shows).
  text: string | undefined;
  onText: (text: string) => void;
  onRemove: () => void;
};

function ServiceRow({
  id,
  index,
  form,
  phase,
  quotedLocked,
  options,
  loadingOptions,
  noOptionsText,
  text: typedText,
  onText,
  errorText,
  onRemove,
}: ServiceRowProps) {
  const t = useTranslations("jobs.editor");
  const row = useWatch({ control: form.control, name: `items.${index}` }) as JobFormRow | undefined;
  const rowErrors = form.formState.errors.items?.[index];
  const savedOption = options.find((option) => option.value === row?.serviceId);
  const text = typedText ?? savedOption?.label ?? "";

  const name = (field: string) => `items.${index}.${field}` as Path<JobFormInput>;
  const fieldId = (field: string) => itemFieldId(id, index, field);
  const describe = (field: string, message: string | undefined) => ({
    id: fieldId(field),
    "aria-invalid": Boolean(message),
    "aria-describedby": message ? `${fieldId(field)}-error` : undefined,
  });

  const saved = Boolean(row?.id);
  const quotedReadOnly = saved && (quotedLocked || phase === "work");
  const amounts = rowAmounts(row ? [row] : [])[0];
  const unit = phase === "work" ? (amounts?.finalUnitPrice ?? amounts?.quotedUnitPrice ?? 0) : (amounts?.quotedUnitPrice ?? 0);
  const subtotal = (amounts?.quantity ?? 0) * unit;

  const quotedRegistration = form.register(name("quotedUnitPrice"));
  const quotedWithSync = {
    ...quotedRegistration,
    onChange: (event: Parameters<typeof quotedRegistration.onChange>[0]) => {
      const before = form.getValues(name("quotedUnitPrice")) as unknown as string;
      // The form's value is updated right away; its validation finishes later.
      const result = quotedRegistration.onChange(event);
      // A row added in the work phase: its final price follows the quoted one until it is set apart.
      if (phase === "work" && !saved) {
        const finalNow = form.getValues(name("finalUnitPrice")) as unknown as string;
        if (finalNow === "" || finalNow === before) {
          form.setValue(name("finalUnitPrice"), form.getValues(name("quotedUnitPrice")), { shouldDirty: true });
        }
      }
      return result;
    },
  };

  const chooseService = (next: string) => {
    form.setValue(name("serviceId"), next, { shouldValidate: form.formState.isSubmitted });
  };

  const serviceError = rowErrors?.serviceId?.message;
  const quantityError = rowErrors?.quantity?.message;
  const quotedError = rowErrors?.quotedUnitPrice?.message;
  const finalError = rowErrors?.finalUnitPrice?.message;

  // The visible label is the column header from `sm` up; below it each cell shows its own.
  const cellLabel = "text-[13px] font-medium sm:sr-only";
  const quotedLabel = phase === "work" ? t("quotedUnit") : `${t("unitPrice")} *`;

  return (
    <li className={`flex flex-col gap-3 px-3 py-3 sm:grid sm:items-start sm:gap-3 ${ROW_GRID[phase]}`}>
      <Field data-invalid={Boolean(serviceError)}>
        <FieldLabel htmlFor={fieldId("serviceId")} className={cellLabel}>
          {t("service")} *
        </FieldLabel>
        <SearchableSelect
          id={fieldId("serviceId")}
          options={options}
          value={row?.serviceId ?? ""}
          onValueChange={chooseService}
          inputValue={text}
          onInputValueChange={onText}
          loading={loadingOptions}
          placeholder={t("servicePlaceholder")}
          emptyText={noOptionsText}
          invalid={Boolean(serviceError)}
          describedBy={serviceError ? `${fieldId("serviceId")}-error` : undefined}
        />
        <FieldError id={`${fieldId("serviceId")}-error`} errors={errorText(serviceError)} />
      </Field>

      <Field data-invalid={Boolean(quantityError)}>
        <FieldLabel htmlFor={fieldId("quantity")} className={cellLabel}>
          {t("quantity")}
        </FieldLabel>
        <FormattedInput
          inputMode="numeric"
          autoComplete="off"
          format={digitsOnly}
          {...describe("quantity", quantityError)}
          registration={form.register(name("quantity"))}
        />
        <FieldError id={`${fieldId("quantity")}-error`} errors={errorText(quantityError)} />
      </Field>

      <Field data-invalid={Boolean(quotedError)}>
        <FieldLabel htmlFor={fieldId("quotedUnitPrice")} className={cellLabel}>
          {quotedLabel}
        </FieldLabel>
        <MoneyInput
          {...describe("quotedUnitPrice", quotedError)}
          readOnly={quotedReadOnly}
          className={quotedReadOnly ? "bg-muted" : undefined}
          registration={quotedWithSync}
        />
        <FieldError id={`${fieldId("quotedUnitPrice")}-error`} errors={errorText(quotedError)} />
      </Field>

      {phase === "work" ? (
        <Field data-invalid={Boolean(finalError)}>
          <FieldLabel htmlFor={fieldId("finalUnitPrice")} className={cellLabel}>
            {t("finalUnit")} *
          </FieldLabel>
          <MoneyInput {...describe("finalUnitPrice", finalError)} registration={form.register(name("finalUnitPrice"))} />
          <FieldError id={`${fieldId("finalUnitPrice")}-error`} errors={errorText(finalError)} />
        </Field>
      ) : null}

      <div className="flex flex-col gap-2 sm:items-end">
        <span className={cellLabel}>{t("subtotal")}</span>
        <output aria-label={t("subtotal")} className="flex h-8 items-center text-sm font-medium tabular-nums">
          {formatMoney(subtotal)}
        </output>
      </div>

      <Button type="button" variant="ghost" size="icon-sm" aria-label={t("remove")} onClick={onRemove}>
        <TrashIcon aria-hidden="true" />
      </Button>
    </li>
  );
}
