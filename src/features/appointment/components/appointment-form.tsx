"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormAlert } from "@/components/shared/form-alert";
import { FormRow } from "@/components/shared/form-layout";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatClientName } from "@/features/client/format";
import { getOwnerOfVehicle } from "@/features/job/actions";
import { VehicleSelect } from "@/features/vehicle/components/vehicle-select";
import { useLoadedData } from "@/hooks/use-loaded-data";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/status";
import type { ValidationErrorKey } from "@/lib/validation/fields";

import type { AppointmentActionResult } from "../actions";
import { appointmentToFormState, emptyAppointmentForm } from "../form";
import {
  appointmentFormSchema,
  type AppointmentFormInput,
  type AppointmentFormValues,
  type AppointmentListItem,
} from "../schemas";
import { needsConfirmation } from "../status-change";

// The page's order, so "focus the first error" goes to the first field you see.
const FIELD_ORDER = ["vehicleId", "date", "time", "reason"] as const;

type AppointmentFormProps = {
  // The modal footer's submit button targets the form by id.
  id: string;
  // The appointment being edited: it prefills the form, and its vehicle is offered even if archived.
  appointment?: AppointmentListItem;
  // The day a new appointment starts on (the clicked day, or today).
  date?: string;
  onSubmit: (values: AppointmentFormValues) => Promise<AppointmentActionResult | void>;
};

function fieldId(id: string, field: string) {
  return `${id}-${field}`;
}

