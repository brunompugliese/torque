export type ActionResult<Data, ErrorKey extends string = string, Field extends string = string> =
  | { ok: true; data: Data }
  | { ok: false; error: ErrorKey; fieldErrors?: Partial<Record<Field, string>> };

export function ok<Data>(data: Data): { ok: true; data: Data } {
  return { ok: true, data };
}

export function fail<ErrorKey extends string, Field extends string = string>(
  error: ErrorKey,
  fieldErrors?: Partial<Record<Field, string>>,
): { ok: false; error: ErrorKey; fieldErrors?: Partial<Record<Field, string>> } {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}
