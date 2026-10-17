import { cn } from "@/ui/design-system/atoms/lib/utils";
import { getTierStyle } from "@/ui/utils/tier-styles";

const SIZES = {
  xs: "px-1 py-0.5 text-[10px]",
  sm: "px-1.5 py-0.5 text-[11px]",
  md: "px-2 py-1 text-xs",
  lg: "px-2.5 py-1 text-sm",
  /** On a map plate, where every word reads at 14 px or more. */
  label: "px-1.5 py-px text-sm leading-tight",
} as const;

/**
 * A troop tier on its chip ("T1" blue, "T2" green, "T3" purple): the one tier chip of the army tile, the guard slots and
 * the map's plates.
 */
export const TroopTierChip = ({ tier, size = "sm" }: { tier: string; size?: keyof typeof SIZES }) => (
  <span className={cn("relative rounded border font-bold", SIZES[size], getTierStyle(tier))}>
    <span className="relative z-10">{tier}</span>
  </span>
);
