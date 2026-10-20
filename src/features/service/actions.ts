"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/session";
import { parseListParams } from "@/lib/list/params";
import { existsWhere, findByKey } from "@/lib/data/lookups";
import { normalizeSearch } from "@/lib/search/normalize";
import { createServerSupabase } from "@/lib/supabase/server";
import { toFieldErrors } from "@/lib/validation/fields";

import { listServices, type ServicePage } from "./queries";
import {
  SERVICE_COLUMNS,
  serviceFormSchema,
  serviceIdSchema,
  serviceRowSchema,
  type Service,
  type ServiceField,
  type ServiceFormValues,
} from "./schemas";

const SERVICES_PATH = "/servicios";

export type ServiceErrorKey =
  | "invalid"
  | "nameTaken"
  | "nameTakenArchived"
  | "renameNeedsConfirmation"
  | "notFound"
  | "unexpected";

export type ServiceActionResult = ActionResult<Service, ServiceErrorKey, ServiceField>;

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>["supabase"];

function unexpected(where: string, code?: string): ServiceActionResult {
  console.error(`[service] ${where} failed`, { code });
  return fail("unexpected");
}

async function checkNameTaken(
  supabase: Supabase,
  name: string,
  excludeId?: string,
): Promise<ServiceActionResult | null> {
  const match = await findByKey(supabase, {
    table: "service",
    column: "name_key",
    key: normalizeSearch(name),
    excludeId,
  });
  if (!match) return null;
  const error = match.enabled ? "nameTaken" : "nameTakenArchived";
  return fail(error, { name: error });
}

function parseForm(input: unknown): { ok: true; data: ServiceFormValues } | { ok: false; result: ServiceActionResult } {
  const parsed = serviceFormSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, result: fail("invalid", toFieldErrors<ServiceField>(parsed.error)) };
}

export async function createService(input: unknown): Promise<ServiceActionResult> {
  const form = parseForm(input);
  if (!form.ok) return form.result;

  const { shopId } = await requireSession();
  const { supabase } = await createServerSupabase();

  try {
    const taken = await checkNameTaken(supabase, form.data.name);
    if (taken) return taken;
  } catch {
    return unexpected("name lookup");
  }

  const { data, error } = await supabase
    .from("service")
    .insert({ shop_id: shopId, name: form.data.name, description: form.data.description })
    .select(SERVICE_COLUMNS)
    .single();
  if (error) return unexpected("insert", error.code);

  revalidatePath(SERVICES_PATH);
  return ok(serviceRowSchema.parse(data));
}

export async function updateService(
  id: unknown,
  input: unknown,
  options: { confirmRename?: boolean } = {},
): Promise<ServiceActionResult> {
  const serviceId = serviceIdSchema.safeParse(id);
  if (!serviceId.success) return fail("notFound");
  const form = parseForm(input);
  if (!form.ok) return form.result;

  await requireSession();
  const { supabase } = await createServerSupabase();

  const current = await supabase.from("service").select("name").eq("id", serviceId.data).maybeSingle();
  if (current.error) return unexpected("current row", current.error.code);
  if (!current.data) return fail("notFound");

  // Changing only case, accents or spacing isn't a rename.
  const renamed = normalizeSearch(String(current.data.name)) !== normalizeSearch(form.data.name);
  if (renamed) {
    try {
      const taken = await checkNameTaken(supabase, form.data.name, serviceId.data);
      if (taken) return taken;
      if (!options.confirmRename) {
        const used = await existsWhere(supabase, { table: "job_item", column: "service_id", value: serviceId.data });
        if (used) return fail("renameNeedsConfirmation");
      }
    } catch {
      return unexpected("rename checks");
    }
  }

  const { data, error } = await supabase
    .from("service")
    .update({ name: form.data.name, description: form.data.description })
    .eq("id", serviceId.data)
    .select(SERVICE_COLUMNS)
    .maybeSingle();
  if (error) return unexpected("update", error.code);
  if (!data) return fail("notFound");

  revalidatePath(SERVICES_PATH);
  return ok(serviceRowSchema.parse(data));
}

export async function setServiceArchived(id: unknown, archived: boolean): Promise<ServiceActionResult> {
  const serviceId = serviceIdSchema.safeParse(id);
  if (!serviceId.success) return fail("notFound");

  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("service")
    .update({ enabled: !archived })
    .eq("id", serviceId.data)
    .select(SERVICE_COLUMNS)
    .maybeSingle();
  if (error) return unexpected("archive", error.code);
  if (!data) return fail("notFound");

  revalidatePath(SERVICES_PATH);
  return ok(serviceRowSchema.parse(data));
}

export async function searchServices(listSearch: unknown): Promise<ServicePage> {
  const params = parseListParams(new URLSearchParams(typeof listSearch === "string" ? listSearch : ""));
  return listServices(params);
}
