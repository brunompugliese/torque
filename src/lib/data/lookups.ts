import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

type Client = Pick<SupabaseClient, "from">;

export class LookupError extends Error {
  constructor(readonly code: string | undefined) {
    super(`lookup failed${code ? ` (${code})` : ""}`);
  }
}

const matchSchema = z.object({ id: z.string(), enabled: z.boolean() });

export type KeyMatch = z.infer<typeof matchSchema>;

// Archived rows count too (docs/design.md#uniqueness-per-shop).
export async function findByKey(
  supabase: Client,
  { table, column, key, excludeId }: { table: string; column: string; key: string; excludeId?: string },
): Promise<KeyMatch | null> {
  let query = supabase.from(table).select("id, enabled").eq(column, key);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new LookupError(error.code);
  return data ? matchSchema.parse(data) : null;
}

export async function existsWhere(
  supabase: Client,
  { table, column, value }: { table: string; column: string; value: string },
): Promise<boolean> {
  const { data, error } = await supabase.from(table).select("id").eq(column, value).limit(1);
  if (error) throw new LookupError(error.code);
  return (data ?? []).length > 0;
}
