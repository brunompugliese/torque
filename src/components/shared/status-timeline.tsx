import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TimelineEntry = {
  id: string;
  // The headline: what happened (a status pill).
  title: ReactNode;
  // Who and when ("Usuario A · 22/10/2026 21:47").
  meta?: ReactNode;
  // Background class for the node; defaults to the foreground color.
  dotClassName?: string;
};

// A vertical timeline, in the order given (newest first for a history). It is a
// list, so a screen reader announces how many entries there are. The rail is drawn
// from each node to the next one's, so the steps are one connected line.
export function StatusTimeline({ entries, ariaLabel }: { entries: readonly TimelineEntry[]; ariaLabel?: string }) {
  return (
    <ol aria-label={ariaLabel} className="flex flex-col">
      {entries.map((entry, index) => (
        <li key={entry.id} className="relative pb-4 pl-5 last:pb-0">
          <span
            aria-hidden="true"
            className={cn("absolute top-2 left-0 z-10 size-2 rounded-full", entry.dotClassName ?? "bg-foreground")}
          />
          {index < entries.length - 1 ? (
            <span aria-hidden="true" className="absolute top-3 -bottom-3 left-1 w-px bg-border" />
          ) : null}
          <div className="flex min-h-6 items-center">{entry.title}</div>
          {entry.meta ? <p className="text-xs text-muted-foreground">{entry.meta}</p> : null}
        </li>
      ))}
    </ol>
  );
}
