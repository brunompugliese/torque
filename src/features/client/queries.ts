import "server-only";

import { cache } from "react";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { type ListParams, type SortDirection } from "@/lib/list/params";
import { applyListQuery } from "@/lib/list/query";
import { toSearchPattern } from "@/lib/search/normalize";
import { createServerSupabase } from "@/lib/supabase/server";

import { CLIENT_DEFAULT_SORT, CLIENT_SORT_COLUMNS } from "./list";
import {
  CLIENT_COLUMNS,
  CLIENT_OPTION_COLUMNS,
  clientOptionSchema,
  clientRowSchema,
  type Client,
  type ClientOption,
} from "./schemas";

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

export const CLIENT_OPTIONS_LIMIT = 10;

export type ClientOptionList = { ok: true; rows: ClientOption[] } | { ok: false };

// The clients a dropdown offers as the user types: the first few matches by
// name, archived ones included (they stay valid vehicle owners). Without a term
// it lists the first ones.
export async function listClientOptions(term: string): Promise<ClientOptionList> {
  await requireSession();
  const { supabase } = await createServerSupabase();

  const pattern = toSearchPattern(term);
  const query = supabase.from("client_decrypted").select(CLIENT_OPTION_COLUMNS);
  const { data, error } = await (pattern ? query.like("search_text", pattern) : query)
    .order("name_key", { ascending: true, nullsFirst: false })
    .order("id")
    .limit(CLIENT_OPTIONS_LIMIT);
  if (error) {
    console.error("[client] options query failed", { code: error.code });
    return { ok: false };
  }
  return { ok: true, rows: z.array(clientOptionSchema).parse(data ?? []) };
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
