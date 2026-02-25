import type { MMRTier } from "@/ui/utils/mmr-tiers";

type BadgeSize = "sm" | "md";

interface MMRTierBadgeProps {
  tier: MMRTier;
  size?: BadgeSize;
}

const sizeConfig: Record<BadgeSize, { container: string; icon: string }> = {
  sm: {
    container: "gap-1 px-2 py-0.5 text-xs",
    icon: "h-4 w-4",
  },
  md: {
    container: "gap-1.5 px-2.5 py-1 text-sm",
    icon: "h-5 w-5",
  },
};

const TIER_RESOURCE_ICON_IDS: Record<string, number> = {
  Iron: 1, // Stone
  Bronze: 25, // Donkey (requested override)
  Silver: 8, // Silver
  Gold: 7, // Gold
  Platinum: 19, // Adamantine
  Diamond: 14, // Diamonds
  Master: 13, // Ruby
  Elite: 17, // Twilight Quartz
};

export const MMRTierBadge = ({ tier, size = "sm" }: MMRTierBadgeProps) => {
  const config = sizeConfig[size];
  const resourceId = TIER_RESOURCE_ICON_IDS[tier.name];

  return (
    <span
      className={`inline-flex items-center rounded-md font-semibold ${tier.color} bg-white/[0.06] ${config.container}`}
      title={tier.name}
    >
      {resourceId ? (
        <img
          src={`/images/resources/${resourceId}.png`}
          alt={`${tier.name} tier icon`}
          className={`${config.icon} shrink-0 object-contain`}
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <span>{tier.name}</span>
    </span>
  );
};
