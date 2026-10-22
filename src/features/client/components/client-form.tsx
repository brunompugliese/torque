"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormAlert } from "@/components/shared/form-alert";
import { FIELD_WIDTH, FormRow } from "@/components/shared/form-layout";
import { DniInput, PhoneInput } from "@/components/shared/formatted-input";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ValidationErrorKey } from "@/lib/validation/fields";

import type { ClientActionResult } from "../actions";
import { clientFormSchema, type ClientField, type ClientFormInput, type ClientFormValues } from "../schemas";

const CLIENT_ERROR_KEYS = new Set(["dniTaken", "dniTakenArchived"]);

type ClientFormProps = {
  // The modal footer's submit button targets the form by id.
  id: string;
  defaultValues?: ClientFormInput;
  onSubmit: (values: ClientFormValues) => Promise<ClientActionResult | void>;
};

const EMPTY: ClientFormInput = { name: "", surname: "", phoneNumber: "", dni: "", email: "" };

export function ClientForm({ id, defaultValues, onSubmit }: ClientFormProps) {
  const t = useTranslations("clients");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const [formError, setFormError] = useState(false);

  const form = useForm<ClientFormInput, unknown, ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setFormError(false);
    const result = await onSubmit(values);
    if (!result || result.ok) return;

    const fieldErrors = Object.entries(result.fieldErrors ?? {}) as [ClientField, string][];
    if (fieldErrors.length === 0) {
      setFormError(true);
      return;
    }
    for (const [field, message] of fieldErrors) form.setError(field, { message });
    form.setFocus(fieldErrors[0][0]);
  });

  const message = (key: string | undefined) => {
    if (!key) return undefined;
    const text = CLIENT_ERROR_KEYS.has(key)
      ? t(`errors.${key as "dniTaken" | "dniTakenArchived"}`)
      : tValidation(key as ValidationErrorKey);
    return [{ message: text }];
  };

  const fieldProps = (name: ClientField) => ({
    id: `${id}-${name}`,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined,
  });

  return (
    <form id={id} onSubmit={submit} noValidate className="flex flex-col gap-5 pb-2">
      <FieldGroup>
        <FormRow>
          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor={`${id}-name`}>{t("fields.name")} *</FieldLabel>
            <Input autoComplete="off" autoFocus {...fieldProps("name")} {...form.register("name")} />
            <FieldError id={`${id}-name-error`} errors={message(errors.name?.message)} />
          </Field>

          <Field data-invalid={Boolean(errors.surname)}>
            <FieldLabel htmlFor={`${id}-surname`}>{t("fields.surname")}</FieldLabel>
            <Input autoComplete="off" {...fieldProps("surname")} {...form.register("surname")} />
            <FieldError id={`${id}-surname-error`} errors={message(errors.surname?.message)} />
          </Field>
        </FormRow>

        <FormRow>
          <Field data-invalid={Boolean(errors.phoneNumber)} className={FIELD_WIDTH.phone}>
            <FieldLabel htmlFor={`${id}-phoneNumber`}>{t("fields.phone")} *</FieldLabel>
            <PhoneInput
              placeholder={t("fields.phonePlaceholder")}
              {...fieldProps("phoneNumber")}
              aria-describedby={[`${id}-phoneNumber-hint`, errors.phoneNumber ? `${id}-phoneNumber-error` : null]
                .filter(Boolean)
                .join(" ")}
              registration={form.register("phoneNumber")}
            />
            <FieldDescription id={`${id}-phoneNumber-hint`}>{t("fields.phoneHint")}</FieldDescription>
            <FieldError id={`${id}-phoneNumber-error`} errors={message(errors.phoneNumber?.message)} />
          </Field>

          <Field data-invalid={Boolean(errors.dni)} className={FIELD_WIDTH.dni}>
            <FieldLabel htmlFor={`${id}-dni`}>{t("fields.dni")}</FieldLabel>
            <DniInput {...fieldProps("dni")} registration={form.register("dni")} />
            <FieldError id={`${id}-dni-error`} errors={message(errors.dni?.message)} />
          </Field>
        </FormRow>

        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor={`${id}-email`}>{t("fields.email")}</FieldLabel>
          <Input type="email" inputMode="email" autoComplete="off" {...fieldProps("email")} {...form.register("email")} />
          <FieldError id={`${id}-email-error`} errors={message(errors.email?.message)} />
        </Field>
      </FieldGroup>

      {formError ? <FormAlert>{tCommon("unexpectedError")}</FormAlert> : null}
    </form>
  );
}
