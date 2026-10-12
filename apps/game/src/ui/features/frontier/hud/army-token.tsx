import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { Chip, FullIn } from "@/ui/design-system/kit/chip";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { ATTRIBUTES, RETURNED, STAMINA, TIER_WORDS, TROOPS, XP, xpToward } from "@/ui/design-system/kit/words";

import { CardFanGlyph } from "../glyphs";
import { guideTarget } from "../guide/guide-thread";

/** A token's stamina bar: five segments of the army's own maximum, so a full bar reads full whatever its Logistics. */
const SEGMENTS = 5;

const TOKEN = "relative flex h-[72px] w-14 shrink-0 flex-col items-center justify-center gap-[3px] rounded-xl";
const CARD = "relative flex w-full shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2";

/** What XP buys next: the attribute tier's XP price and the tier it reaches, 2 (uncommon) to 5 (legendary). */
type XpGoal = { price: number; tier: number };

/**
 * An army's XP in words, for its tooltip: what it holds against the attribute tier it buys next. XP is a balance the
 * army spends; there is no level, so with every attribute at legendary it says the balance alone.
 */
export const xpLine = (xp: number | undefined, goal: XpGoal | undefined): string =>
  goal ? xpToward(formatAmount(xp), formatAmount(goal.price), TIER_WORDS[goal.tier - 1]) : `${XP} ${formatAmount(xp)}`;

/**
 * One army on the dock: its portrait with its XP balance as the badge, a card fan when a tier is affordable now, its
 * stamina in segments, and its troops; the badge says what the XP buys next when asked. Desktop's wide card writes
 * "XP" beside the number over a thin bar toward that tier, marks each attribute tier the army has reached with a pip,
 * and adds what a phone shows only for the selected army: when the bar is full, and the troops its Homecoming sends
 * home. Read-only on a visit.
 */
