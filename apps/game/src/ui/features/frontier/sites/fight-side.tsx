import { formatExact, formatShort } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudPanel } from "@/ui/design-system/kit/hud-elements";

import type { ReactNode } from "react";

/**
 * One side of a fight, as every card that shows a fight draws it (the attack's card before it, the result after it):
 * its mark and troops before, then the troops after, large, the after in red when none are left, and its bar.
 *
 * The two sides share their row's width evenly, whatever their numbers (owner, 10-27: "the army & enemy numbers must
 * both fit"): each side may shrink below its figures' width, and its figures stand on two lines, so a seven-digit army
 * still fits a 360 px phone. Past that the figures read short (fightFigures).
 */
export const FightSide = ({
  label,
  mark,
  before,
  after,
  side,
  tip,
}: {
  label: string;
  mark: ReactNode;
  before: number;
  after: number;
  side: "ours" | "theirs";
  tip?: string;
}) => {
  const figures = fightFigures(before, after);
  return (
    <span
      role="img"
      aria-label={`${label} ${formatExact(before)} → ${formatExact(after)}`}
      data-tip={tip}
      className="flex min-w-0 flex-1 basis-0"
    >
      <HudPanel
        collapsible={false}
        className="min-w-0 flex-1"
        bodyClassName="flex min-w-0 flex-col items-center gap-1 py-2"
      >
        <span aria-hidden className="flex max-w-full items-center gap-1.5 tabular-nums">
          {mark}
          <span className="text-hud-body text-hud-muted">{figures.before} →</span>
        </span>
        <span
          aria-hidden
          className={cn(
            "max-w-full text-hud-display leading-none tabular-nums",
            after === 0 ? "text-hud-bad" : "text-hud-ink",
          )}
        >
          {figures.after}
        </span>
        <FightBar before={before} after={after} side={side} />
      </HudPanel>
    </span>
  );
};

/** From eight digits a figure no longer fits half a 360 px phone's card. */
const SHORT_FROM = 10_000_000;

/**
 * A side's figures as it shows them: exact below ten million, short from there as the HUD writes amounts ("12.3M"),
 * unless the two would read alike while they differ, which reads as a fight that cost nothing.
 */
export const fightFigures = (before: number, after: number): { before: string; after: string } => {
  const readsAlike = before !== after && formatShort(before) === formatShort(after);
  const format = Math.max(before, after) < SHORT_FROM || readsAlike ? formatExact : formatShort;
  return { before: format(before), after: format(after) };
};

/**
 * A side's troops through a fight as one bar (the owner, 22 October: "Clarity is important"): the part left in the
 * side's colour, the player's green and the enemy's red, and the part the fight takes in the HUD's neutral grey.
 */
const FightBar = ({ before, after, side }: { before: number; after: number; side: "ours" | "theirs" }) => {
  const left = before > 0 ? Math.max(0, Math.min(1, after / before)) : 0;
  return (
    <span aria-hidden className="flex h-2 w-full overflow-hidden rounded-full bg-hud-well">
      <span
        className={cn("h-full", side === "ours" ? "bg-hud-good" : "bg-hud-bad")}
        style={{ width: `${left * 100}%` }}
      />
      <span className="h-full bg-hud-neutral" style={{ width: `${(1 - left) * 100}%` }} />
    </span>
  );
};
