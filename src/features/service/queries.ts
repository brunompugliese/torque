import "server-only";

import { cache } from "react";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { type ListParams, type SortDirection } from "@/lib/list/params";
import { applyListQuery } from "@/lib/list/query";
import { createServerSupabase } from "@/lib/supabase/server";

import { SERVICE_COLUMNS, SERVICE_DEFAULT_SORT, SERVICE_SORT_COLUMNS, serviceRowSchema, type Service } from "./schemas";

export type ServicePage = { ok: true; rows: Service[]; matching: number } | { ok: false };
export type ServiceCounts = { ok: true; total: number; archived: number } | { ok: false };

// cache() compares arguments by identity, so params go in as primitives.
const listServicesCached = cache(
  async (
    search: string,
    showArchived: boolean,
    sortBy: string,
    sort: SortDirection,
    page: number,
  ): Promise<ServicePage> => {
    await requireSession();
    const { supabase } = await createServerSupabase();

    const query = supabase.from("service").select(SERVICE_COLUMNS, { count: "exact" });
    const { data, error, count } = await applyListQuery(
      query,
      { search, showArchived, sortBy, sort, page },
      { searchColumn: "search_text", sortColumns: SERVICE_SORT_COLUMNS, defaultSortBy: SERVICE_DEFAULT_SORT },
    );
    if (error) {
      console.error("[service] list query failed", { code: error.code });
      return { ok: false };
    }
    return { ok: true, rows: z.array(serviceRowSchema).parse(data ?? []), matching: count ?? 0 };
  },
);

export function listServices(params: ListParams): Promise<ServicePage> {
  return listServicesCached(params.search, params.showArchived, params.sortBy, params.sort, params.page);
}

export const getServiceCounts = cache(async (): Promise<ServiceCounts> => {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const [all, archived] = await Promise.all([
    supabase.from("service").select("id", { count: "exact", head: true }),
    supabase.from("service").select("id", { count: "exact", head: true }).eq("enabled", false),
  ]);
  const error = all.error ?? archived.error;
  if (error) {
    console.error("[service] count query failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, total: all.count ?? 0, archived: archived.count ?? 0 };
});
