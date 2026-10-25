import "server-only";

import { cache } from "react";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { type ListParams, type SortDirection } from "@/lib/list/params";
import { applyListQuery } from "@/lib/list/query";
import { toSearchPattern } from "@/lib/search/normalize";
import { createServerSupabase } from "@/lib/supabase/server";

import { VEHICLE_DEFAULT_SORT, VEHICLE_SORT_COLUMNS } from "./list";
import {
  VEHICLE_COLUMNS,
  VEHICLE_LIST_COLUMNS,
  catalogOptionSchema,
  vehicleListRowSchema,
  vehicleRowSchema,
  type CatalogOption,
  type Vehicle,
  type VehicleListItem,
} from "./schemas";

export type VehicleList = { ok: true; rows: Vehicle[] } | { ok: false };
export type ClientVehicleList = { ok: true; rows: VehicleListItem[] } | { ok: false };
export type VehiclePage = { ok: true; rows: VehicleListItem[]; matching: number } | { ok: false };
export type VehicleCounts = { ok: true; total: number; archived: number } | { ok: false };
export type CatalogOptionList = { ok: true; rows: CatalogOption[] } | { ok: false };

// cache() compares arguments by identity, so params go in as primitives.
const listVehiclesCached = cache(
  async (
    search: string,
    showArchived: boolean,
    sortBy: string,
    sort: SortDirection,
    page: number,
  ): Promise<VehiclePage> => {
    await requireSession();
    const { supabase } = await createServerSupabase();

    // The table is encrypted: read through the decrypted view.
    const query = supabase.from("vehicle_decrypted").select(VEHICLE_LIST_COLUMNS, { count: "exact" });
    const { data, error, count } = await applyListQuery(
      query,
      { search, showArchived, sortBy, sort, page, filters: {} },
      { searchColumn: "search_text", sortColumns: VEHICLE_SORT_COLUMNS, defaultSortBy: VEHICLE_DEFAULT_SORT },
    );
    if (error) {
      console.error("[vehicle] list query failed", { code: error.code });
      return { ok: false };
    }
    return { ok: true, rows: z.array(vehicleListRowSchema).parse(data ?? []), matching: count ?? 0 };
  },
);

export function listVehicles(params: ListParams): Promise<VehiclePage> {
  return listVehiclesCached(params.search, params.showArchived, params.sortBy, params.sort, params.page);
}

// Counts read the table, not the view: nothing to decrypt.
export const getVehicleCounts = cache(async (): Promise<VehicleCounts> => {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const [all, archived] = await Promise.all([
    supabase.from("vehicle").select("id", { count: "exact", head: true }),
    supabase.from("vehicle").select("id", { count: "exact", head: true }).eq("enabled", false),
  ]);
  const error = all.error ?? archived.error;
  if (error) {
    console.error("[vehicle] count query failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, total: all.count ?? 0, archived: archived.count ?? 0 };
});

function parseRows(data: unknown): VehicleList {
  return { ok: true, rows: z.array(vehicleRowSchema).parse(data ?? []) };
}

// The client's vehicles, with what the vehicle modal shows. No page and no
// search: the list is short. Created order, with the id as tiebreak, keeps rows
// steady between loads.
export async function listClientVehicles(clientId: string): Promise<ClientVehicleList> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("vehicle_decrypted")
    .select(VEHICLE_LIST_COLUMNS)
    .eq("client_id", clientId)
    .order("created_at")
    .order("id");
  if (error) {
    console.error("[vehicle] client vehicles query failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, rows: z.array(vehicleListRowSchema).parse(data ?? []) };
}

// Filtered in memory by the step that uses it, so it comes whole.
export async function listUnassignedVehicles(): Promise<VehicleList> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const { data, error } = await supabase
    .from("vehicle_decrypted")
    .select(VEHICLE_COLUMNS)
    .is("client_id", null)
    .order("created_at")
    .order("id");
  if (error) {
    console.error("[vehicle] unassigned vehicles query failed", { code: error.code });
    return { ok: false };
  }
  return parseRows(data);
}

// The catalog's enabled brands, plus the one the vehicle already has even if it
// was archived in the catalog. `currentId` must already be a validated uuid.
export async function listBrandOptions(currentId?: string): Promise<CatalogOptionList> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const query = supabase.from("brand").select("id, name");
  const { data, error } = await (currentId ? query.or(`enabled.eq.true,id.eq.${currentId}`) : query.eq("enabled", true))
    .order("name")
    .order("id");
  if (error) {
    console.error("[vehicle] brands query failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, rows: z.array(catalogOptionSchema).parse(data ?? []) };
}

// Same for the models of one brand.
export async function listModelOptions(brandId: string, currentId?: string): Promise<CatalogOptionList> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const query = supabase.from("model").select("id, name").eq("brand_id", brandId);
  const { data, error } = await (currentId ? query.or(`enabled.eq.true,id.eq.${currentId}`) : query.eq("enabled", true))
    .order("name")
    .order("id");
  if (error) {
    console.error("[vehicle] models query failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, rows: z.array(catalogOptionSchema).parse(data ?? []) };
}

export const VEHICLE_OPTIONS_LIMIT = 10;

const vehicleOptionSchema = z
  .object({ id: z.string(), plate: z.string(), brand_name: z.string(), model_name: z.string(), enabled: z.boolean() })
  .transform(({ brand_name, model_name, ...row }) => ({ ...row, brandName: brand_name, modelName: model_name }));

export type VehicleOption = z.output<typeof vehicleOptionSchema>;
export type VehicleOptionList = { ok: true; rows: VehicleOption[] } | { ok: false };

// The active vehicles a job or an appointment can be created for, as the user types; the record's
// own vehicle (`currentId`, a validated uuid) stays listed even if archived.
export async function listVehicleOptions(term: string, currentId?: string): Promise<VehicleOptionList> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const pattern = toSearchPattern(term);
  let query = supabase.from("vehicle_decrypted").select("id, plate, brand_name, model_name, enabled");
  if (pattern) query = query.like("search_text", pattern);
  query = currentId ? query.or(`enabled.eq.true,id.eq.${currentId}`) : query.eq("enabled", true);

  const { data, error } = await query.order("plate").order("id").limit(VEHICLE_OPTIONS_LIMIT);
  if (error) {
    console.error("[vehicle] options failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, rows: z.array(vehicleOptionSchema).parse(data ?? []) };
}
