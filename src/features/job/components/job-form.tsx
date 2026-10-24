"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { ClosingWarning } from "@/components/shared/closing-warning";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormAlert } from "@/components/shared/form-alert";
import { FormRow } from "@/components/shared/form-layout";
import { FormattedInput } from "@/components/shared/formatted-input";
import { SearchableSelect, type SelectOption } from "@/components/shared/searchable-select";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatClientName } from "@/features/client/format";
import { useLoadedData } from "@/hooks/use-loaded-data";
import { useRemoteOptions } from "@/hooks/use-remote-options";
import { formatKm, formatKmInput } from "@/lib/format/km";
import { formatPlate } from "@/lib/format/plate";
import { JOB_STATUSES, isClosedStatus, jobPhase, type JobStatus } from "@/lib/status";
import type { ValidationErrorKey } from "@/lib/validation/fields";

import {
  getOwnerOfVehicle,
  getServiceOptions,
  getVehicleKmFloor,
  searchVehicleOptions,
  type JobActionResult,
} from "../actions";
import { emptyJobForm, jobClientId, jobToFormState, type JobFormRow } from "../form";
import { jobFormSchema, type JobFormInput, type JobFormValues, type JobItem, type JobListItem } from "../schemas";
import { fillFinalPrices } from "../total";
import { ServicesEditor } from "./services-editor";

// The page's order, so "focus the first error" goes to the first field you see.
const FIELD_ORDER = [
  "vehicleId",
  "status",
  "kilometers",
  "observations",
] as const;

type JobFormProps = {
  // The modal footer's submit button targets the form by id.
  id: string;
  // The job being edited and its saved services: they prefill the form, and its vehicle,
  // client and services are offered even if they were archived.
  job?: JobListItem;
  items?: readonly JobItem[];
  onSubmit: (values: JobFormValues) => Promise<JobActionResult | void>;
};

function fieldId(id: string, field: string) {
  return `${id}-${field.replace(/\./g, "-")}`;
}

// Every field that has an error, nested ones by their path ("newClient.name", "items.0.quantity").
function errorPaths(errors: object, prefix = ""): string[] {
  const paths: string[] = [];
  for (const [name, error] of Object.entries(errors)) {
    if (!error || typeof error !== "object") continue;
    const path = prefix ? `${prefix}.${name}` : name;
    if ("message" in error && error.message) paths.push(path);
    else paths.push(...errorPaths(error, path));
  }
  return paths;
}

// The ids of the focusable controls, in the order the user sees them.
function focusOrder(id: string, paths: string[]): string | undefined {
  const known = FIELD_ORDER.find((field) => paths.includes(field));
  if (known) return fieldId(id, known);
  // Within a row, the order the fields appear in.
  const rank = ["serviceId", "quantity", "quotedUnitPrice", "finalUnitPrice"];
  const rows = paths
    .filter((path) => path.startsWith("items."))
    .map((path) => {
      const [, index, field] = path.split(".");
      return { index: Number(index), field };
    })
    .sort((a, b) => a.index - b.index || rank.indexOf(a.field) - rank.indexOf(b.field));
  const first = rows[0];
  return first ? fieldId(id, `items-${first.index}-${first.field}`) : undefined;
}

