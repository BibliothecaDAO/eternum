import { Loader } from "lucide-react";
import { memo, useMemo } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HexPosition, ID, RelicRecipientType } from "@bibliothecadao/types";

import { CompactArmyChip } from "@/ui/features/military/components/compact-army-chip";
import clsx from "clsx";
import { ArmyWarning } from "../../armies/army-warning";
import { ActiveRelicEffects } from "../active-relic-effects";
import { CompactEntityInventory } from "../compact-entity-inventory";
import { useArmyEntityDetail, useBannerArmyInfo } from "../hooks/use-army-entity-detail";
import { EntityDetailLayoutVariant, EntityDetailSection } from "../layout";

export interface ArmyBannerEntityDetailProps {
  armyEntityId: ID;
  className?: string;
  compact?: boolean;
  maxInventory?: number;
  showButtons?: boolean;
  bannerPosition?: HexPosition;
  layoutVariant?: EntityDetailLayoutVariant;
}

interface ArmyBannerEntityDetailContentProps extends Omit<ArmyBannerEntityDetailProps, "layoutVariant"> {
  variant: EntityDetailLayoutVariant;
}

const ArmyBannerEntityDetailContent = memo(
  ({ armyEntityId, className, bannerPosition, compact = true, variant }: ArmyBannerEntityDetailContentProps) => {
    const {
      explorer,
      explorerResources,
      structureResources,
      relicEffects,
      derivedData,
      isLoadingExplorer,
      isLoadingStructure,
    } = useArmyEntityDetail({ armyEntityId });
    const isBanner = variant === "banner";
    const isCompactLayout = compact;

    const bannerArmyInfo = useBannerArmyInfo(explorer, derivedData, armyEntityId, bannerPosition);
    const activeRelicIds = useMemo(() => relicEffects.map((effect) => Number(effect.id)), [relicEffects]);

    if (isLoadingExplorer || (explorer?.owner && isLoadingStructure)) {
      return (
        <div className="mt-2 flex h-full items-center justify-center">
          <Loader className="animate-spin" />
        </div>
      );
    }

    if (!explorer || !derivedData) return null;

    const containerClass = cn(
      "flex h-full min-h-0 flex-col overflow-auto",
      isCompactLayout ? "gap-1.5" : "gap-2",
      className,
    );

    const wantsGridLayout = true;
    const gridContainerClass = wantsGridLayout
      ? "grid flex-1 min-h-0 w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:grid-rows-2 sm:auto-rows-fr"
      : "flex min-h-0 flex-1 flex-col gap-2";
    const cellBaseClass = wantsGridLayout ? "sm:col-span-1 sm:row-span-1" : undefined;
    const subtleTextClass = clsx("text-gold/60", isCompactLayout ? "text-xxs" : "text-xs");
    const hasWarnings = Boolean(structureResources && explorerResources);

    return (
      <div className={containerClass}>
        <div className={gridContainerClass}>
          <EntityDetailSection
            compact={compact}
            className={cn(cellBaseClass, wantsGridLayout && "sm:col-start-1 sm:row-start-1", "min-h-0")}
            tone={hasWarnings ? "highlight" : "default"}
          >
            {hasWarnings && explorerResources && structureResources ? (
              <ArmyWarning
                army={explorer}
                explorerResources={explorerResources}
                structureResources={structureResources}
              />
            ) : (
              <span className={cn(subtleTextClass, "italic")}>No proximity warnings.</span>
            )}
          </EntityDetailSection>

          <EntityDetailSection
            compact={compact}
            className={cn(cellBaseClass, wantsGridLayout && "sm:col-start-2 sm:row-start-1", "min-h-0")}
          >
            {bannerArmyInfo ? (
              <CompactArmyChip army={bannerArmyInfo} className="border border-gold/25 bg-dark/60" />
            ) : (
              <span className={cn(subtleTextClass, "italic")}>Army data unavailable.</span>
            )}
          </EntityDetailSection>

          <EntityDetailSection
            compact={compact}
            className={cn(
              cellBaseClass,
              "min-h-0 flex flex-col overflow-auto",
              wantsGridLayout && "sm:col-start-1 sm:row-start-2",
            )}
          >
            {explorerResources ? (
              <CompactEntityInventory
                resources={explorerResources}
                activeRelicIds={activeRelicIds}
                recipientType={RelicRecipientType.Explorer}
                variant={isBanner ? "tight" : "default"}
              />
            ) : (
              <span className={cn(subtleTextClass, "italic")}>No supplies carried.</span>
            )}
          </EntityDetailSection>

          <EntityDetailSection
            compact={compact}
            className={cn(cellBaseClass, wantsGridLayout && "sm:col-start-2 sm:row-start-2", "min-h-0")}
          >
            {isBanner ? (
              <span className={cn(subtleTextClass, "italic")}>
                {relicEffects.length > 0
                  ? `${relicEffects.length} active relic${relicEffects.length > 1 ? "s" : ""}.`
                  : "No relics assigned."}
              </span>
            ) : relicEffects.length > 0 ? (
              <div className="max-h-[200px] overflow-auto pr-1">
                <ActiveRelicEffects
                  relicEffects={relicEffects}
                  entityId={armyEntityId}
                  compact={isCompactLayout}
                />
              </div>
            ) : (
              <span className={cn(subtleTextClass, "italic")}>No relics assigned.</span>
            )}
          </EntityDetailSection>
        </div>
      </div>
    );
  },
);
ArmyBannerEntityDetailContent.displayName = "ArmyBannerEntityDetailContent";

export const ArmyBannerEntityDetail = memo(
  ({
    armyEntityId,
    className,
    compact = true,
    showButtons = false,
    bannerPosition,
    layoutVariant,
  }: ArmyBannerEntityDetailProps) => {
    const resolvedVariant: EntityDetailLayoutVariant = layoutVariant ?? (compact ? "default" : "banner");

    return (
      <ArmyBannerEntityDetailContent
        armyEntityId={armyEntityId}
        className={className}
        compact={compact}
        showButtons={showButtons}
        bannerPosition={bannerPosition}
        variant={resolvedVariant}
      />
    );
  },
);

ArmyBannerEntityDetail.displayName = "ArmyBannerEntityDetail";
