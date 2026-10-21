"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormAlert } from "@/components/shared/form-alert";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ValidationErrorKey } from "@/lib/validation/fields";

import type { ServiceActionResult } from "../actions";
import { serviceFormSchema, type ServiceFormInput, type ServiceFormValues } from "../schemas";

const SERVICE_ERROR_KEYS = new Set(["nameTaken", "nameTakenArchived"]);

type ServiceFormProps = {
  // The modal footer's submit button targets the form by id.
  id: string;
  defaultValues?: ServiceFormInput;
  onSubmit: (values: ServiceFormValues) => Promise<ServiceActionResult | void>;
};

export function ServiceForm({ id, defaultValues, onSubmit }: ServiceFormProps) {
  const t = useTranslations("services");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const [formError, setFormError] = useState(false);

  const form = useForm<ServiceFormInput, unknown, ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: { name: "", description: "", ...defaultValues },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setFormError(false);
    const result = await onSubmit(values);
    if (!result || result.ok) return;
    const nameError = result.fieldErrors?.name;
    if (nameError) {
      form.setError("name", { message: nameError });
      form.setFocus("name");
    } else if (result.error !== "renameNeedsConfirmation") {
      setFormError(true);
    }
  });

  const message = (key: string | undefined) => {
    if (!key) return undefined;
    const text = SERVICE_ERROR_KEYS.has(key)
      ? t(`errors.${key as "nameTaken" | "nameTakenArchived"}`)
      : tValidation(key as ValidationErrorKey);
    return [{ message: text }];
  };

  return (
    <form id={id} onSubmit={submit} noValidate className="flex flex-col gap-5 pb-2">
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor={`${id}-name`}>{t("fields.name")} *</FieldLabel>
          <Input
            id={`${id}-name`}
            autoComplete="off"
            autoFocus
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
            {...form.register("name")}
          />
          <FieldError id={`${id}-name-error`} errors={message(errors.name?.message)} />
        </Field>

        <Field>
          <FieldLabel htmlFor={`${id}-description`}>{t("fields.description")}</FieldLabel>
          <Textarea
            id={`${id}-description`}
            rows={3}
            aria-describedby={`${id}-description-hint`}
            {...form.register("description")}
          />
          <FieldDescription id={`${id}-description-hint`}>{t("fields.descriptionHint")}</FieldDescription>
        </Field>
      </FieldGroup>

      {formError ? <FormAlert>{tCommon("unexpectedError")}</FormAlert> : null}
    </form>
  );
}
