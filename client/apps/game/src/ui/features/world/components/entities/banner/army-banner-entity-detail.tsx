import { Loader } from "lucide-react";
import { memo, useMemo } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { CompactArmyChip } from "@/ui/features/military/components/compact-army-chip";
import { ArmyWarning } from "../../armies/army-warning";
import { CompactEntityInventory } from "../compact-entity-inventory";
import { useArmyEntityDetail, useBannerArmyInfo } from "../hooks/use-army-entity-detail";
import { EntityDetailLayoutVariant, EntityDetailSection } from "../layout";
import { HexPosition, ID, RelicRecipientType, EntityType } from "@bibliothecadao/types";

export interface ArmyBannerEntityDetailProps {
  armyEntityId: ID;
  className?: string;
  compact?: boolean;
  showButtons?: boolean;
  bannerPosition?: HexPosition;
  layoutVariant?: EntityDetailLayoutVariant;
}

interface ArmyBannerEntityDetailContentProps extends Omit<ArmyBannerEntityDetailProps, "layoutVariant"> {
  variant: EntityDetailLayoutVariant;
}

const ArmyBannerEntityDetailContent = memo(
  ({ armyEntityId, className, compact = true, showButtons: _showButtons = false, variant: _variant }: ArmyBannerEntityDetailContentProps) => {
    const {
      explorer,
      explorerResources,
      structureResources,
      relicEffects,
      derivedData,
      isLoadingExplorer,
      isLoadingStructure,
    } = useArmyEntityDetail({ armyEntityId });
    const bannerArmyInfo = useBannerArmyInfo(explorer, derivedData, armyEntityId);
    const activeRelicIds = useMemo(() => relicEffects.map((effect) => Number(effect.id)), [relicEffects]);

    if (isLoadingExplorer || (explorer?.owner && isLoadingStructure)) {
      return (
        <div className="mt-2 flex h-full items-center justify-center">
          <Loader className="animate-spin" />
        </div>
      );
    }

    if (!explorer || !derivedData) return null;

    const containerClass = cn("flex h-full min-h-0 flex-col overflow-auto", className);
    const hasWarnings = Boolean(structureResources && explorerResources);
    const ownerDisplay = derivedData.addressName ?? `Army Owner`;
    const stationedDisplay = derivedData.structureOwnerName ?? "Field deployment";
    const alignmentColor = derivedData.isMine ? "bg-green-400" : "bg-red-400";

    return (
      <div className={containerClass}>
        <EntityDetailSection compact={compact} tone={hasWarnings ? "highlight" : "default"} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 text-gold/80">
            <span className="text-[10px] uppercase tracking-[0.2em] text-gold/60">Army #{armyEntityId}</span>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={cn("h-2 w-2 rounded-full", alignmentColor)} />
              <span className="truncate">
                {ownerDisplay}
                <span className="px-1 text-gold/50">·</span>
                {stationedDisplay}
              </span>
            </div>
          </div>

          {bannerArmyInfo ? (
            <div className="flex flex-col gap-2">
              <CompactArmyChip army={bannerArmyInfo} className="border border-gold/25 bg-dark/60" />
            </div>
          ) : (
            <p className="text-xxs text-gold/60 italic">Army data unavailable.</p>
          )}

          {hasWarnings && explorerResources && structureResources ? (
            <ArmyWarning army={explorer} explorerResources={explorerResources} structureResources={structureResources} />
          ) : null}

          <div className="flex flex-col gap-2">
            <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">Relics</span>
            {explorerResources ? (
              <CompactEntityInventory
                resources={explorerResources}
                activeRelicIds={activeRelicIds}
                recipientType={RelicRecipientType.Explorer}
                entityId={armyEntityId}
                entityType={EntityType.ARMY}
                allowRelicActivation={derivedData.isMine}
                variant="tight"
                showLabels
              />
            ) : (
              <p className="text-xxs text-gold/60 italic">No relics attached.</p>
            )}
          </div>
        </EntityDetailSection>
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
