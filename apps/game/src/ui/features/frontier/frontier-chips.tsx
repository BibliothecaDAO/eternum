import type { ReactNode } from "react";
import { cn } from "@/ui/design-system/atoms/lib/utils";

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
  tone?: "gain" | "loss" | "lit" | "price";
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

const TIER_NUMERALS = ["", "I", "II", "III", "IV", "V"] as const;

/** A tier as its banner, I to V: a troop's beside its count, a building's or the castle's under its art. */
export const TierBanner = ({ tier, large = false }: { tier: 1 | 2 | 3 | 4 | 5; large?: boolean }) => (
  <span aria-hidden data-tier={Math.min(tier, 3)} className={cn("frontier-tier", large && "frontier-tier-lg")}>
    {TIER_NUMERALS[tier]}
  </span>
);
