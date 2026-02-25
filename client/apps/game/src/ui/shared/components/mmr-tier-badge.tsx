import type { MMRTier } from "@/ui/utils/mmr-tiers";

type BadgeSize = "sm" | "md";

interface MMRTierBadgeProps {
  tier: MMRTier;
  size?: BadgeSize;
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
};

export const MMRTierBadge = ({ tier, size = "sm" }: MMRTierBadgeProps) => {
  return (
    <span className={`inline-flex items-center rounded-md font-semibold ${tier.color} bg-white/[0.06] ${sizeClasses[size]}`}>
      {tier.name}
    </span>
  );
};
