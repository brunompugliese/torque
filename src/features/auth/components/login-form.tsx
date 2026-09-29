"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";

import { FormAlert } from "@/components/shared/form-alert";
import { PasswordInput } from "@/components/shared/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ValidationErrorKey } from "@/lib/validation/fields";

import { signIn, type SignInState } from "../actions";
import type { AuthErrorKey } from "../errors";
import { loginSchema, type LoginInput } from "../schemas";

type LoginFormProps = {
  next?: string;
  // Shown before any attempt, e.g. after an inactivity sign-out.
  initialError?: AuthErrorKey | "sessionExpired";
};

const INITIAL_STATE: SignInState = { status: "idle" };

export function LoginForm({ next, initialError }: LoginFormProps) {
  const t = useTranslations("auth");
  const tValidation = useTranslations("validation");
  const [state, formAction, isPending] = useActionState(signIn, INITIAL_STATE);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
    reValidateMode: "onChange",
  });

  // Server-side errors: show them on the fields and never keep the password.
  useEffect(() => {
    if (state.status !== "error") return;
    form.resetField("password");
    for (const [field, key] of Object.entries(state.fieldErrors ?? {})) {
      form.setError(field as keyof LoginInput, { message: key });
    }
  }, [state, form]);

  const onSubmit = form.handleSubmit((values) => {
    const data = new FormData();
    data.set("email", values.email);
    data.set("password", values.password);
    if (next) data.set("next", next);
    startTransition(() => formAction(data));
  });

  const formError =
    state.status === "error" ? state.formError : state.status === "idle" ? initialError : undefined;
  const { errors } = form.formState;
  const fieldError = (key: string | undefined) =>
    key ? [{ message: tValidation(key as ValidationErrorKey) }] : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="email">{t("login.email")}</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...form.register("email")}
          />
          <FieldError id="email-error" errors={fieldError(errors.email?.message)} />
        </Field>

        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor="password">{t("login.password")}</FieldLabel>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            showLabel={t("login.showPassword")}
            hideLabel={t("login.hidePassword")}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...form.register("password")}
          />
          <FieldError id="password-error" errors={fieldError(errors.password?.message)} />
        </Field>
      </FieldGroup>

      {formError ? <FormAlert>{t(`errors.${formError}`)}</FormAlert> : null}

      <Button type="submit" size="lg" disabled={isPending} className="w-full">
        {isPending ? t("login.submitting") : t("login.submit")}
      </Button>
    </form>
  );
}
