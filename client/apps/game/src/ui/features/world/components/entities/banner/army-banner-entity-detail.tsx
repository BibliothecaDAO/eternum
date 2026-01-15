import { Loader, Trash2 } from "lucide-react";
import { memo, useMemo } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ReactComponent as Lightning } from "@/assets/icons/common/lightning.svg";
import { TroopChip } from "@/ui/features/military/components/troop-chip";
import { ArmyWarning } from "../../armies/army-warning";
import { CompactEntityInventory } from "../compact-entity-inventory";
import { useArmyEntityDetail } from "../hooks/use-army-entity-detail";
import { EntityDetailLayoutVariant, EntityDetailSection } from "../layout";
import { HexPosition, ID, RelicRecipientType, EntityType, BiomeType, TroopType } from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum";

export interface ArmyBannerEntityDetailProps {
  armyEntityId: ID;
  className?: string;
  compact?: boolean;
  showButtons?: boolean;
  layoutVariant?: EntityDetailLayoutVariant;
}

interface ArmyBannerEntityDetailContentProps extends Omit<ArmyBannerEntityDetailProps, "layoutVariant"> {
  variant: EntityDetailLayoutVariant;
}

const ArmyBannerEntityDetailContent = memo(
  ({
    armyEntityId,
    className,
    compact = true,
    showButtons: _showButtons = false,
    variant: _variant,
  }: ArmyBannerEntityDetailContentProps) => {
    const {
      explorer,
      explorerResources,
      structureResources,
      relicEffects,
      derivedData,
      isLoadingExplorer,
      isLoadingStructure,
      handleDeleteExplorer,
      isLoadingDelete,
    } = useArmyEntityDetail({ armyEntityId });
    const activeRelicIds = useMemo(() => relicEffects.map((effect) => Number(effect.id)), [relicEffects]);

    if (isLoadingExplorer || (explorer?.owner && isLoadingStructure)) {
      return (
        <div className="mt-2 flex h-full items-center justify-center">
          <Loader className="animate-spin" />
        </div>
      );
    }

    if (!explorer || !derivedData) return null;

    const hasWarnings = Boolean(structureResources && explorerResources);
    const ownerDisplay = derivedData.addressName ?? `Army Owner`;
    const stationedDisplay = derivedData.structureOwnerName ?? "Field deployment";

    return (
      <EntityDetailSection
        compact={compact}
        tone={hasWarnings ? "highlight" : "default"}
        className={cn("flex flex-col gap-3", className)}
      >
        <div className="flex flex-col gap-1 text-gold">
          <span className="text-xs flex flex-wrap items-center gap-2">
            <span className="font-normal text-gold">
              {derivedData.isMine ? "🟢" : "🔴"} {ownerDisplay}
              <span className="px-1 text-gold/50">·</span>
              {stationedDisplay}
            </span>
            {derivedData.isMine ? (
              <button
                type="button"
                onClick={handleDeleteExplorer}
                disabled={isLoadingDelete}
                className="inline-flex items-center rounded border border-red-500/40 p-1 text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                title={isLoadingDelete ? "Deleting" : "Delete Army"}
              >
                {isLoadingDelete ? <Loader className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span className="sr-only">Delete Army</span>
              </button>
            ) : null}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <TroopChip troops={explorer.troops} size="sm" className="w-full" />
          {derivedData.stamina && derivedData.maxStamina ? (
            <InlineStaminaBar stamina={derivedData.stamina} maxStamina={derivedData.maxStamina} />
          ) : null}
        </div>

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
            />
          ) : (
            <p className="text-xxs text-gold/60 italic">No relics attached.</p>
          )}
        </div>
      </EntityDetailSection>
    );
  },
);
ArmyBannerEntityDetailContent.displayName = "ArmyBannerEntityDetailContent";

export const ArmyBannerEntityDetail = memo(
  ({ armyEntityId, className, compact = true, showButtons = false, layoutVariant }: ArmyBannerEntityDetailProps) => {
    const resolvedVariant: EntityDetailLayoutVariant = layoutVariant ?? (compact ? "default" : "banner");

    return (
      <ArmyBannerEntityDetailContent
        armyEntityId={armyEntityId}
        className={className}
        compact={compact}
        showButtons={showButtons}
        variant={resolvedVariant}
      />
    );
  },
);

ArmyBannerEntityDetail.displayName = "ArmyBannerEntityDetail";

const InlineStaminaBar = ({
  stamina,
  maxStamina,
}: {
  stamina: { amount: bigint; updated_tick: bigint };
  maxStamina: number;
}) => {
  if (!stamina || maxStamina === 0) return null;
  const staminaValue = Number(stamina.amount);
  const percentage = (staminaValue / maxStamina) * 100;
  const minTravelCost = configManager.getTravelStaminaCost(BiomeType.Ocean, TroopType.Crossbowman);

  let fillClass = "bg-progress-bar-danger";
  if (staminaValue >= minTravelCost) {
    fillClass =
      percentage > 66 ? "bg-progress-bar-good" : percentage > 33 ? "bg-progress-bar-medium" : "bg-progress-bar-danger";
  }

  return (
    <div className="flex items-center gap-2 text-xxs text-gold/80">
      <Lightning className="h-3 w-3 fill-order-power" />
      <div className="flex-1 h-2 rounded-full border border-gray-600 overflow-hidden">
        <div
          className={`${fillClass} h-full rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
      <span className="whitespace-nowrap">{`${staminaValue}/${maxStamina}`}</span>
    </div>
  );
};
