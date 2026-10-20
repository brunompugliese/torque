import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { LoadingRegion } from "./loading-region";

export function TextSkeleton({ className }: { className?: string }) {
  return (
    <LoadingRegion className="inline-block align-middle">
      <Skeleton className={cn("h-4 w-40", className)} />
    </LoadingRegion>
  );
}
