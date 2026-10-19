import { formatAmount } from "@bibliothecadao/types";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { STAMINA, TIER_WORDS, TROOPS, XP, xpToward } from "@/ui/design-system/kit/words";
import { STAMINA_SEGMENTS, staminaFill } from "@/lib/army-stamina/segments";

const TOKEN = "relative flex h-hud-frontier-token w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-xl";
const CARD = "relative flex w-full shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2";

/** What XP buys next: the attribute tier's XP price and the tier it reaches, 2 (uncommon) to 5 (legendary). */
export type XpGoal = { price: number; tier: number };

/**
 * An army's XP in words, for its tooltip: what it holds against the attribute tier it buys next. XP is a balance the
 * army spends; there is no level, so with every attribute at legendary it says the balance alone.
 */
export const xpLine = (xp: number | undefined, goal: XpGoal | undefined): string =>
  goal ? xpToward(formatAmount(xp), formatAmount(goal.price), TIER_WORDS[goal.tier - 1]) : `${XP} ${formatAmount(xp)}`;

/**
 * One army on a phone's dock: its number, the one its map plate carries; its portrait with its XP balance as the badge,
 * a card fan when a tier is affordable now, its stamina in segments, and its troops; the badge says what the XP buys
 * next when asked. A desktop lists the armies as rows (ArmyRow). Read-only on a visit.
 */
export const ArmyToken = ({
  label,
  number,
  art,
  xp,
  xpGoal,
  stamina,
  troops,
  canBuyTier,
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
  stamina: { current: number; max: number } | undefined;
  troops: number | undefined;
  canBuyTier: boolean;
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
        {canBuyTier && (
          <span className="absolute -right-2 -top-1.5 size-5">
            <SemanticIcon name="picks" className="size-full" />
          </span>
        )}
      </span>
      <StaminaSegments stamina={stamina} />
      <span
        role="img"
        aria-label={`${TROOPS} ${formatAmount(troops)}`}
        className="text-hud-body leading-none text-hud-ink tabular-nums"
      >
        {formatAmount(troops)}
      </span>
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
 * An open army slot: a plus in a dashed ring that opens Deploy; the first one pulses while no army is out.
 */
export const OpenSlot = ({
  label,
  pulse,
  filling,
  wide = false,
  onDeploy,
}: {
  label: string;
  pulse: boolean;
  /** An army is on its way into this slot, by the word that says so: the slot cannot be pressed until it is known. */
  filling?: string;
  /** Desktop's full card: the plus with Deploy beside it. */
  wide?: boolean;
  onDeploy: () => void;
}) => (
  <button
    type="button"
    aria-label={filling ?? label}
    aria-busy={filling !== undefined}
    disabled={filling !== undefined}
    onClick={onDeploy}
    className={cn(wide ? cn(CARD, "!flex-row justify-center") : TOKEN, "border border-hud-line bg-hud-surface")}
  >
    <span
      className={cn(
        "flex size-10 items-center justify-center rounded-full border-2 border-dashed border-hud-line text-hud-title text-hud-ink",
        (pulse || filling !== undefined) && "animate-pulse border-hud-line-strong",
      )}
    >
      {filling === undefined ? "+" : "…"}
    </span>
    {wide && <span className="text-hud-strong text-hud-ink">{filling ?? label}</span>}
  </button>
);

const StaminaSegments = ({ stamina }: { stamina: { current: number; max: number } | undefined }) => {
  const filled = STAMINA_SEGMENTS * (staminaFill(stamina) ?? 0);
  return (
    <span
      role="meter"
      aria-label={STAMINA}
      aria-valuenow={stamina?.current}
      aria-valuemax={stamina?.max}
      className="flex w-full gap-0.5 px-1.5"
    >
      {Array.from({ length: STAMINA_SEGMENTS }, (_, index) => (
        <i key={index} className="h-1 flex-1 overflow-hidden rounded-sm bg-hud-divider">
          <b
            className="block h-full bg-hud-good"
            style={{ width: `${Math.min(1, Math.max(0, filled - index)) * 100}%` }}
          />
        </i>
      ))}
    </span>
  );
};
