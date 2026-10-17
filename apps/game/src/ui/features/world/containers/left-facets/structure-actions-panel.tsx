import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { type StructureAction, type StructureActionBadge } from "./use-structure-actions";

const BADGE_TONE_CLASS: Record<StructureActionBadge["tone"], string> = {
  ready: "bg-green/90 text-black",
  pending: "bg-gold text-dark-brown",
};

/**
 * One action as a thumb-sized tile for the phone's action row or rail: the icon over its word, lit while its surface
 * is open, with its arrival badges.
 */
export const ActionTile = ({ action }: { action: StructureAction }) => {
  const { label, active, badges = [], refusal, onClick } = action;
  return (
    <button
      type="button"
      data-popover-anchor={action.id === "trade" ? "market" : action.id}
      aria-label={label}
      aria-pressed={active}
      disabled={refusal !== null}
      title={refusal ?? undefined}
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 flex-col items-center transition disabled:cursor-not-allowed disabled:opacity-50",
        "min-h-11 flex-1 justify-center gap-1 rounded-lg px-1 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold active:bg-gold/15",
        active && "bg-gold/15 shadow-[inset_0_-2px_0_rgba(223,170,84,0.9)]",
      )}
    >
      <SemanticIcon name={action.id} alt="" className="h-6 w-6 object-contain" />
      <span
        className={cn(HUD_LABEL, "max-w-full truncate text-[11px] normal-case tracking-normal", active && "text-gold")}
      >
        {action.id === "production" ? "Produce" : label}
      </span>
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
