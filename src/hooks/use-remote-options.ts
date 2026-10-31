"use client";

import { useEffect, useRef, useState } from "react";

export const REMOTE_SEARCH_DEBOUNCE_MS = 300;

type Answer<Row> = { term: string; rows: Row[] };

// The options of a dropdown that searches the server as the user types: the
// term settles for a moment, then `search` runs. Answers to an older term are
// dropped. `loading` is true from the moment the term changes until its answer
// arrives. `search` returns null when it fails (shown as no options).
export function useRemoteOptions<Row>(
  term: string,
  search: (term: string) => Promise<Row[] | null>,
  { enabled = true }: { enabled?: boolean } = {},
): { rows: Row[]; loading: boolean } {
  const [answer, setAnswer] = useState<Answer<Row> | null>(null);
  const latestRequest = useRef(0);
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      const request = ++latestRequest.current;
      searchRef
        .current(term)
        .catch(() => null)
        .then((rows) => {
          if (request === latestRequest.current) setAnswer({ term, rows: rows ?? [] });
        });
    }, REMOTE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, enabled]);

  return { rows: answer?.rows ?? [], loading: enabled && answer?.term !== term };
}
