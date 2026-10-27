import { formatExact, formatShort } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudPanel } from "@/ui/design-system/kit/hud-elements";

import type { ReactNode } from "react";

/**
 * What a side keeps after the fight: one number when it is known, a range when the dice decide it (low to high), and
 * undefined when no forecast is known (the army is out of reach, or the fight cannot be fought yet).
 */
export type Kept = number | { low: number; high: number } | undefined;

/**
 * One side of a fight, as every card that shows a fight draws it, in every state (owner, 10-27: "this panel doesnt
 * match at all our new battle panels"): the attack's card in reach or not, its result, and Blitz's preview. Its mark
 * and troops before, then the troops it keeps, large (red when none are, a dash when not known), and its bar.
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
  const range = keptRange(kept);
  const figures = fightFigures(before, range);
  return (
    <span
      role="img"
      aria-label={`${label} ${formatExact(before)} → ${spokenKept(range)}`}
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
            !range ? "text-hud-muted" : range.high === 0 ? "text-hud-bad" : "text-hud-ink",
          )}
          style={{ fontSize: fittedSize("display", figures.kept) }}
        >
          {figures.kept}
        </span>
        <FightBar before={before} range={range} side={side} />
      </HudPanel>
    </span>
  );
};

type KeptRange = { low: number; high: number } | undefined;

const keptRange = (kept: Kept): KeptRange =>
  kept === undefined ? undefined : typeof kept === "number" ? { low: kept, high: kept } : kept;

/** What a screen reader hears for the troops kept: exact, a range read as one, or the dash of a figure not known. */
const spokenKept = (range: KeptRange): string => {
  if (!range) return formatExact(undefined);
  if (range.low === range.high) return formatExact(range.low);
  return `${formatExact(range.low)} to ${formatExact(range.high)}`;
};

/** The width a line's characters take at most, in ems: a bold tabular digit's, with room to spare. */
const CHARACTER_EM = 0.62;
/** What stands beside the troops before on their line: the side's mark and the gap after it. */
const MARK_ROOM = "36px";

/**
 * A figure line's size: its type role's, or smaller where its characters would outrun its side's width (`cqi`, the
 * side's own width, which its body measures as a container).
 */
const fittedSize = (role: "body" | "display", line: string, beside = "0px"): string =>
  `min(var(--hud-text-${role}), calc((100cqi - ${beside}) / ${(line.length * CHARACTER_EM).toFixed(2)}))`;

/** From eight digits a figure no longer fits half a 360 px phone's card. */
const SHORT_FROM = 10_000_000;

/**
 * A side's figures as it shows them: exact below ten million, short from there as the HUD writes amounts ("12.3M"),
 * unless two different figures would read alike, which reads as a fight that cost nothing: then exact, set smaller to
 * fit. A range reads low to high ("3,900–4,006"), one figure when the dice cannot move it; what is not known is a dash.
 */
export const fightFigures = (before: number | undefined, range: KeptRange): { before: string; kept: string } => {
  const known = [before, range?.low, range?.high].filter((value): value is number => value !== undefined);
  const readsAlike = known.some((a) => known.some((b) => a !== b && formatShort(a) === formatShort(b)));
  const format = Math.max(0, ...known) < SHORT_FROM || readsAlike ? formatExact : formatShort;
  const write = (value: number | undefined) => (value === undefined ? formatExact(undefined) : format(value));
  const [low, high] = [write(range?.low), write(range?.high)];
  return { before: write(before), kept: low === high ? low : `${low}–${high}` };
};

/**
 * A side's troops through a fight as one bar (the owner, 22 October: "Clarity is important"): the part surely kept in
 * the side's colour (the player's green, the enemy's red), the part the dice may keep paler, and the part the fight
 * takes in the HUD's neutral grey. With no forecast the bar is empty: nothing is claimed.
 */
const FightBar = ({
  before,
  range,
  side,
}: {
  before: number | undefined;
  range: KeptRange;
  side: "ours" | "theirs";
}) => {
  const share = (value: number) => (before && before > 0 ? Math.max(0, Math.min(1, value / before)) : 0);
  const sure = range ? share(range.low) : 0;
  const may = range ? share(range.high) - sure : 0;
  const colour = side === "ours" ? "bg-hud-good" : "bg-hud-bad";
  return (
    <span aria-hidden className="flex h-2 w-full overflow-hidden rounded-full bg-hud-well">
      {range && (
        <>
          <span className={cn("h-full", colour)} style={{ width: `${sure * 100}%` }} />
          {may > 0 && <span className={cn("h-full opacity-50", colour)} style={{ width: `${may * 100}%` }} />}
          <span className="h-full bg-hud-neutral" style={{ width: `${(1 - sure - may) * 100}%` }} />
        </>
      )}
    </span>
  );
};
