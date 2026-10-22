"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm, useWatch, type FieldErrors } from "react-hook-form";

import { FormAlert } from "@/components/shared/form-alert";
import { FIELD_WIDTH, FormRow } from "@/components/shared/form-layout";
import { FormattedInput, PlateInput, VinInput } from "@/components/shared/formatted-input";
import { SearchableSelect, type SelectOption } from "@/components/shared/searchable-select";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatClientName } from "@/features/client/format";
import { searchClientOptions } from "@/features/client/actions";
import { useLoadedData } from "@/hooks/use-loaded-data";
import { useRemoteOptions } from "@/hooks/use-remote-options";
import { maxVehicleYear } from "@/lib/format/date";
import { formatPlate } from "@/lib/format/plate";
import type { ValidationErrorKey } from "@/lib/validation/fields";

import { getBrandOptions, getModelOptions, type VehicleActionResult } from "../actions";
import { splitTypedClient } from "../new-client";
import {
  vehicleFormSchema,
  type CatalogOption,
  type VehicleClient,
  type VehicleField,
  type VehicleFormInput,
  type VehicleFormValues,
  type VehicleListItem,
} from "../schemas";
import { NewClientSection } from "./new-client-section";

const PLATE_ERROR_KEYS = new Set(["plateTaken", "plateTakenArchived"]);
const DNI_ERROR_KEYS = new Set(["dniTaken", "dniTakenArchived"]);
const YEAR_MAX_LENGTH = 4;

// The page's order, so "focus the first error" goes to the first field you see.
const FIELD_ORDER: VehicleField[] = [
  "plate",
  "year",
  "brandId",
  "modelId",
  "vin",
  "clientId",
  "newClient",
  "newClient.name",
  "newClient.surname",
  "newClient.phoneNumber",
  "newClient.dni",
];

const digitsOnly = (input: string) => input.replace(/\D/g, "").slice(0, YEAR_MAX_LENGTH);

type VehicleFormProps = {
  // The modal footer's submit button targets the form by id.
  id: string;
  // The vehicle being edited: it prefills the form, and its brand, model and
  // client are offered even if they were archived.
  vehicle?: VehicleListItem;
  // Creating from a client: the owner is this client and can't be changed.
  lockedClient?: { id: string; name: string };
  onSubmit: (values: VehicleFormValues) => Promise<VehicleActionResult | void>;
};

function toOptions(list: { ok: true; rows: CatalogOption[] } | { ok: false } | null | undefined): SelectOption[] {
  return list?.ok ? list.rows.map((row) => ({ value: row.id, label: row.name })) : [];
}

function fieldId(id: string, field: VehicleField) {
  return `${id}-${field.replace(".", "-")}`;
}

// Every field that has an error, nested ones as "newClient.<field>".
function fieldsWithErrors(errors: FieldErrors<VehicleFormInput>): VehicleField[] {
  const names: VehicleField[] = [];
  for (const [name, error] of Object.entries(errors)) {
    if (name === "newClient" && error && !("message" in error && error.message)) {
      for (const nested of Object.keys(error)) names.push(`newClient.${nested}` as VehicleField);
    } else {
      names.push(name as VehicleField);
    }
  }
  return names;
}

