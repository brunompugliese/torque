import { formatPlate } from "@/lib/format/plate";
import { cn } from "@/lib/utils";

type PlateDisplayProps = {
  // As stored (uppercase, no spaces) or already spaced.
  plate: string;
  className?: string;
};

// Every plate is drawn the same and takes the same room, whatever its format
// (Mercosur, old, motorcycle…): only the characters change. The width fits the
// longest one ("AB 123 CD") and the characters are centered.
export const PLATE_WIDTH_CLASS = "w-32";

// Argentine plate for tables and modal titles (docs/design.md#visual-identity):
// white, black border, blue top band, bold spaced characters. In running text
// and dropdowns use formatPlate as plain text instead.
export function PlateDisplay({ plate, className }: PlateDisplayProps) {
  return (
    <span
      data-slot="plate"
      className={cn(
        "inline-flex shrink-0 flex-col overflow-hidden rounded-[5px] border border-plate-foreground bg-plate text-plate-foreground",
        PLATE_WIDTH_CLASS,
        className,
      )}
    >
      <span aria-hidden="true" data-slot="plate-band" className="h-1 w-full bg-plate-band" />
      <span className="px-2 py-0.5 text-center text-sm leading-tight font-bold tracking-widest whitespace-nowrap tabular-nums">
        {formatPlate(plate)}
      </span>
    </span>
  );
}
