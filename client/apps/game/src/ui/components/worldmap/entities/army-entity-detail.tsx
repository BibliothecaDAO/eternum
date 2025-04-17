import { InventoryResources } from "@/ui/components/resources/inventory-resources";
import { ArmyWarning } from "@/ui/components/worldmap/armies/army-warning";
import { ArmyCapacity } from "@/ui/elements/army-capacity";
import { StaminaResource } from "@/ui/elements/stamina-resource";
import { getArmy, getGuildFromPlayerAddress, ResourceManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, ID } from "@bibliothecadao/types";
import { memo, useMemo } from "react";
import { TroopChip } from "../../military/troop-chip";

export interface ArmyEntityDetailProps {
  armyEntityId: ID;
  className?: string;
  compact?: boolean;
}

export const ArmyEntityDetail = memo(({ armyEntityId, className, compact = false }: ArmyEntityDetailProps) => {
  const {
    account,
    setup: { components },
  } = useDojo();

  const userAddress = ContractAddress(account.account.address);

  const army = useMemo(() => {
    return getArmy(armyEntityId, userAddress, components);
  }, [armyEntityId, userAddress, components]);

  const playerGuild = useMemo(() => {
    if (!army) return null;
    return getGuildFromPlayerAddress(ContractAddress(army.owner || 0n), components);
  }, [army, components]);

  // Get available resources for the entity - only when needed
  const availableResources = useMemo(() => {
    if (!army) return [];
    const resourceManager = new ResourceManager(components, armyEntityId);
    return resourceManager.getResourceBalances();
  }, [components, armyEntityId]);
  const hasResources = availableResources.length > 0;

  if (!army) return null;

  // Precompute common class strings
  const textSizeClass = compact ? "text-xs" : "text-sm";
  const headerTextClass = compact ? "text-base" : "text-lg";
  const smallTextClass = compact ? "text-xxs" : "text-xs";
  const paddingClass = compact ? "p-1.5" : "p-2";
  const marginClass = compact ? "mt-0.5" : "mt-1";
  const paddingTopClass = compact ? "pt-1" : "pt-2";

  return (
    <div className={`flex flex-col ${compact ? "gap-1" : "gap-2"} ${className}`}>
      {/* Header with owner and warnings */}
      <div className={`flex items-center justify-between border-b border-gold/30 ${compact ? "pb-1" : "pb-2"} gap-2`}>
        <div className="flex flex-col">
          <h4 className={`${headerTextClass} font-bold`}>{army.ownerName || army.name}</h4>
          {playerGuild && (
            <div className="text-xs text-gold/80">
              {"< "}
              {playerGuild.name}
              {" >"}
            </div>
          )}
        </div>
        <div className={`px-2 py-1 rounded text-xs font-bold ${army.isMine ? "bg-green/20" : "bg-red/20"}`}>
          {army.isMine ? "Ally" : "Enemy"}
        </div>
      </div>

      {/* Realm origin - made more prominent */}
      {army.name && (
        <div className={`bg-gold/10 rounded-sm ${compact ? "px-2 py-0.5" : "px-3"} border-l-4 border-gold`}>
          <h6 className={`${headerTextClass} font-bold`}>{army.name}</h6>
        </div>
      )}

      {/* Army warnings */}
      <ArmyWarning army={army} />

      {/* Army information section */}
      <div className="flex justify-between items-start">
        {/* Army name and status */}
        <div className="flex flex-col">{army.isHome && <div className="text-xs text-green mt-1">At Base</div>}</div>

        {/* Resources and capacity */}
        <div className="flex flex-col items-end">
          {army.isMercenary && <div className="text-xs text-orange mt-1">Mercenary</div>}
        </div>
      </div>

      {/* Stamina and capacity - more prominent */}
      <div
        className={`flex flex-col ${compact ? "gap-1" : "gap-2"} bg-gray-900/40 rounded ${paddingClass} border border-gold/20`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className={`${smallTextClass} font-bold text-gold/90`}>STAMINA</div>
          <StaminaResource entityId={army.entityId} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className={`${smallTextClass} font-bold text-gold/90`}>CAPACITY</div>
          <ArmyCapacity army={army} />
        </div>
      </div>

      {/* Resources section */}
      {hasResources && (
        <div className={`${marginClass} border-t border-gold/30 ${paddingTopClass}`}>
          <div className={`${smallTextClass} uppercase font-bold text-gold/80 mb-1`}>Resources</div>
          {/* Using InventoryResources component for resource display */}
          <InventoryResources
            entityId={army.entityId}
            max={compact ? 5 : 12}
            className="flex flex-wrap gap-1 no-scrollbar"
            resourcesIconSize={compact ? "xs" : "sm"}
            textSize={compact ? "xxs" : "xs"}
          />
        </div>
      )}

      {/* Troops section */}
      <div className={`${marginClass} border-t border-gold/30 ${paddingTopClass}`}>
        <div className={`${smallTextClass} uppercase font-bold text-gold/80 mb-1`}>Army Composition</div>
        <TroopChip troops={army.troops} iconSize={compact ? "md" : "lg"} />
      </div>
    </div>
  );
});

ArmyEntityDetail.displayName = "ArmyEntityDetail";
