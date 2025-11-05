import { ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import { BOTTOM_HUD_SURFACE_BASE } from "./styles";

interface HudPanelProps {
  title?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

// Defines consistent styling for sub-panels within the bottom HUD
export const HudPanel = ({ title, icon, actions, children, className }: HudPanelProps) => {
  return (
    <section
      className={cn(
        "flex h-full min-w-0 flex-col gap-3 overflow-hidden rounded-2xl p-3",
        BOTTOM_HUD_SURFACE_BASE,
        className,
      )}
    >
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </section>
  );
};
