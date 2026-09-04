import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_CUE, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import type { LucideIcon } from "lucide-react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import { type ReactNode, useState } from "react";

interface InfoBubbleProps {
  title: ReactNode;
  icon?: LucideIcon;
  cue?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Header toggles the body open/closed (default on). The cue stays visible
   *  while collapsed so at-a-glance info (e.g. the automation countdown) is
   *  always available. Set false for bubbles that should never collapse. */
  collapsible?: boolean;
  /** Initial collapsed state when `collapsible`. */
  defaultCollapsed?: boolean;
}

/**
 * InfoBubble — small standalone surface used across the HUD. Surface uses the
 * shared Etched Bronze tokens so it matches every other floating element.
 * Optionally collapsible (header click toggles the body).
 */
export const InfoBubble = ({
  title,
  icon: Icon,
  cue,
  children,
  className,
  bodyClassName,
  collapsible = true,
  defaultCollapsed = false,
}: InfoBubbleProps) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isCollapsed = collapsible && collapsed;
  const toggle = () => setCollapsed((value) => !value);

  return (
    <div className={cn(OVERLAY_SURFACE_BASE, "pointer-events-auto rounded-xl", className)}>
      {/* The whole header toggles collapse — title AND cue. Interactive cue
          controls must stopPropagation so they don't also collapse the panel. */}
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b border-gold/15 px-3 py-2",
          collapsible && "cursor-pointer select-none",
        )}
        onClick={
          collapsible
            ? (event) => {
                // Don't collapse when an interactive cue control (gear, re-sync,
                // BATTLE, …) was clicked — only plain header/cue text toggles.
                if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
                toggle();
              }
            : undefined
        }
        role={collapsible ? "button" : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? !isCollapsed : undefined}
        onKeyDown={
          collapsible
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggle();
                }
              }
            : undefined
        }
      >
        <span className={cn("flex min-w-0 items-center gap-2", HUD_LABEL)}>
          {collapsible && (
            <ChevronDown
              className={cn("h-3.5 w-3.5 flex-shrink-0 text-gold/60 transition-transform", isCollapsed && "-rotate-90")}
            />
          )}
          {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0 text-gold/70" />}
          <span className="truncate">{title}</span>
        </span>
        {cue && <span className={cn("flex-shrink-0", HUD_CUE)}>{cue}</span>}
      </div>
      {!isCollapsed && <div className={cn("px-3 pb-3 pt-1", bodyClassName)}>{children}</div>}
    </div>
  );
};
