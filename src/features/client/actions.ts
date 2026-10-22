"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { requireSession } from "@/lib/auth/session";
import { findByKey } from "@/lib/data/lookups";
import { parseListParams } from "@/lib/list/params";
import { createServerSupabase } from "@/lib/supabase/server";
import { toFieldErrors } from "@/lib/validation/fields";

import { listClientOptions, listClients, type ClientOptionList, type ClientPage } from "./queries";
import {
  CLIENT_COLUMNS,
  clientFormSchema,
  clientIdSchema,
  clientRowSchema,
  type Client,
  type ClientField,
  type ClientFormValues,
} from "./schemas";

const CLIENTS_PATH = "/clientes";
const UNIQUE_VIOLATION = "23505";

export type ClientErrorKey = "invalid" | "dniTaken" | "dniTakenArchived" | "notFound" | "unexpected";

export type ClientActionResult = ActionResult<Client, ClientErrorKey, ClientField>;

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>["supabase"];

function unexpected(where: string, code?: string): ClientActionResult {
  // Codes only: never log personal data.
  console.error(`[client] ${where} failed`, { code });
  return fail("unexpected");
}

function parseForm(input: unknown): { ok: true; data: ClientFormValues } | { ok: false; result: ClientActionResult } {
  const parsed = clientFormSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, result: fail("invalid", toFieldErrors<ClientField>(parsed.error)) };
}

// Writes return ciphertext, so the saved client is read back through the view.
async function readBack(supabase: Supabase, id: string): Promise<ClientActionResult> {
  const { data, error } = await supabase.from("client_decrypted").select(CLIENT_COLUMNS).eq("id", id).maybeSingle();
  if (error) return unexpected("read back", error.code);
  if (!data) return fail("notFound");
  revalidatePath(CLIENTS_PATH);
  return ok(clientRowSchema.parse(data));
}

// The database refused a duplicate DNI: find out whose it is to say whether
// that client is archived (docs/design.md#uniqueness-per-shop).
async function dniClash(supabase: Supabase, dni: string | null, excludeId?: string): Promise<ClientActionResult> {
  if (!dni) return unexpected("duplicate without a DNI");
  try {
    const match = await findByKey(supabase, { table: "client_decrypted", column: "dni", key: dni, excludeId });
    if (!match) return unexpected("duplicate not found");
    const error = match.enabled ? "dniTaken" : "dniTakenArchived";
    return fail(error, { dni: error });
  } catch {
    return unexpected("dni lookup");
  }
}

export async function createClient(input: unknown): Promise<ClientActionResult> {
  const form = parseForm(input);
  if (!form.ok) return form.result;

  const { shopId } = await requireSession();
  const { supabase } = await createServerSupabase();

  const { name, surname, phoneNumber, dni, email } = form.data;
  const { data, error } = await supabase
    .from("client")
    .insert({ shop_id: shopId, name, surname, dni, phone_number: phoneNumber, email })
    .select("id")
    .single();
  if (error?.code === UNIQUE_VIOLATION) return dniClash(supabase, dni);
  if (error || !data) return unexpected("insert", error?.code);

  return readBack(supabase, String(data.id));
}

export async function updateClient(id: unknown, input: unknown): Promise<ClientActionResult> {
  const clientId = clientIdSchema.safeParse(id);
  if (!clientId.success) return fail("notFound");
  const form = parseForm(input);
  if (!form.ok) return form.result;

  await requireSession();
  const { supabase } = await createServerSupabase();

  const { name, surname, phoneNumber, dni, email } = form.data;
  const { data, error } = await supabase
    .from("client")
    .update({ name, surname, dni, phone_number: phoneNumber, email })
    .eq("id", clientId.data)
    .select("id")
    .maybeSingle();
  if (error?.code === UNIQUE_VIOLATION) return dniClash(supabase, dni, clientId.data);
  if (error) return unexpected("update", error.code);
  if (!data) return fail("notFound");

  return readBack(supabase, clientId.data);
}

export async function setClientArchived(id: unknown, archived: boolean): Promise<ClientActionResult> {
  const clientId = clientIdSchema.safeParse(id);
  if (!clientId.success) return fail("notFound");

  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("client")
    .update({ enabled: !archived })
    .eq("id", clientId.data)
    .select("id")
    .maybeSingle();
  if (error) return unexpected("archive", error.code);
  if (!data) return fail("notFound");

  return readBack(supabase, clientId.data);
}

export async function searchClients(listSearch: unknown): Promise<ClientPage> {
  const params = parseListParams(new URLSearchParams(typeof listSearch === "string" ? listSearch : ""));
  return listClients(params);
}

const OPTION_TERM_MAX_LENGTH = 100;

// Read action for the vehicle form's client dropdown. The term travels in the
// request body, never in a URL.
export async function searchClientOptions(term: unknown): Promise<ClientOptionList> {
  if (typeof term !== "string") return { ok: false };
  return listClientOptions(term.slice(0, OPTION_TERM_MAX_LENGTH));
}
