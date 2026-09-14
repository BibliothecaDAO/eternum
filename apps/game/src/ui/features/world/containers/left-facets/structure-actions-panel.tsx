import { memo } from "react";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { type StructureAction, type StructureActionBadge, useStructureActions } from "./use-structure-actions";

/** The desktop action strip for the active owned structure: one row of icon-over-word cells under the token panel
 *  in the left column. The items, their guards and their dispatch are `useStructureActions`. */
export const StructureActionsPanel = memo(() => {
  const actions = useStructureActions();
  if (!actions) return null;

  return (
    <nav
      aria-label="Structure actions"
      className={cn(OVERLAY_SURFACE_BASE, "grid grid-flow-col auto-cols-fr divide-x divide-gold/15 rounded-xl")}
    >
      {actions.map((action) => (
        <ActionTile key={action.id} variant="panel" action={action} />
      ))}
    </nav>
  );
});

StructureActionsPanel.displayName = "StructureActionsPanel";

const BADGE_TONE_CLASS: Record<StructureActionBadge["tone"], string> = {
  ready: "bg-green/90 text-black",
  pending: "bg-gold text-dark-brown",
};

/** `panel` is a cell of the rounded desktop strip; `compact` is a thumb-sized tile for the phone row or rail. */
type ActionTileVariant = "panel" | "compact";

const TILE_VARIANT_CLASS: Record<ActionTileVariant, { button: string; icon: string; label: string }> = {
  panel: {
    button: "gap-1.5 px-0.5 py-2.5 first:rounded-l-xl last:rounded-r-xl hover:bg-gold/10",
    icon: "h-7 w-7",
    label: "text-[9px] tracking-[0.04em] min-[1800px]:text-[10px] min-[1800px]:tracking-[0.12em]",
  },
  compact: {
    button:
      "min-h-11 flex-1 justify-center gap-1 rounded-lg px-1 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold active:bg-gold/15",
    icon: "h-6 w-6",
    label: "text-[10px] tracking-[0.04em]",
  },
};

/** One action as a tile: the icon over its word, lit while its surface is open, with its arrival badges. */
export const ActionTile = ({ action, variant }: { action: StructureAction; variant: ActionTileVariant }) => {
  const { image, label, active, badges = [], onClick } = action;
  const classes = TILE_VARIANT_CLASS[variant];
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 flex-col items-center transition",
        classes.button,
        active && "bg-gold/15 shadow-[inset_0_-2px_0_rgba(223,170,84,0.9)]",
      )}
    >
      <img src={image} alt="" className={cn("object-contain", classes.icon)} />
      <span className={cn(HUD_LABEL, "max-w-full truncate", classes.label, active && "text-gold")}>{label}</span>
      {badges
        .filter((badge) => badge.count > 0)
        .map((badge, index) => (
          <span
            key={badge.tone}
            aria-label={`${badge.count} ${badge.tone}`}
            className={cn(
              "absolute top-1 rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
              index === 0 ? "right-1" : "left-1",
              BADGE_TONE_CLASS[badge.tone],
            )}
          >
            {badge.count}
          </span>
        ))}
    </button>
  );
};