export const ArmyToken = ({
  label,
  art,
  xp,
  xpGoal,
  tiers,
  stamina,
  troops,
  canBuyTier,
  selected,
  flyTarget,
  guided = false,
  wide,
  onPick,
}: {
  label: string;
  art: string | undefined;
  xp: number | undefined;
  /** The attribute tier the XP buys next; none once every attribute is legendary, or while unknown. */
  xpGoal?: XpGoal;
  /** The army's four attribute tiers, 1 to 5; unknown is undefined. */
  tiers?: readonly [number, number, number, number];
  stamina: { current: number; max: number } | undefined;
  troops: number | undefined;
  canBuyTier: boolean;
  selected: boolean;
  /** Where a gain flies into the portrait. */
  flyTarget?: string;
  /** The dock's first army: the guide's lines about XP and stamina point at its badge and its bar. */
  guided?: boolean;
  /** Desktop's full card: the bar's Full in and the troops Homecoming returns (unknown is a dash). */
  wide?: { secondsToFull: number | undefined; returnsHome: number | undefined };
  /** Absent on a visit: the token is shown, never picked. */
  onPick?: () => void;
}) => {
  const body = (
    <>
      <span data-fly-target={flyTarget} className="relative size-10 shrink-0">
        <span className="block size-full overflow-hidden rounded-full border border-kit-line2 bg-kit-ground">
          {art && <img src={art} alt="" className="size-full object-cover" />}
        </span>
        {!wide && (
          <span
            role="img"
            aria-label={`${XP} ${formatAmount(xp)}`}
            data-tip={xpLine(xp, xpGoal)}
            {...(guided ? guideTarget("army-xp") : {})}
            className="absolute -bottom-1 -right-2.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-kit-line2 bg-kit-ink px-1 text-[12px] leading-none text-kit-gold2 tabular-nums"
          >
            {formatAmount(xp)}
          </span>
        )}
        {canBuyTier && (
          <span className="absolute -right-2 -top-1.5 size-[18px]">
            <CardFanGlyph className="size-full" />
          </span>
        )}
      </span>
      <StaminaSegments stamina={stamina} guided={guided} />
      <span
        role="img"
        aria-label={`${TROOPS} ${formatAmount(troops)}`}
        className="text-[14px] leading-none text-kit-cream tabular-nums"
      >
        {formatAmount(troops)}
      </span>
      {wide && <XpRow xp={xp} goal={xpGoal} tiers={tiers} guided={guided} />}
      {wide && <WideRows {...wide} />}
    </>
  );
  const look = cn(
    wide ? CARD : TOKEN,
    "border bg-kit-ground",
    selected ? "border-[3px] border-kit-hot" : "border-kit-line",
  );
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
 * An open army slot: a plus in a dashed ring that opens Deploy; the first one pulses while no army is out, and is where
 * the guide's Deploy line points.
 */
export const OpenSlot = ({
  label,
  pulse,
  guided = false,
  wide = false,
  onDeploy,
}: {
  label: string;
  pulse: boolean;
  guided?: boolean;
  /** Desktop's full card: the plus with Deploy beside it. */
  wide?: boolean;
  onDeploy: () => void;
}) => (
  <button
    type="button"
    aria-label={label}
    {...(guided ? guideTarget("open-slot") : {})}
    onClick={onDeploy}
    className={cn(wide ? cn(CARD, "!flex-row justify-center") : TOKEN, "border border-kit-line bg-kit-ground")}
  >
    <span
      className={cn(
        "flex size-10 items-center justify-center rounded-full border-2 border-dashed border-kit-line2 text-[18px] text-kit-gold",
        pulse && "animate-pulse border-kit-hot",
      )}
    >
      +
    </span>
    {wide && <span className="text-[14px] font-semibold text-kit-cream">{label}</span>}
  </button>
);

const StaminaSegments = ({
  stamina,
  guided,
}: {
  stamina: { current: number; max: number } | undefined;
  guided: boolean;
}) => {
  const filled = stamina && stamina.max > 0 ? (SEGMENTS * stamina.current) / stamina.max : 0;
  return (
    <span
      role="meter"
      aria-label={STAMINA}
      aria-valuenow={stamina?.current}
      aria-valuemax={stamina?.max}
      {...(guided ? guideTarget("army-stamina") : {})}
      className="flex w-full gap-0.5 px-1.5"
    >
      {Array.from({ length: SEGMENTS }, (_, index) => (
        <i key={index} className="h-[5px] flex-1 overflow-hidden rounded-sm bg-kit-line">
          <b
            className="block h-full bg-kit-sage"
            style={{ width: `${Math.min(1, Math.max(0, filled - index)) * 100}%` }}
          />
        </i>
      ))}
    </span>
  );
};

const ATTRIBUTE_MARKS: readonly IconCode[] = ["Ba", "Lg", "Sc", "Su"];

/**
 * The wide card's XP: the balance with its word, a thin bar toward the attribute tier it buys next, and a pip for every
 * tier above common the army has reached, under its attribute's mark. An army with nothing bought shows no pip.
 */
const XpRow = ({
  xp,
  goal,
  tiers,
  guided,
}: {
  xp: number | undefined;
  goal: XpGoal | undefined;
  tiers: readonly [number, number, number, number] | undefined;
  guided: boolean;
}) => (
  <span className="flex w-full items-center gap-1.5 px-1.5">
    <span
      data-tip={xpLine(xp, goal)}
      {...(guided ? guideTarget("army-xp") : {})}
      className="flex min-w-0 flex-1 items-center gap-1.5"
    >
      <span className="whitespace-nowrap text-[13px] leading-none tabular-nums text-kit-gold2">
        {formatAmount(xp)} <span className="text-[11px] font-semibold text-kit-cream">{XP}</span>
      </span>
      {goal && (
        <i aria-hidden className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-sm bg-kit-line">
          <b
            className="block h-full bg-kit-gold2"
            style={{ width: `${Math.min(1, Math.max(0, (xp ?? 0) / goal.price)) * 100}%` }}
          />
        </i>
      )}
    </span>
    {tiers?.map((tier, index) =>
      tier > 1 ? (
        <span
          key={ATTRIBUTES[index]}
          role="img"
          aria-label={`${ATTRIBUTES[index]} ${TIER_WORDS[tier - 1]}`}
          className="flex shrink-0 items-center gap-px"
        >
          <KitIcon code={ATTRIBUTE_MARKS[index]} size={14} />
          {Array.from({ length: tier - 1 }, (_, pip) => (
            <i key={pip} className="size-[5px] rounded-full bg-kit-gold" />
          ))}
        </span>
      ) : null,
    )}
  </span>
);

/** The wide card's rows: when the bar is full, and the troops Homecoming sends home when the day ends. */
const WideRows = ({
  secondsToFull,
  returnsHome,
}: {
  secondsToFull: number | undefined;
  returnsHome: number | undefined;
}) => (
  <span className="flex w-full flex-wrap items-center justify-center gap-1">
    {secondsToFull !== undefined && secondsToFull > 0 && <FullIn seconds={secondsToFull} />}
    <Chip icons={["Su", "Tr"]} label={RETURNED} value={`+${formatAmount(returnsHome)}`} />
  </span>
);