export function JobForm({ id, job, items = [], onSubmit }: JobFormProps) {
  const t = useTranslations("jobs");
  const tStatus = useTranslations("status.job");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<JobFormValues | null>(null);
  const [saving, setSaving] = useState(false);

  const storedHadFinal = items.some((item) => item.finalUnitPrice !== null);
  const storedPhaseWork = job ? jobPhase(job.status, storedHadFinal) === "work" : false;

  const form = useForm<JobFormInput, unknown, JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: job ? jobToFormState(job, items) : emptyJobForm(),
    mode: "onSubmit",
    reValidateMode: "onChange",
    // The focus goes by the page's order (and reaches the dropdowns), see focusFirst.
    shouldFocusError: false,
  });
  const { errors } = form.formState;
  const vehicleId = useWatch({ control: form.control, name: "vehicleId" }) ?? "";
  const status: JobStatus = useWatch({ control: form.control, name: "status" }) ?? "pendiente";
  const phase = jobPhase(status, storedHadFinal);

  const vehicleLabel = (vehicle: { brandName: string; modelName: string; enabled: boolean }) =>
    vehicle.enabled
      ? `${vehicle.brandName} ${vehicle.modelName}`
      : t("fields.vehicleArchived", { label: `${vehicle.brandName} ${vehicle.modelName}` });

  // --- Vehicle ---------------------------------------------------------------------------
  const currentVehicleOption = (vehicle: JobListItem["vehicle"]): SelectOption => ({
    value: vehicle.id,
    label: vehicleLabel(vehicle),
    secondary: formatPlate(vehicle.plate),
    inputLabel: `${vehicleLabel(vehicle)} (${formatPlate(vehicle.plate)})`,
  });
  const [pickedVehicle, setPickedVehicle] = useState<SelectOption | null>(job ? currentVehicleOption(job.vehicle) : null);
  const [vehicleText, setVehicleText] = useState(pickedVehicle?.inputLabel ?? "");

  const vehicleSearch = useRemoteOptions(vehicleText.trim(), async (term) => {
    const result = await searchVehicleOptions(term, job?.vehicle.id);
    return result.ok ? result.rows : null;
  });
  const vehicleOptions = useMemo<SelectOption[]>(
    () =>
      vehicleSearch.rows.map((vehicle) => currentVehicleOption({ ...vehicle, year: null })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the option builders only read translations
    [vehicleSearch.rows],
  );

  // --- Client: the vehicle's owner, never chosen ------------------------------------------
  const owner = useLoadedData(vehicleId ? `owner:${vehicleId}` : "owner:none", async () => {
    if (!vehicleId) return null;
    const result = await getOwnerOfVehicle(vehicleId);
    if (!result.ok) throw new Error("owner");
    return result.owner;
  });
  const ownerInfo = owner.status === "ready" ? owner.data : null;
  // An archived owner can't be put on a new job; a job that already has it keeps it.
  const clientId = ownerInfo ? jobClientId(ownerInfo, job?.client?.id ?? null) : null;
  const ownerArchived = ownerInfo !== null && !ownerInfo.enabled && clientId === null;

  useEffect(() => {
    if (owner.status === "ready") form.setValue("clientId", clientId ?? "");
  }, [owner.status, clientId, form]);

  const clientLabel = (client: { name: string; surname: string | null; enabled: boolean }) =>
    client.enabled ? formatClientName(client) : t("fields.clientArchived", { name: formatClientName(client) });

  const chooseVehicle = (next: string, option: SelectOption | null) => {
    form.setValue("vehicleId", next, { shouldValidate: form.formState.isSubmitted });
    setPickedVehicle(option);
    // Another vehicle starts with no appointment ("Sin turno").
    if (next && next !== vehicleId) form.setValue("appointmentId", "");
  };

  // While the owner loads, an edit shows the client the job already has.
  let clientText = job?.client && vehicleId === job.vehicle.id ? clientLabel(job.client) : "";
  if (owner.status === "ready" && vehicleId) {
    clientText =
      ownerInfo && clientId
        ? ownerInfo.enabled
          ? formatClientName(ownerInfo)
          : t("fields.clientArchived", { name: formatClientName(ownerInfo) })
        : t("noClient");
  }

  // --- Kilometers ------------------------------------------------------------------------
  const kmTouched = useRef(job !== undefined);
  const floor = useLoadedData(vehicleId ? `floor:${vehicleId}` : "floor:none", async () => {
    if (!vehicleId) return null;
    const result = await getVehicleKmFloor(vehicleId, job?.id);
    return result.ok ? result.floor : null;
  });
  const floorKm = floor.status === "ready" ? floor.data : null;

  // A new job starts from the vehicle's latest km, until the user types their own.
  useEffect(() => {
    if (floor.status !== "ready" || kmTouched.current) return;
    form.setValue("kilometers", floor.data === null ? "" : formatKmInput(String(floor.data)));
  }, [floor, form]);

  // --- Services --------------------------------------------------------------------------
  const savedServiceIds = useMemo(() => items.map((item) => item.serviceId), [items]);
  const services = useLoadedData("services", async () => {
    const result = await getServiceOptions(savedServiceIds);
    if (!result.ok) throw new Error("services");
    return result.rows;
  });
  const serviceOptions = useMemo<SelectOption[]>(
    () =>
      services.status === "ready"
        ? services.data.map((service) => ({
            value: service.id,
            label: service.enabled ? service.name : t("editor.archivedService", { name: service.name }),
          }))
        : [],
    [services, t],
  );
  // The text in each row's service box, and the rows' keys by position (to find a row's text).
  const [rowTexts, setRowTexts] = useState<Record<string, string>>({});
  const [rowKeys, setRowKeys] = useState<string[]>([]);

  // --- Status ----------------------------------------------------------------------------
  const chooseStatus = (next: JobStatus) => {
    const nextPhase = jobPhase(next, storedHadFinal);
    const rows = (form.getValues("items") ?? []) as JobFormRow[];
    if (nextPhase === "work" && phase !== "work") {
      // Into the work phase: every empty final price starts as the quoted one.
      form.setValue("items", fillFinalPrices(rows) as never);
    } else if (nextPhase === "quote" && phase === "work") {
      // Final prices exist only in the work phase.
      form.setValue("items", rows.map((row) => ({ ...row, finalUnitPrice: "" })) as never);
    }
    form.setValue("status", next);
  };

  // --- Errors and submit -----------------------------------------------------------------
  const errorText = (key: string | undefined) => {
    if (!key) return undefined;
    let text: string;
    switch (key) {
      case "kmBelowPrevious":
        text = floorKm === null ? t("errors.kmBelowPreviousNoFloor") : t("errors.kmBelowPrevious", { floor: formatKm(floorKm) });
        break;
      case "vehicleArchived":
      case "clientArchived":
        text = t(`errors.${key}`);
        break;
      default:
        text = tValidation(key as ValidationErrorKey);
    }
    return [{ message: text }];
  };

  const focusFirst = (paths: string[]) => {
    const target = focusOrder(id, paths);
    if (target) document.getElementById(target)?.focus();
  };

  const save = async (values: JobFormValues) => {
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

      const problems: string[] = [];
      // A km below the previous jobs' (the database says the same, in case another save came first).
      if (floorKm !== null && values.kilometers !== null && values.kilometers < floorKm) {
        form.setError("kilometers", { message: "kmBelowPrevious" });
        problems.push("kilometers");
      }
      if (problems.length > 0) {
        focusFirst(problems);
        return;
      }

      // Closing a job can't be undone: ask first.
      if (isClosedStatus(values.status)) {
        setConfirming(values);
        return;
      }
      await save(values);
    },
    (invalid) => {
      const paths = errorPaths(invalid);
      // A vehicle typed but not chosen isn't "missing".
      if (paths.includes("vehicleId") && vehicleText.trim()) form.setError("vehicleId", { message: "vehicleInvalid" });
      // Neither is a service.
      for (const path of paths) {
        const match = /^items\.(\d+)\.serviceId$/.exec(path);
        if (!match) continue;
        const typed = rowTexts[rowKeys[Number(match[1])] ?? ""];
        if (typed?.trim()) form.setError(path as never, { message: "serviceInvalid" });
      }
      focusFirst(paths);
    },
  );

  const idOf = (field: string) => fieldId(id, field);
  const fieldProps = (name: string, error: { message?: string } | undefined) => ({
    id: idOf(name),
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? `${idOf(name)}-error` : undefined,
  });

  const closingStatus = status === "entregado" || status === "cancelado" ? status : null;
  const kmHint = floorKm === null ? null : t("fields.kilometersHint", { km: formatKm(floorKm) });
  const kmRegistration = form.register("kilometers");

  return (
    <form id={id} onSubmit={submit} noValidate className="flex flex-col gap-5 pb-2">
      <FieldGroup>
        <FormRow>
        <Field data-invalid={Boolean(errors.vehicleId)}>
          <FieldLabel htmlFor={idOf("vehicleId")}>{t("fields.vehicle")} *</FieldLabel>
          <SearchableSelect
            id={idOf("vehicleId")}
            options={vehicleOptions}
            selectedOption={pickedVehicle ?? undefined}
            value={vehicleId}
            onValueChange={(next) =>
              chooseVehicle(
                next,
                vehicleOptions.find((candidate) => candidate.value === next) ??
                  (pickedVehicle?.value === next ? pickedVehicle : null),
              )
            }
            inputValue={vehicleText}
            onInputValueChange={setVehicleText}
            filter="remote"
            loading={vehicleSearch.loading}
            placeholder={t("fields.vehiclePlaceholder")}
            emptyText={t("fields.noOptions")}
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
            placeholder={t("fields.clientPending")}
            className="bg-muted"
            aria-describedby={ownerArchived ? `${idOf("clientId")}-hint` : undefined}
          />
          {ownerArchived && ownerInfo ? (
            <FieldDescription id={`${idOf("clientId")}-hint`}>
              {t("fields.ownerArchivedHint", { name: formatClientName(ownerInfo) })}
            </FieldDescription>
          ) : null}
        </Field>
        </FormRow>

        <FormRow>
          <Field data-invalid={Boolean(errors.status)}>
            <FieldLabel htmlFor={idOf("status")}>{t("fields.status")} *</FieldLabel>
            <Select
              value={status}
              onValueChange={(next) => chooseStatus(next as JobStatus)}
              items={JOB_STATUSES.map((value) => ({ value, label: tStatus(value) }))}
            >
              <SelectTrigger id={idOf("status")} className="w-full" aria-invalid={Boolean(errors.status)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOB_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {tStatus(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id={`${idOf("status")}-error`} errors={errorText(errors.status?.message)} />
          </Field>

          <Field data-invalid={Boolean(errors.kilometers)}>
            <FieldLabel htmlFor={idOf("kilometers")}>{t("fields.kilometers")}</FieldLabel>
            <FormattedInput
              inputMode="numeric"
              autoComplete="off"
              format={formatKmInput}
              {...fieldProps("kilometers", errors.kilometers)}
              aria-describedby={[kmHint ? `${idOf("kilometers")}-hint` : null, errors.kilometers ? `${idOf("kilometers")}-error` : null]
                .filter(Boolean)
                .join(" ") || undefined}
              registration={{
                ...kmRegistration,
                onChange: (event) => {
                  kmTouched.current = true;
                  return kmRegistration.onChange(event);
                },
              }}
            />
            {kmHint ? <FieldDescription id={`${idOf("kilometers")}-hint`}>{kmHint}</FieldDescription> : null}
            <FieldError id={`${idOf("kilometers")}-error`} errors={errorText(errors.kilometers?.message)} />
          </Field>
        </FormRow>

        {closingStatus ? <ClosingWarning>{t("closing.warning", { status: t(`closing.${closingStatus}`) })}</ClosingWarning> : null}

        <Field data-invalid={Boolean(errors.observations)}>
          <FieldLabel htmlFor={idOf("observations")}>{t("fields.observations")}</FieldLabel>
          <Textarea rows={3} {...fieldProps("observations", errors.observations)} {...form.register("observations")} />
          <FieldError id={`${idOf("observations")}-error`} errors={errorText(errors.observations?.message)} />
        </Field>

        <ServicesEditor
          id={id}
          form={form}
          phase={phase}
          quotedLocked={storedPhaseWork}
          options={serviceOptions}
          loadingOptions={services.status === "loading"}
          noOptionsText={t("fields.noOptions")}
          rowTexts={rowTexts}
          onRowText={(rowKey, text) => setRowTexts((current) => ({ ...current, [rowKey]: text }))}
          onRowKeys={setRowKeys}
          errorText={errorText}
        />
      </FieldGroup>

      {formError ? (
        <FormAlert>
          {formError === "closed" || formError === "serviceArchived" || formError === "notFound"
            ? t(`errors.${formError}`)
            : tCommon("unexpectedError")}
        </FormAlert>
      ) : null}

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={t("closing.confirmTitle")}
        description={
          <p>{t("closing.confirmBody", { status: t(`closing.${closingStatus ?? "entregado"}`) })}</p>
        }
        confirmLabel={t("closing.confirm")}
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
