import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { ReactNode } from "react";

/** A section's name across its width, in the sheet's label, a divider either side. */
export const Headline = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("flex w-full select-none items-center gap-3 px-3 py-1", className)}>
    <span className="h-px flex-1 bg-hud-divider" aria-hidden="true" />
    <span className="whitespace-nowrap text-hud-label text-hud-muted">{children}</span>
    <span className="h-px flex-1 bg-hud-divider" aria-hidden="true" />
  </div>
);
