import { Eye } from "@/ui/design-system/atoms/game-icons";
import { getTroopResourceId } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import type { ReactNode } from "react";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount } from "./frontier-format";

const PRECISION = BigInt(RESOURCE_PRECISION);

/** An icon and its number on the chip token: the one way Frontier shows an amount of something. */
export const Chip = ({
  label,
  icon,
  value,
  small = false,
  tone,
  badge,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  /** The dock's card-scale chip. */
  small?: boolean;
  tone?: "gain" | "loss" | "price";
  /** A mark after the number, such as a troop's tier. */
  badge?: ReactNode;
}) => (
  <span
    aria-label={`${label} ${value}`}
    data-tone={tone}
    className={cn("frontier-chip justify-center", small && "frontier-chip-sm")}
  >
    {icon}
    <span className="frontier-chip-number tabular-nums">{value}</span>
    {badge}
  </span>
);

const TIER_NUMERALS = ["", "I", "II", "III"] as const;
const TROOP_TIERS: Record<TroopTier, 1 | 2 | 3> = { [TroopTier.T1]: 1, [TroopTier.T2]: 2, [TroopTier.T3]: 3 };

/** A tier as its banner, I, II or III: a troop's beside its count, a building's under its medallion. */
export const TierBanner = ({ tier, large = false }: { tier: 1 | 2 | 3; large?: boolean }) => (
  <span aria-hidden data-tier={tier} className={cn("frontier-tier", large && "frontier-tier-lg")}>
    {TIER_NUMERALS[tier]}
  </span>
);

/**
 * Troops as every Frontier surface shows them: the troop's icon, how many, and its tier's badge. Strength stays hidden;
 * a higher tier reads as tougher through its badge and its bigger model.
 */
export const TroopChip = ({
  type,
  tier,
  count,
  small = false,
}: {
  type: TroopType;
  tier: TroopTier;
  /** Whole troops; unknown shows as "—". */
  count: number | undefined;
  small?: boolean;
}) => (
  <Chip
    label={`${type} ${tier}`}
    small={small}
    icon={<img src={`/images/resources/${getTroopResourceId(type, tier)}.png`} alt="" />}
    value={formatAmount(count)}
    badge={<TierBanner tier={TROOP_TIERS[tier]} />}
  />
);

/** What each reveal sends home, Essence or labor; a scout's fraction of a unit shows as its eye instead. */
export const YieldChip = ({ scaled, small = false }: { scaled: bigint | undefined; small?: boolean }) => {
  const whole = scaled === undefined ? undefined : scaled / PRECISION;
  const icons =
    whole === 0n ? (
      <Eye />
    ) : (
      <span className="flex items-center justify-center -space-x-1">
        <img src={`/images/resources/${ResourcesIds.Essence}.png`} alt="" className="size-4" />
        <img src={`/images/resources/${ResourcesIds.Labor}.png`} alt="" className="size-4" />
      </span>
    );
  return (
    <Chip
      label="Each reveal"
      small={small}
      icon={icons}
      value={whole === undefined ? "—" : whole === 0n ? "" : formatAmount(Number(whole))}
    />
  );
};
