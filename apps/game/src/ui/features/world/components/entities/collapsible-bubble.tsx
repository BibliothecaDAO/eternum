import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_CUE, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";

import { type ReactNode, useState } from "react";

interface InfoBubbleProps {
  /** The panel's name for assistive technology; given, the panel is a named section (a landmark). */
  label?: string;
  /** The header band's words; without them the panel is its frame and body alone (the minimap). */
  title?: ReactNode;
  icon?: IconMeaning;
  cue?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: "panel" | "section";
  bodyClassName?: string;
  /** Header toggles the body open/closed (default on). The cue stays visible
   *  while collapsed so at-a-glance info (e.g. the automation countdown) is
   *  always available. Set false for bubbles that should never collapse. */
  collapsible?: boolean;
  /** Initial collapsed state when `collapsible`. */
  defaultCollapsed?: boolean;
}

/**
 * The HUD's one panel: the overlay surface, a header band naming it over a divider, and its body. Every panel of the
 * Blitz and Eternum HUD is one (holdings, the selected holding, minimap, Next up, events, the picked tile). Optionally
 * collapsible (header click toggles the body).
 */
export const InfoBubble = ({
  label,
  title,
  icon,
  cue,
  children,
  className,
  variant = "panel",
  bodyClassName,
  collapsible = true,
  defaultCollapsed = false,
}: InfoBubbleProps) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const isCollapsed = collapsible && collapsed;
  const Root = label ? "section" : "div";
  return (
    <Root
      aria-label={label}
      className={cn(
        "hud-panel pointer-events-auto shrink-0",
        variant === "panel" && [OVERLAY_SURFACE_BASE, "rounded-xl"],
        className,
      )}
    >
      {title !== undefined && (
        <PanelHeader
          title={title}
          icon={icon}
          cue={cue}
          collapse={collapsible ? { collapsed: isCollapsed, toggle: () => setCollapsed((value) => !value) } : null}
        />
      )}
      {!isCollapsed && <div className={cn("px-3 pb-3 pt-1", bodyClassName)}>{children}</div>}
    </Root>
  );
};

/**
 * The band naming a panel, over its divider. A collapsible panel's whole header toggles it, title and cue; an
 * interactive cue control (gear, re-sync, Battle, All) does not.
 */
const PanelHeader = ({
  title,
  icon: Icon,
  cue,
  collapse,
}: {
  title: ReactNode;
  icon?: IconMeaning;
  cue?: ReactNode;
  collapse: { collapsed: boolean; toggle: () => void } | null;
}) => (
  <div
    className={cn(
      "flex items-center justify-between gap-2 border-b border-gold/15 px-3 py-2",
      collapse && "cursor-pointer select-none",
    )}
    onClick={
      collapse
        ? (event) => {
            if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
            collapse.toggle();
          }
        : undefined
    }
    role={collapse ? "button" : undefined}
    tabIndex={collapse ? 0 : undefined}
    aria-expanded={collapse ? !collapse.collapsed : undefined}
    onKeyDown={
      collapse
        ? (event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              collapse.toggle();
            }
          }
        : undefined
    }
  >
    <span className={cn("flex min-w-0 items-center gap-2", HUD_LABEL)}>
      {collapse && (
        <SemanticIcon
          name="chevron-down"
          className={cn(
            "h-3.5 w-3.5 flex-shrink-0 text-gold/60 transition-transform",
            collapse.collapsed && "-rotate-90",
          )}
        />
      )}
      {Icon && <SemanticIcon name={Icon} className="h-3.5 w-3.5 flex-shrink-0 text-gold/70" />}
      <span className="truncate">{title}</span>
    </span>
    {cue && <span className={cn("flex-shrink-0", HUD_CUE)}>{cue}</span>}
  </div>
);
