import "server-only";

import { cache } from "react";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { type ListParams, type SortDirection } from "@/lib/list/params";
import { applyListQuery } from "@/lib/list/query";
import { createServerSupabase } from "@/lib/supabase/server";

import { CLIENT_COLUMNS, CLIENT_DEFAULT_SORT, CLIENT_SORT_COLUMNS, clientRowSchema, type Client } from "./schemas";

export type ClientPage = { ok: true; rows: Client[]; matching: number } | { ok: false };
export type ClientCounts = { ok: true; total: number; archived: number } | { ok: false };

// cache() compares arguments by identity, so params go in as primitives.
const listClientsCached = cache(
  async (
    search: string,
    showArchived: boolean,
    sortBy: string,
    sort: SortDirection,
    page: number,
  ): Promise<ClientPage> => {
    await requireSession();
    const { supabase } = await createServerSupabase();

    // The table is encrypted: read through the decrypted view.
    const query = supabase.from("client_decrypted").select(CLIENT_COLUMNS, { count: "exact" });
    const { data, error, count } = await applyListQuery(
      query,
      { search, showArchived, sortBy, sort, page },
      { searchColumn: "search_text", sortColumns: CLIENT_SORT_COLUMNS, defaultSortBy: CLIENT_DEFAULT_SORT },
    );
    if (error) {
      console.error("[client] list query failed", { code: error.code });
      return { ok: false };
    }
    return { ok: true, rows: z.array(clientRowSchema).parse(data ?? []), matching: count ?? 0 };
  },
);

export function listClients(params: ListParams): Promise<ClientPage> {
  return listClientsCached(params.search, params.showArchived, params.sortBy, params.sort, params.page);
}

// Counts read the table, not the view: nothing to decrypt.
export const getClientCounts = cache(async (): Promise<ClientCounts> => {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const [all, archived] = await Promise.all([
    supabase.from("client").select("id", { count: "exact", head: true }),
    supabase.from("client").select("id", { count: "exact", head: true }).eq("enabled", false),
  ]);
  const error = all.error ?? archived.error;
  if (error) {
    console.error("[client] count query failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, total: all.count ?? 0, archived: archived.count ?? 0 };
});
