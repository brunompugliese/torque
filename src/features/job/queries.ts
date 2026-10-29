import "server-only";

import { cache } from "react";
import { z } from "zod";

import { getShop } from "@/features/shop/queries";
import { requireSession } from "@/lib/auth/session";
import { todayIsoDate } from "@/lib/calendar";
import { argentinaDayStart, argentinaNextDayStart } from "@/lib/format/date";
import { type ListParams, type SortDirection } from "@/lib/list/params";
import { applyListQuery } from "@/lib/list/query";
import { toSearchPattern } from "@/lib/search/normalize";
import { JOB_STATUSES, type JobStatus } from "@/lib/status";
import { createServerSupabase } from "@/lib/supabase/server";

import { HOME_OPEN_STATUSES, homeClosedFrom, homeMixedFilterExpression, homeStatusFilter } from "./home";
import { JOB_DEFAULT_DIRECTION, JOB_DEFAULT_SORT, JOB_FILTER, JOB_SORT_COLUMNS, parseJobFilters } from "./list";
import {
  JOB_HISTORY_COLUMNS,
  JOB_HISTORY_ENTRY_COLUMNS,
  JOB_ITEM_COLUMNS,
  JOB_LIST_COLUMNS,
  jobHistoryEntrySchema,
  jobItemRowSchema,
  jobListRowSchema,
  jobRowSchema,
  type JobHistoryEntry,
  type JobItem,
  type JobListItem,
  type VehicleJob,
} from "./schemas";
import { buildSheet, type JobSheet } from "./sheet";

export type VehicleJobList = { ok: true; rows: VehicleJob[] } | { ok: false };
export type JobPage = { ok: true; rows: JobListItem[]; matching: number } | { ok: false };
export type JobCounts = { ok: true; total: number; archived: number } | { ok: false };
export type JobRowResult = { ok: true; row: JobListItem } | { ok: false };
export type JobDetail = { ok: true; items: JobItem[]; history: JobHistoryEntry[] } | { ok: false };
// Trabajos lists every job; Inicio lists the open ones and, when ticked, the recently closed ones.
export type JobListScope = "all" | "home";
export type JobStatusCounts = { ok: true; counts: Record<JobStatus, number> } | { ok: false };