export function VehicleForm({ id, vehicle, lockedClient, onSubmit }: VehicleFormProps) {
  const t = useTranslations("vehicles");
  const tClients = useTranslations("clients");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("validation");
  const [formError, setFormError] = useState(false);

  const form = useForm<VehicleFormInput, unknown, VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      plate: vehicle ? formatPlate(vehicle.plate) : "",
      year: vehicle?.year ? String(vehicle.year) : "",
      brandId: vehicle?.brandId ?? "",
      modelId: vehicle?.modelId ?? "",
      vin: vehicle?.vin ?? "",
      clientId: lockedClient?.id ?? vehicle?.client?.id ?? "",
      newClient: null,
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
    // The focus goes by the page's order (and reaches the dropdowns), see focusFirst.
    shouldFocusError: false,
  });
  const { errors } = form.formState;
  const brandId = useWatch({ control: form.control, name: "brandId" });
  const modelId = useWatch({ control: form.control, name: "modelId" });
  const clientId = useWatch({ control: form.control, name: "clientId" });
  const newClient = useWatch({ control: form.control, name: "newClient" });

  const ownerLabel = (client: VehicleClient) =>
    client.enabled ? formatClientName(client) : t("clientArchived", { name: formatClientName(client) });

  // What each dropdown's box shows. It is kept apart from the chosen id so text
  // that matches no option can be told from an empty field.
  const [brandText, setBrandText] = useState(vehicle?.brandName ?? "");
  const [modelText, setModelText] = useState(vehicle?.modelName ?? "");
  const [clientText, setClientText] = useState(vehicle?.client ? ownerLabel(vehicle.client) : "");
  const [pickedClient, setPickedClient] = useState<SelectOption | null>(
    vehicle?.client ? { value: vehicle.client.id, label: ownerLabel(vehicle.client), secondary: vehicle.client.phoneNumber } : null,
  );

  const brands = useLoadedData("brands", () => getBrandOptions(vehicle?.brandId));
  const brandList = brands.status === "ready" ? brands.data : null;
  const brandOptions = useMemo(() => toOptions(brandList), [brandList]);

  const models = useLoadedData(brandId ? `models:${brandId}` : "models:none", () =>
    brandId ? getModelOptions(brandId, vehicle?.modelId) : Promise.resolve(null),
  );
  const modelList = models.status === "ready" ? models.data : null;
  const modelOptions = useMemo(() => toOptions(modelList), [modelList]);

  const clientSearch = useRemoteOptions(
    clientText.trim(),
    async (term) => {
      const result = await searchClientOptions(term);
      return result.ok ? result.rows : null;
    },
    { enabled: !lockedClient && !newClient },
  );
  const clientOptions = useMemo<SelectOption[]>(
    () =>
      clientSearch.rows.map((client) => ({
        value: client.id,
        label: client.enabled ? formatClientName(client) : t("clientArchived", { name: formatClientName(client) }),
        secondary: client.phoneNumber,
      })),
    [clientSearch.rows, t],
  );

  const errorText = (key: string | undefined) => {
    if (!key) return undefined;
    let text: string;
    if (PLATE_ERROR_KEYS.has(key)) text = t(`errors.${key as "plateTaken" | "plateTakenArchived"}`);
    else if (DNI_ERROR_KEYS.has(key)) text = tClients(`errors.${key as "dniTaken" | "dniTakenArchived"}`);
    else text = tValidation(key as ValidationErrorKey, { max: maxVehicleYear() });
    return [{ message: text }];
  };

  const focusFirst = (names: VehicleField[]) => {
    const first = FIELD_ORDER.find((field) => names.includes(field));
    if (first) document.getElementById(fieldId(id, first))?.focus();
  };

  const fieldProps = (name: VehicleField, error: { message?: string } | undefined) => ({
    id: fieldId(id, name),
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? `${fieldId(id, name)}-error` : undefined,
  });

  const submit = form.handleSubmit(
    async (values) => {
      setFormError(false);

      // Text left in the client box that matches no client.
      if (!lockedClient && !values.newClient && !values.clientId && clientText.trim() !== "") {
        form.setError("clientId", { message: "clientInvalid" });
        focusFirst(["clientId"]);
        return;
      }

      const result = await onSubmit(values);
      if (!result || result.ok) return;

      const fieldErrors = Object.entries(result.fieldErrors ?? {}) as [VehicleField, string][];
      if (fieldErrors.length === 0) {
        setFormError(true);
        return;
      }
      for (const [field, message] of fieldErrors) form.setError(field, { message });
      focusFirst(fieldErrors.map(([field]) => field));
    },
    (invalid) => {
      const names = fieldsWithErrors(invalid);
      // A brand or model that was typed but not chosen isn't "missing".
      if (names.includes("brandId") && brandText.trim()) form.setError("brandId", { message: "brandInvalid" });
      if (names.includes("modelId") && modelText.trim()) form.setError("modelId", { message: "modelInvalid" });
      focusFirst(names);
    },
  );

  const chooseBrand = (next: string) => {
    form.setValue("brandId", next, { shouldValidate: form.formState.isSubmitted });
    // The model belongs to the brand: another brand starts with no model.
    if (next !== brandId) {
      form.setValue("modelId", "");
      setModelText("");
    }
  };

  const chooseClient = (next: string) => {
    form.setValue("clientId", next, { shouldValidate: form.formState.isSubmitted });
    const option = clientOptions.find((candidate) => candidate.value === next);
    setPickedClient(option ?? null);
  };

  const openNewClient = () => {
    // Text typed in the box is carried over, a client picked from the list is not.
    const typed = clientId ? { name: "", surname: "", phoneNumber: "" } : splitTypedClient(clientText);
    form.clearErrors("clientId");
    form.setValue("clientId", "");
    setPickedClient(null);
    setClientText("");
    form.setValue("newClient", { ...typed, dni: "" });
  };

  const discardNewClient = () => {
    form.clearErrors("newClient");
    form.setValue("newClient", null);
  };

  const idOf = (field: VehicleField) => fieldId(id, field);

  return (
    <form id={id} onSubmit={submit} noValidate className="flex flex-col gap-5 pb-2">
      <FieldGroup>
        <FormRow>
          <Field data-invalid={Boolean(errors.plate)} className={FIELD_WIDTH.plate}>
            <FieldLabel htmlFor={idOf("plate")}>{t("fields.plate")} *</FieldLabel>
            <PlateInput
              autoFocus
              placeholder={t("fields.platePlaceholder")}
              {...fieldProps("plate", errors.plate)}
              registration={form.register("plate")}
            />
            <FieldError id={`${idOf("plate")}-error`} errors={errorText(errors.plate?.message)} />
          </Field>

          <Field data-invalid={Boolean(errors.year)} className={FIELD_WIDTH.year}>
            <FieldLabel htmlFor={idOf("year")}>{t("fields.year")}</FieldLabel>
            <FormattedInput
              inputMode="numeric"
              autoComplete="off"
              format={digitsOnly}
              {...fieldProps("year", errors.year)}
              registration={form.register("year")}
            />
            <FieldError id={`${idOf("year")}-error`} errors={errorText(errors.year?.message)} />
          </Field>
        </FormRow>

        <FormRow>
          <Field data-invalid={Boolean(errors.brandId)}>
            <FieldLabel htmlFor={idOf("brandId")}>{t("fields.brand")} *</FieldLabel>
            <SearchableSelect
              id={idOf("brandId")}
              options={brandOptions}
              value={brandId}
              onValueChange={chooseBrand}
              inputValue={brandText}
              onInputValueChange={setBrandText}
              loading={brands.status === "loading"}
              placeholder={t("fields.brandPlaceholder")}
              emptyText={t("fields.noOptions")}
              invalid={Boolean(errors.brandId)}
              describedBy={errors.brandId ? `${idOf("brandId")}-error` : undefined}
            />
            <FieldError id={`${idOf("brandId")}-error`} errors={errorText(errors.brandId?.message)} />
          </Field>

          <Field data-invalid={Boolean(errors.modelId)}>
            <FieldLabel htmlFor={idOf("modelId")}>{t("fields.model")} *</FieldLabel>
            <SearchableSelect
              id={idOf("modelId")}
              options={modelOptions}
              value={modelId}
              onValueChange={(next) => form.setValue("modelId", next, { shouldValidate: form.formState.isSubmitted })}
              inputValue={modelText}
              onInputValueChange={setModelText}
              loading={Boolean(brandId) && models.status === "loading"}
              disabled={!brandId}
              placeholder={brandId ? t("fields.modelPlaceholder") : t("fields.modelDisabled")}
              emptyText={t("fields.noOptions")}
              invalid={Boolean(errors.modelId)}
              describedBy={errors.modelId ? `${idOf("modelId")}-error` : undefined}
            />
            <FieldError id={`${idOf("modelId")}-error`} errors={errorText(errors.modelId?.message)} />
          </Field>
        </FormRow>

        <Field data-invalid={Boolean(errors.vin)} className={FIELD_WIDTH.vin}>
          <FieldLabel htmlFor={idOf("vin")}>{t("fields.vin")}</FieldLabel>
          <VinInput {...fieldProps("vin", errors.vin)} registration={form.register("vin")} />
          <FieldError id={`${idOf("vin")}-error`} errors={errorText(errors.vin?.message)} />
        </Field>

        {newClient ? (
          <NewClientSection id={id} form={form} errorText={errorText} onDiscard={discardNewClient} />
        ) : (
          <Field data-invalid={Boolean(errors.clientId)}>
            <FieldLabel htmlFor={idOf("clientId")}>{t("fields.client")}</FieldLabel>
            {lockedClient ? (
              <Input id={idOf("clientId")} readOnly value={lockedClient.name} className="bg-muted" />
            ) : (
              <SearchableSelect
                id={idOf("clientId")}
                options={clientOptions}
                selectedOption={pickedClient ?? undefined}
                value={clientId ?? ""}
                onValueChange={chooseClient}
                inputValue={clientText}
                onInputValueChange={setClientText}
                filter="remote"
                loading={clientSearch.loading}
                placeholder={t("fields.clientPlaceholder")}
                emptyText={t("fields.noOptions")}
                action={{ label: t("newClient.create"), onSelect: openNewClient }}
                invalid={Boolean(errors.clientId)}
                describedBy={[
                  `${idOf("clientId")}-hint`,
                  errors.clientId ? `${idOf("clientId")}-error` : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            )}
            {lockedClient ? null : <FieldDescription id={`${idOf("clientId")}-hint`}>{t("fields.clientHint")}</FieldDescription>}
            <FieldError id={`${idOf("clientId")}-error`} errors={errorText(errors.clientId?.message)} />
          </Field>
        )}
      </FieldGroup>

      {formError ? <FormAlert>{tCommon("unexpectedError")}</FormAlert> : null}
    </form>
  );
}
