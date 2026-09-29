import type { ReactNode } from "react";

type TopBarProps = {
  appName: string;
  shopName?: string;
  actions?: ReactNode;
};

export function TopBar({ appName, shopName, actions }: TopBarProps) {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-12 max-w-5xl items-center gap-2 px-4 text-sm sm:px-6">
        <span className="font-semibold tracking-tight">{appName}</span>
        {shopName ? (
          <>
            <span aria-hidden="true" className="text-muted-foreground">
              ×
            </span>
            <span className="truncate text-muted-foreground">{shopName}</span>
          </>
        ) : null}
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
