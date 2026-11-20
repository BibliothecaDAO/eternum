import { formatExact, formatShort } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudPanel } from "@/ui/design-system/kit/hud-elements";
import { fightLost, NONE_LOST } from "@/ui/design-system/kit/words";

import type { ReactNode } from "react";

/**
 * What a side keeps after the fight: one exact number when it is known, and
 * undefined when no forecast is known (the fight cannot be fought yet).
 */
export type Kept = number | undefined;

/**
 * One side of a fight, as every card that shows a fight draws it, in every state (owner, 10-27: "this panel doesnt
 * match at all our new battle panels"): the attack's card in reach or not, its result, and Blitz's preview. Its mark
 * and troops before, then the troops it keeps, large (red when none are, a dash when not known), its bar, and under the
 * bar what the fight costs it in troops and share ("−601 · 76% lost"; owner, 3 November 2026, layout A), red for the
 * player's side and gold for the enemy's. A side whose fight is not known claims no loss.
 *
 * The two sides share their row's width evenly, whatever their numbers (owner, 10-27: "the army & enemy numbers must
 * both fit"): each side may shrink below its figures' width, and its figures stand on two lines, so a seven-digit army
 * still fits a 360 px phone at full size. Past that the figures read short (fightFigures), and a line still too long for
 * its side is set smaller until it fits (fittedSize): no figure ever runs out of its side, and none is cut.
 */
export const FightSide = ({
  label,
  mark,
  before,
  kept,
  side,
  tip,
}: {
  label: string;
  mark: ReactNode;
  /** The side's troops now; undefined while they are not known. */
  before: number | undefined;
  kept: Kept;
  side: "ours" | "theirs";
  tip?: string;
}) => {
  const figures = fightFigures(before, kept);
  return (
    <span
      role="img"
      aria-label={[`${label} ${formatExact(before)} → ${formatExact(kept)}`, figures.lost].filter(Boolean).join(", ")}
      data-tip={tip}
      className="flex min-w-0 flex-1 basis-0"
    >
      <HudPanel
        collapsible={false}
        className="min-w-0 flex-1"
        bodyClassName="flex min-w-0 flex-col items-center gap-1 py-2 [container-type:inline-size]"
      >
        <span aria-hidden className="flex max-w-full items-center gap-1.5 tabular-nums">
          {mark}
          <span
            className="whitespace-nowrap text-hud-body text-hud-muted"
            style={{ fontSize: fittedSize("body", `${figures.before} →`, MARK_ROOM) }}
          >
            {figures.before} →
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            "max-w-full whitespace-nowrap text-hud-display leading-none tabular-nums",
            kept === undefined ? "text-hud-muted" : kept === 0 ? "text-hud-bad" : "text-hud-ink",
          )}
          style={{ fontSize: fittedSize("display", figures.kept) }}
        >
          {figures.kept}
        </span>
        <FightBar before={before} kept={kept} side={side} />
        {figures.lost && (
          <span
            aria-hidden
            className={cn(
              "max-w-full whitespace-nowrap text-hud-label tabular-nums",
              side === "ours" ? "text-hud-bad" : "text-hud-gold",
            )}
            style={{ fontSize: fittedSize("label", figures.lost) }}
          >
            {figures.lost}
          </span>
        )}
      </HudPanel>
    </span>
  );
};

/** The width a line's characters take at most, in ems: a bold tabular digit's, with room to spare. */
const CHARACTER_EM = 0.62;
/** What stands beside the troops before on their line: the side's mark and the gap after it. */
const MARK_ROOM = "36px";

/**
 * A figure line's size: its type role's, or smaller where its characters would outrun its side's width (`cqi`, the
 * side's own width, which its body measures as a container).
 */
const fittedSize = (role: "label" | "body" | "display", line: string, beside = "0px"): string =>
  `min(var(--hud-text-${role}), calc((100cqi - ${beside}) / ${line.length * CHARACTER_EM}))`;

/** From eight digits a figure no longer fits half a 360 px phone's card. */
const SHORT_FROM = 10_000_000;

/**
 * A side's figures as it shows them: exact below ten million, short from there as the HUD writes amounts ("12.3M"),
 * unless two different figures would read alike, which reads as a fight that cost nothing: then exact, set smaller to
 * fit. What is not known is a dash.
 * What the fight costs reads in the same figures with its share ("−601 · 76% lost"), and is absent while the side's
 * troops or the fight are not known.
 */
export const fightFigures = (
  before: number | undefined,
  kept: Kept,
): { before: string; kept: string; lost?: string } => {
  const known = [before, kept].filter((value): value is number => value !== undefined);
  const readsAlike = known.some((a) => known.some((b) => a !== b && formatShort(a) === formatShort(b)));
  const format = Math.max(0, ...known) < SHORT_FROM || readsAlike ? formatExact : formatShort;
  const write = (value: number | undefined) => (value === undefined ? formatExact(undefined) : format(value));
  const figures = { before: write(before), kept: write(kept) };
  if (before === undefined || kept === undefined) return figures;
  const lost = Math.max(0, before - kept);
  return { ...figures, lost: lost === 0 ? NONE_LOST : fightLost(format(lost), String(lostShare(before, kept))) };
};

/**
 * What a side loses of its troops, as a whole percent that reads 100 only once none are kept and 0 only when none are
 * lost: a side that keeps one troop of a thousand has lost 99%, one that loses one has lost 1%.
 */
const lostShare = (before: number, kept: number): number => {
  if (before <= 0 || kept >= before) return 0;
  if (kept <= 0) return 100;
  return Math.min(99, Math.max(1, Math.round(((before - kept) / before) * 100)));
};

/** The troops kept in the side's colour, and the troops lost in grey; empty while unknown. */
const FightBar = ({ before, kept, side }: { before: number | undefined; kept: Kept; side: "ours" | "theirs" }) => {
  const share = before && before > 0 && kept !== undefined ? Math.max(0, Math.min(1, kept / before)) : 0;
  return (
    <span aria-hidden className="flex h-2 w-full overflow-hidden rounded-full bg-hud-well">
      {kept !== undefined && (
        <>
          <span
            className={cn("h-full", side === "ours" ? "bg-hud-good" : "bg-hud-bad")}
            style={{ width: `${share * 100}%` }}
          />
          <span className="h-full bg-hud-neutral" style={{ width: `${(1 - share) * 100}%` }} />
        </>
      )}
    </span>
  );
};