export function AppointmentForm({ id, appointment, date = "", onSubmit }: AppointmentFormProps) {
  const t = useTranslations("appointments");
  const tStatus = useTranslations("status.appointment");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<AppointmentFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  // The text in the vehicle box, to tell a vehicle typed but not chosen from an empty field.
  const [vehicleText, setVehicleText] = useState("");

  const form = useForm<AppointmentFormInput, unknown, AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: appointment ? appointmentToFormState(appointment) : emptyAppointmentForm(date),
    mode: "onSubmit",
    reValidateMode: "onChange",
    // The focus goes by the page's order (and reaches the dropdowns), see focusFirst.
    shouldFocusError: false,
  });
  const { errors } = form.formState;
  const vehicleId = useWatch({ control: form.control, name: "vehicleId" }) ?? "";
  const status: AppointmentStatus = useWatch({ control: form.control, name: "status" }) ?? "pendiente";

  // --- Client: the vehicle's owner, never chosen ---------------------------------------------
  // While the vehicle is the appointment's own, its stored client shows; another vehicle brings its owner.
  const isOwnVehicle = appointment !== undefined && vehicleId === appointment.vehicle.id;
  const owner = useLoadedData(vehicleId && !isOwnVehicle ? `owner:${vehicleId}` : "owner:none", async () => {
    if (!vehicleId || isOwnVehicle) return null;
    const result = await getOwnerOfVehicle(vehicleId);
    if (!result.ok) throw new Error("owner");
    return result.owner;
  });

  const clientLabel = (client: { name: string; surname: string | null; enabled: boolean }) =>
    client.enabled ? formatClientName(client) : t("clientArchived", { name: formatClientName(client) });

  let clientText = "";
  if (isOwnVehicle) {
    clientText = appointment.client ? clientLabel(appointment.client) : t("fields.clientNoOwner");
  } else if (vehicleId && owner.status === "ready") {
    clientText = owner.data ? clientLabel(owner.data) : t("fields.clientNoOwner");
  } else if (!vehicleId) {
    clientText = t("fields.clientPending");
  }

  // --- Errors and submit -----------------------------------------------------------------
  const errorText = (key: string | undefined) => {
    if (!key) return undefined;
    const text = key === "vehicleArchived" ? t("errors.vehicleArchived") : tValidation(key as ValidationErrorKey);
    return [{ message: text }];
  };

  const focusFirst = (paths: string[]) => {
    const first = FIELD_ORDER.find((field) => paths.includes(field));
    if (first) document.getElementById(fieldId(id, first))?.focus();
  };

  const save = async (values: AppointmentFormValues) => {
    setSaving(true);
    try {
      const result = await onSubmit(values);
      if (!result || result.ok) return;

      const fieldErrors = Object.entries(result.fieldErrors ?? {});
      if (fieldErrors.length === 0) {
        setFormError(result.error);
        return;
      }
      for (const [field, message] of fieldErrors) form.setError(field as never, { message });
      focusFirst(fieldErrors.map(([field]) => field));
    } finally {
      setSaving(false);
    }
  };

  const submit = form.handleSubmit(
    async (values) => {
      setFormError(null);
      // Cancelling asks first, like the "Cancelar turno" button does.
      if (appointment && needsConfirmation(appointment.status, values.status)) {
        setConfirming(values);
        return;
      }
      await save(values);
    },
    (invalid) => {
      const paths = Object.keys(invalid);
      // A vehicle typed but not chosen isn't "missing".
      if (paths.includes("vehicleId") && vehicleText.trim()) form.setError("vehicleId", { message: "vehicleInvalid" });
      focusFirst(paths);
    },
  );

  const idOf = (field: string) => fieldId(id, field);
  const fieldProps = (name: string, error: { message?: string } | undefined) => ({
    id: idOf(name),
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? `${idOf(name)}-error` : undefined,
  });

  return (
    <form id={id} onSubmit={submit} noValidate className="flex flex-col gap-5 pb-2">
      <FieldGroup>
        <FormRow>
          <Field data-invalid={Boolean(errors.vehicleId)}>
            <FieldLabel htmlFor={idOf("vehicleId")}>{t("fields.vehicle")} *</FieldLabel>
            <VehicleSelect
              id={idOf("vehicleId")}
              value={vehicleId}
              onChange={(next) => form.setValue("vehicleId", next, { shouldValidate: form.formState.isSubmitted })}
              current={appointment?.vehicle}
              onTextChange={setVehicleText}
              invalid={Boolean(errors.vehicleId)}
              describedBy={errors.vehicleId ? `${idOf("vehicleId")}-error` : undefined}
            />
            <FieldError id={`${idOf("vehicleId")}-error`} errors={errorText(errors.vehicleId?.message)} />
          </Field>

          <Field>
            <FieldLabel htmlFor={idOf("clientId")}>{t("fields.client")}</FieldLabel>
            <Input
              id={idOf("clientId")}
              readOnly
              value={clientText}
              className="bg-muted"
              aria-describedby={`${idOf("clientId")}-hint`}
            />
            <FieldDescription id={`${idOf("clientId")}-hint`}>{t("fields.clientHint")}</FieldDescription>
          </Field>
        </FormRow>

        <FormRow>
          <Field data-invalid={Boolean(errors.date)}>
            <FieldLabel htmlFor={idOf("date")}>{t("fields.date")} *</FieldLabel>
            <Input type="date" {...fieldProps("date", errors.date)} {...form.register("date")} />
            <FieldError id={`${idOf("date")}-error`} errors={errorText(errors.date?.message)} />
          </Field>

          <Field data-invalid={Boolean(errors.time)}>
            <FieldLabel htmlFor={idOf("time")}>{t("fields.time")} *</FieldLabel>
            <Input type="time" {...fieldProps("time", errors.time)} {...form.register("time")} />
            <FieldError id={`${idOf("time")}-error`} errors={errorText(errors.time?.message)} />
          </Field>
        </FormRow>

        {appointment ? (
          <FormRow>
            <Field>
              <FieldLabel htmlFor={idOf("status")}>{t("fields.status")}</FieldLabel>
              <Select
                value={status}
                onValueChange={(next) => form.setValue("status", next as AppointmentStatus)}
                items={APPOINTMENT_STATUSES.map((value) => ({ value, label: tStatus(value) }))}
              >
                <SelectTrigger id={idOf("status")} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {tStatus(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FormRow>
        ) : null}

        <Field data-invalid={Boolean(errors.reason)}>
          <FieldLabel htmlFor={idOf("reason")}>{t("fields.reason")}</FieldLabel>
          <Textarea
            rows={3}
            placeholder={t("fields.reasonPlaceholder")}
            {...fieldProps("reason", errors.reason)}
            {...form.register("reason")}
          />
          <FieldError id={`${idOf("reason")}-error`} errors={errorText(errors.reason?.message)} />
        </Field>
      </FieldGroup>

      {formError ? (
        <FormAlert>
          {formError === "notFound" ? t("errors.notFound") : tCommon("unexpectedError")}
        </FormAlert>
      ) : null}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={t("cancelConfirm.title")}
        description={<p>{t("cancelConfirm.body")}</p>}
        confirmLabel={t("cancelConfirm.confirm")}
        pending={saving}
        onConfirm={async () => {
          const values = confirming;
          setConfirming(null);
          if (values) await save(values);
        }}
      />
    </form>
  );
}
