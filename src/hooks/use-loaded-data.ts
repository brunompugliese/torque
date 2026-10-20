"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Outcome<Data> = { ok: true; data: Data } | { ok: false };

export type LoadedData<Data> =
  // `previous` is the last data that loaded, if any: a caller that reloads in
  // place (after a retry) can keep showing it instead of a skeleton. After a
  // key change it belongs to the old key.
  | { status: "loading"; previous?: Data; retry: () => void }
  | { status: "error"; retry: () => void }
  | { status: "ready"; data: Data; retry: () => void };

// Loads data for a modal or panel when it mounts and again when `key` changes.
// A rejected load is the "error" state, so the caller can offer "Reintentar".
// Answers that arrive after a newer request are dropped.
export function useLoadedData<Data>(key: string, load: () => Promise<Data>): LoadedData<Data> {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ token: string; outcome: Outcome<Data> } | null>(null);
  const loadRef = useRef(load);
  const latestRequest = useRef(0);
  const token = `${key}#${attempt}`;

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    const request = ++latestRequest.current;
    loadRef
      .current()
      .then(
        (data): Outcome<Data> => ({ ok: true, data }),
        (): Outcome<Data> => ({ ok: false }),
      )
      .then((outcome) => {
        if (request === latestRequest.current) setLoaded({ token, outcome });
      });
  }, [token]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  if (!loaded || loaded.token !== token) {
    return { status: "loading", previous: loaded?.outcome.ok ? loaded.outcome.data : undefined, retry };
  }
  if (!loaded.outcome.ok) return { status: "error", retry };
  return { status: "ready", data: loaded.outcome.data, retry };
}
