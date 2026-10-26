import "server-only";

import { cache } from "react";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";

import { APPOINTMENT_LIST_COLUMNS, appointmentListRowSchema, type AppointmentListItem } from "./schemas";

export type AppointmentRange = { ok: true; rows: AppointmentListItem[] } | { ok: false };
export type AppointmentCounts = { ok: true; total: number } | { ok: false };
export type AppointmentRowResult = { ok: true; row: AppointmentListItem } | { ok: false };

// The appointments of the visible days (both ends included), in the order a day lists them. The
// vehicle's plate, the client and the reason are encrypted: read through the list view. Archived
// appointments are never shown. `from` and `to` must already be validated days.
const listAppointmentsCached = cache(async (from: string, to: string): Promise<AppointmentRange> => {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("appointment_list")
    .select(APPOINTMENT_LIST_COLUMNS)
    .gte("date", from)
    .lte("date", to)
    .eq("enabled", true)
    .order("date")
    .order("time")
    .order("created_at")
    .order("id");
  if (error) {
    console.error("[appointment] range query failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, rows: z.array(appointmentListRowSchema).parse(data ?? []) };
});

export function listAppointments(from: string, to: string): Promise<AppointmentRange> {
  return listAppointmentsCached(from, to);
}

// The count reads the table, not the view: nothing to decrypt.
export const getAppointmentCounts = cache(async (): Promise<AppointmentCounts> => {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const { count, error } = await supabase
    .from("appointment")
    .select("id", { count: "exact", head: true })
    .eq("enabled", true);
  if (error) {
    console.error("[appointment] count query failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, total: count ?? 0 };
});

// Inicio's summary: the appointments from `from` to `to` (both included) that are not cancelled.
export const getAppointmentCountInRange = cache(
  async (from: string, to: string): Promise<AppointmentCounts> => {
    await requireSession();
    const { supabase } = await createServerSupabase();

    const { count, error } = await supabase
      .from("appointment")
      .select("id", { count: "exact", head: true })
      .eq("enabled", true)
      .neq("status", "cancelado")
      .gte("date", from)
      .lte("date", to);
    if (error) {
      console.error("[appointment] range count query failed", { code: error.code });
      return { ok: false };
    }
    return { ok: true, total: count ?? 0 };
  },
);

// One appointment as the calendar shows it.
export async function getAppointmentListRow(id: string): Promise<AppointmentRowResult> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("appointment_list")
    .select(APPOINTMENT_LIST_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[appointment] row query failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, row: appointmentListRowSchema.parse(data) };
}
