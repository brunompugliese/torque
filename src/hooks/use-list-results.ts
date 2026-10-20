"use client";

import { useEffect, useRef, useState } from "react";

type Loaded<Result> = { key: string; result: Result };

// Starts from the server-rendered results and fetches only the results when the
// list state (key) changes, instead of re-rendering the page. Answers that
// arrive after a newer request are dropped.
export function useListResults<Result>(
  initial: Result,
  initialKey: string,
  key: string,
  fetchResults: (key: string) => Promise<Result>,
) {
  const [loaded, setLoaded] = useState<Loaded<Result>>({ key: initialKey, result: initial });
  const [attempt, setAttempt] = useState(0);
  const latestRequest = useRef(0);
  const fetchRef = useRef(fetchResults);
  useEffect(() => {
    fetchRef.current = fetchResults;
  }, [fetchResults]);

  // New server data (e.g. after a save revalidates the page) replaces ours.
  const [syncedInitial, setSyncedInitial] = useState(initial);
  if (initial !== syncedInitial) {
    setSyncedInitial(initial);
    setLoaded({ key: initialKey, result: initial });
  }

  useEffect(() => {
    if (key === loaded.key && attempt === 0) return;
    const request = ++latestRequest.current;
    fetchRef.current(key).then((result) => {
      if (request !== latestRequest.current) return;
      setLoaded({ key, result });
      setAttempt(0);
    });
  }, [key, loaded.key, attempt]);

  return {
    result: loaded.result,
    pending: key !== loaded.key || attempt > 0,
    retry: () => setAttempt((count) => count + 1),
  };
}
