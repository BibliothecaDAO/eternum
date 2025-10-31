import { Loader } from "lucide-react";
import { memo } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ArmyChip } from "@/ui/features/military/components/army-chip";
import { HexPosition, ID } from "@bibliothecadao/types";
import { ArmyWarning } from "../../armies/army-warning";
import { ActiveRelicEffects } from "../active-relic-effects";

import { useArmyEntityDetail, useBannerArmyInfo } from "../hooks/use-army-entity-detail";

export interface ArmyBannerEntityDetailProps {
  armyEntityId: ID;
  className?: string;
  compact?: boolean;
  maxInventory?: number;
  showButtons?: boolean;
  bannerPosition?: HexPosition;
}

export const ArmyBannerEntityDetail = memo(
  ({
    armyEntityId,
    className,
    compact = true,
    maxInventory = Infinity,
    showButtons = false,
    bannerPosition,
  }: ArmyBannerEntityDetailProps) => {
    const {
      explorer,
      explorerResources,
      structureResources,
      relicEffects,
      derivedData,
      isLoadingExplorer,
      isLoadingStructure,
    } = useArmyEntityDetail({ armyEntityId });

    const bannerArmyInfo = useBannerArmyInfo(explorer, derivedData, armyEntityId, bannerPosition);

    if (isLoadingExplorer || (explorer?.owner && isLoadingStructure)) {
      return (
        <div className="mt-2 flex h-full items-center justify-center">
          <Loader className="animate-spin" />
        </div>
      );
    }

    if (!explorer || !derivedData) return null;

    const smallTextClass = compact ? "text-xxs" : "text-xs";
    const sectionTitleClass = `${smallTextClass} font-semibold uppercase tracking-[0.2em] text-gold/80`;

    return (
      <div className={cn("flex h-full min-h-0 flex-col gap-2 overflow-hidden", className)}>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden xl:flex-row">
          <div className="flex flex-shrink-0 flex-col gap-2 xl:max-w-sm">
            {structureResources && explorerResources && (
              <div className="rounded-lg border border-gold/20 bg-dark/60 px-3 py-2">
                <ArmyWarning
                  army={explorer}
                  explorerResources={explorerResources}
                  structureResources={structureResources}
                />
              </div>
            )}
            {bannerArmyInfo && (
              <ArmyChip
                army={bannerArmyInfo}
                className="border border-gold/25 bg-dark/60"
                showButtons={showButtons && derivedData.isMine}
              />
            )}
          </div>

          {relicEffects.length > 0 && (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
              <div className="rounded-lg border border-gold/20 bg-dark-brown/70 px-3 py-2 shadow-md">
                <div className={`${sectionTitleClass} mb-2`}>Active Relic Effects</div>
                <div className="max-h-[200px] overflow-auto pr-1">
                  <ActiveRelicEffects relicEffects={relicEffects} entityId={armyEntityId} compact={compact} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

ArmyBannerEntityDetail.displayName = "ArmyBannerEntityDetail";
