import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_CUE, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface InfoBubbleProps {
  title: ReactNode;
  icon?: LucideIcon;
  cue?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * InfoBubble — small standalone surface used inside the right-edge
 * tile-details column. Always-open; the previous collapse mechanism was
 * removed because the column already gates which bubbles render based on
 * the tile's actual content.
 *
 * Surface uses the shared Etched Bronze tokens so it matches every other
 * floating element in the HUD (top pills, view-switcher, minimap, view
 * panel).
 */
export const InfoBubble = ({ title, icon: Icon, cue, children, className, bodyClassName }: InfoBubbleProps) => {
  return (
    <div className={cn(OVERLAY_SURFACE_BASE, "pointer-events-auto rounded-xl", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-gold/15 px-3 py-2">
        <span className={cn("flex min-w-0 items-center gap-2", HUD_LABEL)}>
          {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0 text-gold/70" />}
          <span className="truncate">{title}</span>
        </span>
        {cue && <span className={cn("flex-shrink-0", HUD_CUE)}>{cue}</span>}
      </div>
      <div className={cn("px-3 pb-3 pt-1", bodyClassName)}>{children}</div>
    </div>
  );
};

/**
 * Backward-compatible export so consumers that imported `CollapsibleBubble`
 * still work. Drop this alias once nothing references the old name.
 */
export const CollapsibleBubble = InfoBubble;
