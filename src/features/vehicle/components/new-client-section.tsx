"use client";

import { XIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { UseFormReturn } from "react-hook-form";

import { FIELD_WIDTH, FormRow } from "@/components/shared/form-layout";
import { DniInput, PhoneInput } from "@/components/shared/formatted-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type { VehicleFormInput, VehicleFormValues } from "../schemas";

type NewClientFieldName = "name" | "surname" | "phoneNumber" | "dni";

type NewClientSectionProps = {
  // The vehicle form's id: field ids and the hints are built from it.
  id: string;
  form: UseFormReturn<VehicleFormInput, unknown, VehicleFormValues>;
  // Translates a field's error key.
  errorText: (key: string | undefined) => { message: string }[] | undefined;
  onDiscard: () => void;
};

// The owner created together with the vehicle: the client form's fields without
// the email, inline in the vehicle form (docs/design.md#quick-create-inside-a-dropdown).
export function NewClientSection({ id, form, errorText, onDiscard }: NewClientSectionProps) {
  const t = useTranslations("vehicles");
  const tClients = useTranslations("clients");
  const errors = form.formState.errors.newClient;

  const fieldId = (name: NewClientFieldName) => `${id}-newClient-${name}`;
  const fieldProps = (name: NewClientFieldName) => ({
    id: fieldId(name),
    "aria-invalid": Boolean(errors?.[name]),
    "aria-describedby": errors?.[name] ? `${fieldId(name)}-error` : undefined,
  });

  return (
    <section
      aria-labelledby={`${id}-newClient-title`}
      className="flex flex-col gap-4 rounded-lg border bg-muted/40 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${id}-newClient-title`} className="text-base font-semibold">
          {t("newClient.title")}
        </h3>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("newClient.discard")} onClick={onDiscard}>
          <XIcon aria-hidden="true" />
        </Button>
      </div>

      <FieldGroup>
        <FormRow>
          <Field data-invalid={Boolean(errors?.name)}>
            <FieldLabel htmlFor={fieldId("name")}>{tClients("fields.name")} *</FieldLabel>
            <Input autoComplete="off" autoFocus {...fieldProps("name")} {...form.register("newClient.name")} />
            <FieldError id={`${fieldId("name")}-error`} errors={errorText(errors?.name?.message)} />
          </Field>

          <Field data-invalid={Boolean(errors?.surname)}>
            <FieldLabel htmlFor={fieldId("surname")}>{tClients("fields.surname")}</FieldLabel>
            <Input autoComplete="off" {...fieldProps("surname")} {...form.register("newClient.surname")} />
            <FieldError id={`${fieldId("surname")}-error`} errors={errorText(errors?.surname?.message)} />
          </Field>
        </FormRow>

        <FormRow>
          <Field data-invalid={Boolean(errors?.phoneNumber)} className={FIELD_WIDTH.phone}>
            <FieldLabel htmlFor={fieldId("phoneNumber")}>{tClients("fields.phone")} *</FieldLabel>
            <PhoneInput
              placeholder={tClients("fields.phonePlaceholder")}
              {...fieldProps("phoneNumber")}
              aria-describedby={[
                `${fieldId("phoneNumber")}-hint`,
                errors?.phoneNumber ? `${fieldId("phoneNumber")}-error` : null,
              ]
                .filter(Boolean)
                .join(" ")}
              registration={form.register("newClient.phoneNumber")}
            />
            <FieldDescription id={`${fieldId("phoneNumber")}-hint`}>{tClients("fields.phoneHint")}</FieldDescription>
            <FieldError id={`${fieldId("phoneNumber")}-error`} errors={errorText(errors?.phoneNumber?.message)} />
          </Field>

          <Field data-invalid={Boolean(errors?.dni)} className={FIELD_WIDTH.dni}>
            <FieldLabel htmlFor={fieldId("dni")}>{tClients("fields.dni")}</FieldLabel>
            <DniInput {...fieldProps("dni")} registration={form.register("newClient.dni")} />
            <FieldError id={`${fieldId("dni")}-error`} errors={errorText(errors?.dni?.message)} />
          </Field>
        </FormRow>
      </FieldGroup>

      <p className="text-xs text-muted-foreground">{t("newClient.hint")}</p>
    </section>
  );
}