// Every job of the vehicle, archived ones included, newest first. No page: the
// vehicle modal shows five and expands the rest in place.
export async function listVehicleJobs(vehicleId: string): Promise<VehicleJobList> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("job")
    .select(JOB_HISTORY_COLUMNS)
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) {
    console.error("[job] vehicle jobs query failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, rows: z.array(jobRowSchema).parse(data ?? []) };
}

// The list's filters as database bounds: the statuses to keep and the instants
// the last update must fall between (the end excluded), Argentina days.
function filterBounds(filters: Record<string, string>) {
  const { statuses, from, to } = parseJobFilters(filters);
  return {
    statuses,
    from: from ? argentinaDayStart(from) : null,
    to: to ? argentinaNextDayStart(to) : null,
  };
}

// cache() compares arguments by identity, so params go in as primitives.
const listJobsCached = cache(
  async (
    search: string,
    showArchived: boolean,
    sortBy: string,
    sort: SortDirection,
    page: number,
    status: string,
    from: string,
    to: string,
    scope: JobListScope,
  ): Promise<JobPage> => {
    await requireSession();
    const { supabase } = await createServerSupabase();

    const filters = { [JOB_FILTER.status]: status, [JOB_FILTER.from]: from, [JOB_FILTER.to]: to };

    // The plate and the client are encrypted: read through the list view.
    let query = supabase.from("job_list").select(JOB_LIST_COLUMNS, { count: "exact" });
    if (scope === "home") {
      // Inicio: its own rules, taken from the server's clock; the URL's dates and archived switch
      // mean nothing here, and a search never brings archived jobs back.
      const filter = homeStatusFilter(parseJobFilters(filters).statuses, homeClosedFrom(todayIsoDate()));
      if (filter.kind === "in") query = query.in("status", filter.statuses);
      else if (filter.kind === "closed-window")
        query = query.in("status", filter.statuses).gte("updated_at", filter.from);
      else query = query.or(homeMixedFilterExpression(filter));
      query = query.eq("enabled", true);
    } else {
      const bounds = filterBounds(filters);
      if (bounds.statuses.length > 0) query = query.in("status", bounds.statuses);
      if (bounds.from) query = query.gte("updated_at", bounds.from);
      if (bounds.to) query = query.lt("updated_at", bounds.to);
    }

    const { data, error, count } = await applyListQuery(
      query,
      { search, showArchived, sortBy, sort, page, filters: {} },
      {
        searchColumn: "search_text",
        sortColumns: JOB_SORT_COLUMNS,
        defaultSortBy: JOB_DEFAULT_SORT,
        defaultDirection: JOB_DEFAULT_DIRECTION,
      },
    );
    if (error) {
      console.error("[job] list query failed", { code: error.code });
      return { ok: false };
    }
    return { ok: true, rows: z.array(jobListRowSchema).parse(data ?? []), matching: count ?? 0 };
  },
);

export function listJobs(params: ListParams, scope: JobListScope = "all"): Promise<JobPage> {
  const { filters } = params;
  return listJobsCached(
    params.search,
    params.showArchived,
    params.sortBy,
    params.sort,
    params.page,
    filters[JOB_FILTER.status] ?? "",
    filters[JOB_FILTER.from] ?? "",
    filters[JOB_FILTER.to] ?? "",
    scope,
  );
}

// Inicio's "trabajos abiertos": active jobs that are not delivered or cancelled.
export const getOpenJobCount = cache(async (): Promise<{ ok: true; total: number } | { ok: false }> => {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const { count, error } = await supabase
    .from("job")
    .select("id", { count: "exact", head: true })
    .eq("enabled", true)
    .in("status", HOME_OPEN_STATUSES);
  if (error) {
    console.error("[job] open count query failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, total: count ?? 0 };
});

// Counts read the table, not the view: nothing to decrypt.
export const getJobCounts = cache(async (): Promise<JobCounts> => {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const [all, archived] = await Promise.all([
    supabase.from("job").select("id", { count: "exact", head: true }),
    supabase.from("job").select("id", { count: "exact", head: true }).eq("enabled", false),
  ]);
  const error = all.error ?? archived.error;
  if (error) {
    console.error("[job] count query failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, total: all.count ?? 0, archived: archived.count ?? 0 };
});

const statusCountRowSchema = z.object({
  status: z.enum(JOB_STATUSES),
  total: z.union([z.number(), z.string().transform(Number)]),
});

// The Estado filter's numbers: jobs per status for the current search, archived
// switch and dates, ignoring the Estado selection itself. One request.
export async function getJobStatusCounts(params: ListParams, scope: JobListScope = "all"): Promise<JobStatusCounts> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const home = scope === "home";
  const bounds = filterBounds(params.filters);
  const { data, error } = await supabase.rpc(
    "job_status_counts",
    home
      ? {
          p_pattern: toSearchPattern(params.search),
          p_show_archived: false,
          p_from: null,
          p_to: null,
          p_closed_from: homeClosedFrom(todayIsoDate()),
          p_enabled_only: true,
        }
      : {
          p_pattern: toSearchPattern(params.search),
          p_show_archived: params.showArchived,
          p_from: bounds.from,
          p_to: bounds.to,
        },
  );
  if (error) {
    console.error("[job] status counts failed", { code: error.code });
    return { ok: false };
  }

  const counts = Object.fromEntries(JOB_STATUSES.map((status) => [status, 0])) as Record<JobStatus, number>;
  for (const row of z.array(statusCountRowSchema).parse(data ?? [])) counts[row.status] = row.total;
  return { ok: true, counts };
}

// One job as the list shows it, for a modal opened from somewhere else (a
// vehicle's history).
export async function getJobListRow(id: string): Promise<JobRowResult> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase.from("job_list").select(JOB_LIST_COLUMNS).eq("id", id).maybeSingle();
  if (error || !data) {
    if (error) console.error("[job] row query failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, row: jobListRowSchema.parse(data) };
}

// What the job modal loads when it opens: the services and the status history.
export async function getJobDetail(id: string): Promise<JobDetail> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const [items, history] = await Promise.all([
    supabase.from("job_item").select(JOB_ITEM_COLUMNS).eq("job_id", id).order("created_at").order("id"),
    supabase
      .from("job_status_history")
      .select(JOB_HISTORY_ENTRY_COLUMNS)
      .eq("job_id", id)
      .order("changed_at", { ascending: false })
      .order("id", { ascending: false }),
  ]);
  const error = items.error ?? history.error;
  if (error) {
    console.error("[job] detail query failed", { code: error.code });
    return { ok: false };
  }
  return {
    ok: true,
    items: z.array(jobItemRowSchema).parse(items.data ?? []),
    history: z.array(jobHistoryEntrySchema).parse(history.data ?? []),
  };
}

export type JobSheetResult = { ok: true; sheet: JobSheet } | { ok: false; reason: "notFound" | "error" };

// Everything the printed sheet needs, read under the user's session (spec 013): the job as the list
// shows it, its services and the shop. The status history that getJobDetail also reads isn't used.
export async function getJobSheet(id: string): Promise<JobSheetResult> {
  const [row, detail, shop] = await Promise.all([getJobListRow(id), getJobDetail(id), getShop()]);
  if (!row.ok) return { ok: false, reason: "notFound" };
  if (!detail.ok) return { ok: false, reason: "error" };
  const vin = await getVehicleVin(row.row.vehicle.id);
  return { ok: true, sheet: buildSheet(row.row, detail.items, shop, vin, new Date()) };
}

// The vehicle's VIN, decrypted (job_list doesn't carry it). A failed read leaves the sheet without it
// rather than failing the whole sheet.
async function getVehicleVin(vehicleId: string): Promise<string | null> {
  const { supabase } = await createServerSupabase();
  const { data, error } = await supabase.from("vehicle_decrypted").select("vin").eq("id", vehicleId).maybeSingle();
  if (error) {
    console.error("[job] vehicle vin failed", { code: error.code });
    return null;
  }
  return typeof data?.vin === "string" ? data.vin : null;
}

// -----------------------------------------------------------------------------
// The job form's dropdowns and hints
// -----------------------------------------------------------------------------

export type KmFloor = { ok: true; floor: number | null } | { ok: false };

// The highest km among the vehicle's non-archived jobs: the same rule as
// check_job_kilometers. For a job being edited only the jobs created before it
// count (correcting an old job isn't blocked by later ones).
export async function getKmFloor(vehicleId: string, jobId?: string): Promise<KmFloor> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  let before: string | null = null;
  if (jobId) {
    const own = await supabase.from("job").select("created_at").eq("id", jobId).maybeSingle();
    if (own.error) {
      console.error("[job] km floor failed", { code: own.error.code });
      return { ok: false };
    }
    before = own.data ? String(own.data.created_at) : null;
  }

  let query = supabase
    .from("job")
    .select("kilometers")
    .eq("vehicle_id", vehicleId)
    .eq("enabled", true)
    .not("kilometers", "is", null);
  if (jobId) query = query.neq("id", jobId);
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query.order("kilometers", { ascending: false }).limit(1);
  if (error) {
    console.error("[job] km floor failed", { code: error.code });
    return { ok: false };
  }
  const km = data?.[0]?.kilometers;
  return { ok: true, floor: typeof km === "number" ? km : null };
}

const ownerSchema = z.object({
  client_id: z.string().nullable(),
  client_name: z.string().nullable(),
  client_surname: z.string().nullable(),
  client_phone_number: z.string().nullable(),
  client_enabled: z.boolean().nullable(),
});

export type VehicleOwner = {
  id: string;
  name: string;
  surname: string | null;
  phoneNumber: string;
  enabled: boolean;
};

export type VehicleOwnerResult = { ok: true; owner: VehicleOwner | null } | { ok: false };

// The vehicle's owner: the job's client. It comes with its state, because an archived
// owner can't be put on a new job (see jobClientId).
export async function getVehicleOwner(vehicleId: string): Promise<VehicleOwnerResult> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("vehicle_decrypted")
    .select("client_id, client_name, client_surname, client_phone_number, client_enabled")
    .eq("id", vehicleId)
    .maybeSingle();
  if (error) {
    console.error("[job] vehicle owner failed", { code: error.code });
    return { ok: false };
  }
  if (!data) return { ok: true, owner: null };
  const row = ownerSchema.parse(data);
  if (row.client_id === null || row.client_name === null) {
    return { ok: true, owner: null };
  }
  return {
    ok: true,
    owner: {
      id: row.client_id,
      name: row.client_name,
      surname: row.client_surname,
      phoneNumber: row.client_phone_number ?? "",
      enabled: row.client_enabled ?? true,
    },
  };
}

const serviceOptionSchema = z.object({ id: z.string(), name: z.string(), enabled: z.boolean() });

export type ServiceOption = z.output<typeof serviceOptionSchema>;
export type ServiceOptionList = { ok: true; rows: ServiceOption[] } | { ok: false };

// The catalog's active services, plus the ones already on the job even if they
// were archived since. `currentIds` must already be validated uuids.
export async function listServiceOptions(currentIds: string[] = []): Promise<ServiceOptionList> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const query = supabase.from("service").select("id, name, enabled");
  const { data, error } = await (currentIds.length > 0
    ? query.or(`enabled.eq.true,id.in.(${currentIds.join(",")})`)
    : query.eq("enabled", true)
  )
    .order("name_key")
    .order("id");
  if (error) {
    console.error("[job] service options failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, rows: z.array(serviceOptionSchema).parse(data ?? []) };
}
