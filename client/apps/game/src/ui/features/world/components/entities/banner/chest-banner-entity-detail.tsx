import { memo } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ID } from "@bibliothecadao/types";

import { EntityDetailLayoutVariant, EntityDetailSection } from "../layout";
import { useChestEntityDetail } from "../hooks/use-chest-entity-detail";

export interface ChestBannerEntityDetailProps {
  chestEntityId: ID;
  className?: string;
  compact?: boolean;
  layoutVariant?: EntityDetailLayoutVariant;
}

const infoBlocks = [
  {
    title: "Unexpected finds",
    description: "Relic chests appear randomly—keep scouting to spot them early.",
  },
  {
    title: "Treasure inside",
    description: "Each chest stores valuable relics for your realm.",
  },
  {
    title: "Secure the tile",
    description: "Move an army adjacent to claim the rewards.",
  },
];

interface ChestBannerEntityDetailContentProps extends Omit<ChestBannerEntityDetailProps, "layoutVariant"> {
  variant: EntityDetailLayoutVariant;
}

const ChestBannerEntityDetailContent = ({
  chestEntityId,
  className,
  compact = true,
  variant,
}: ChestBannerEntityDetailContentProps) => {
  const { chestName } = useChestEntityDetail({ chestEntityId });
  const isBanner = variant === "banner";
  const isCompactLayout = compact;

  const containerClass = cn(
    "flex flex-col",
    isCompactLayout ? "gap-1.5" : "gap-3",
    className,
  );

  const bodyClass = cn("text-gold/70", isCompactLayout ? "text-xxs" : "text-xs");

  return (
    <div className={containerClass}>
      <EntityDetailSection compact={compact}>
        <div className="text-sm font-semibold text-gold">{chestName ?? "Relic Chest"}</div>
        <div className={cn(bodyClass, "mb-2 text-gold/60")}>Crate #{chestEntityId}</div>
        {isBanner ? (
          <div className="flex flex-wrap items-center gap-2 text-xxs text-gold/60">
            <span>Scout to discover.</span>
            <span>Contains relics.</span>
            <span>Open via adjacent army.</span>
          </div>
        ) : (
          <ul className="grid flex-1 grid-cols-1 gap-2 text-xs text-gold/80 sm:grid-cols-3">
            {infoBlocks.map((block) => (
              <li key={block.title} className="rounded-lg border border-gold/25 bg-dark-brown/70 px-3 py-2 shadow-md">
                <span className="block font-semibold text-gold">{block.title}</span>
                <span className="text-gold/70 text-xs">{block.description}</span>
              </li>
            ))}
          </ul>
        )}
      </EntityDetailSection>
    </div>
  );
};

export const ChestBannerEntityDetail = memo(
  ({ chestEntityId, className, compact = true, layoutVariant }: ChestBannerEntityDetailProps) => {
    const resolvedVariant: EntityDetailLayoutVariant = layoutVariant ?? (compact ? "default" : "banner");

    return (
      <ChestBannerEntityDetailContent
        chestEntityId={chestEntityId}
        className={className}
        compact={compact}
        variant={resolvedVariant}
      />
    );
  },
);

ChestBannerEntityDetail.displayName = "ChestBannerEntityDetail";
