import { formatAmount, formatCharge, formatExact, formatGain } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { HudStamina, type StaminaBar } from "@/ui/design-system/kit/hud-elements";
import { comesHomeAtDayEnd, TIER_WORDS, TROOPS, XP, xpTowardTip } from "@/ui/design-system/kit/words";

// A token grows past its height only for the last hour's Homecoming line. Its parts stack from the top, so every
// token's portrait or ring, and the stamina bar under it, stand at one height along the dock.
const TOKEN =
  "relative flex min-h-hud-frontier-token w-14 shrink-0 flex-col items-center justify-start gap-1 rounded-xl py-1";

/** The next cumulative XP milestone and the point it awards. */
export type XpGoal = { at: number; rank: number };

export const xpLine = (xp: number | undefined, goal: XpGoal | undefined): string =>
  goal ? xpTowardTip(formatAmount(xp), formatCharge(goal.at), TIER_WORDS[goal.rank - 1]) : `${XP} ${formatAmount(xp)}`;

/**
 * One army on a phone's dock: its number, the one its map plate carries; its portrait with its XP balance as the badge,
 * a card fan when a tier is affordable now, what its Homecoming sends home in the day's last hour, its stamina in
 * segments, and its troops; the badge says what the XP buys next when asked. A desktop lists the armies as rows
 * (ArmyRow). Read-only on a visit.
 */
export const ArmyToken = ({
  label,
  number,
  art,
  xp,
  xpGoal,
  stamina,
  troops,
  returnsHome,
  canSpendSkillPoint,
  selected,
  flyTarget,
  onPick,
}: {
  label: string;
  /** The army's number among its realm's; absent where a token stands for no numbered army. */
  number?: number;
  art: IconMeaning | undefined;
  xp: number | undefined;
  /** The attribute tier the XP buys next; none once every attribute is legendary, or while unknown. */
  xpGoal?: XpGoal;
  stamina: StaminaBar | undefined;
  troops: number | undefined;
  /** In the day's last hour, the troops its Homecoming sends home when the day ends; none otherwise. */
  returnsHome?: number;
  canSpendSkillPoint: boolean;
  selected: boolean;
  /** Where a gain flies into the portrait. */
  flyTarget?: string;
  /** Absent on a visit: the token is shown, never picked. */
  onPick?: () => void;
}) => {
  const body = (
    <>
      <span data-fly-target={flyTarget} className="relative size-10 shrink-0">
        <span className="block size-full overflow-hidden rounded-full border border-hud-line bg-hud-surface">
          {art && <SemanticIcon name={art} alt="" className="size-full object-cover" />}
        </span>
        <span
          role="img"
          aria-label={`${XP} ${formatAmount(xp)}`}
          data-tip={xpLine(xp, xpGoal)}
          className="absolute -bottom-1 -right-2.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-hud-line bg-hud-dark px-1 text-hud-body leading-none text-hud-gold tabular-nums"
        >
          {formatAmount(xp)}
        </span>
        {number !== undefined && (
          <span className="absolute -left-2.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-hud-line-strong bg-hud-dark px-1 text-hud-strong leading-none text-hud-ink tabular-nums">
            {number}
          </span>
        )}
        {canSpendSkillPoint && (
          <span className="absolute -right-2 -top-1.5 size-5">
            <SemanticIcon name="picks" className="size-full" />
          </span>
        )}
      </span>
      <TokenStamina stamina={stamina} />
      <span
        role="img"
        aria-label={`${TROOPS} ${formatAmount(troops)}`}
        className="text-hud-body leading-none text-hud-ink tabular-nums"
      >
        {formatAmount(troops)}
      </span>
      {returnsHome !== undefined && <HomecomingReturn troops={returnsHome} />}
    </>
  );
  const look = cn(TOKEN, "border bg-hud-surface", selected ? "border-2 border-hud-line-strong" : "border-hud-line");
  return onPick ? (
    <button type="button" aria-label={label} aria-pressed={selected} onClick={onPick} className={look}>
      {body}
    </button>
  ) : (
    <div role="group" aria-label={label} className={look}>
      {body}
    </div>
  );
};

/**
 * An open army slot: a plus in a dashed ring that opens Deploy, and under it the stamina the slot starts its army on,
 * in the same segments an army's token carries, said in words when asked. The first one pulses while no army is out.
 */
export const OpenSlot = ({
  label,
  pulse,
  filling,
  start,
  onDeploy,
}: {
  label: string;
  pulse: boolean;
  /** An army is on its way into this slot, by the word that says so: the slot cannot be pressed until it is known. */
  filling?: string;
  /** The bar the slot starts its army on, and that in words ("Army 2 starts on 7/150 stamina…"); none while unknown. */
  start?: { bar: StaminaBar; words: string };
  onDeploy: () => void;
}) => (
  <button
    type="button"
    aria-label={filling ?? label}
    aria-busy={filling !== undefined}
    disabled={filling !== undefined}
    data-tip={filling === undefined ? start?.words : undefined}
    onClick={onDeploy}
    className={cn(TOKEN, "border border-hud-line bg-hud-surface")}
  >
    <SlotRing pulse={pulse} filling={filling} />
    {start && filling === undefined && <TokenStamina stamina={start.bar} />}
  </button>
);

/** An open slot's dashed ring: a plus, "…" while an army is on its way into it. */
export const SlotRing = ({ pulse, filling }: { pulse: boolean; filling?: string }) => (
  <span
    className={cn(
      "flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-hud-line text-hud-title",
      "text-hud-ink",
      (pulse || filling !== undefined) && "animate-pulse border-hud-line-strong",
    )}
  >
    {filling === undefined ? "+" : "…"}
  </span>
);

/**
 * In the day's last hour, what an army's Homecoming sends home when the day ends, on its own token (under its troops)
 * or row (beside its XP): by the army it is about, not a bubble repeating the troops (player, 25 October).
 */
export const HomecomingReturn = ({ troops }: { troops: number }) => (
  <span
    role="img"
    aria-label={comesHomeAtDayEnd(formatExact(troops))}
    data-tip={comesHomeAtDayEnd(formatExact(troops))}
    className="flex h-5 shrink-0 items-center rounded-full border border-hud-line bg-hud-dark pr-1 text-hud-label leading-none text-hud-good tabular-nums"
  >
    <SemanticIcon name="order-enlightenment" size={16} />
    {formatGain(troops)}
  </span>
);

/**
 * A desktop row's stamina: the bar in segments, and its exact count beside it ("58/120") in a column wide enough for
 * "150/150", so a full bar and an emptier one end their bars at the same place.
 */
export const StaminaReading = ({ stamina }: { stamina: StaminaBar | undefined }) => (
  <span className="flex flex-1 items-center gap-2">
    <span className="min-w-8 flex-1">
      <HudStamina stamina={stamina} />
    </span>
    <span className="min-w-14 text-right">{`${formatAmount(stamina?.current)}/${formatAmount(stamina?.max)}`}</span>
  </span>
);

/** A token's stamina: the kit's bar, inset from the token's edge. */
const TokenStamina = ({ stamina }: { stamina: StaminaBar | undefined }) => (
  <span className="w-full px-1.5">
    <HudStamina stamina={stamina} />
  </span>
);
