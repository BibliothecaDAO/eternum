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
  maxInventory?: number;
}

export const ArmyEntityDetail = memo(
  ({ armyEntityId, className, compact = false, maxInventory = Infinity }: ArmyEntityDetailProps) => {
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
    const headerTextClass = compact ? "text-base" : "text-lg";
    const smallTextClass = compact ? "text-xxs" : "text-xs";

    return (
      <div className={`flex flex-col ${compact ? "gap-1" : "gap-2"} ${className}`}>
        {/* Header with owner and guild info */}
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

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col w-full gap-2">
            {/* Army name - made more prominent */}
            {army.name && (
              <div className="flex flex-col gap-0.5">
                <div className="bg-gold/10 rounded-sm px-2 py-0.5 border-l-4 border-gold">
                  <h6 className={`${compact ? "text-base" : "text-lg"} font-bold truncate`}>{army.name}</h6>
                </div>
                <div
                  className={`${compact ? "text-xs" : "text-sm"} font-semibold text-gold/90 uppercase tracking-wide`}
                >
                  Army
                </div>
              </div>
            )}

            {/* Army warnings */}
            <ArmyWarning army={army} />

            {/* Army status indicators */}
            <div className="flex justify-between items-center">
              {army.isHome && (
                <div className="text-xs text-green font-semibold px-2 py-0.5 bg-green/10 rounded">At Base</div>
              )}
              {army.isMercenary && (
                <div className="text-xs text-orange font-semibold px-2 py-0.5 bg-orange/10 rounded">Mercenary</div>
              )}
              {!army.isHome && !army.isMercenary && <div />}
            </div>

            {/* Stamina and capacity - more prominent */}
            <div className="flex flex-col gap-1 mt-1 bg-gray-800/40 rounded p-2 border border-gold/20">
              <div className="flex items-center justify-between gap-2">
                <div className={`${smallTextClass} font-bold text-gold/90 uppercase`}>STAMINA</div>
                <StaminaResource entityId={army.entityId} />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className={`${smallTextClass} font-bold text-gold/90 uppercase`}>CAPACITY</div>
                <ArmyCapacity army={army} />
              </div>
            </div>
          </div>

          {/* Resources section */}
          {hasResources && (
            <div className="flex flex-col gap-0.5 w-full mt-1 border-t border-gold/20 pt-1">
              <div className={`${smallTextClass} text-gold/80 uppercase font-semibold`}>Resources</div>
              <InventoryResources
                entityId={army.entityId}
                max={maxInventory}
                className="flex flex-wrap gap-1 w-full no-scrollbar"
                resourcesIconSize={compact ? "xs" : "sm"}
                textSize={compact ? "xxs" : "xs"}
              />
            </div>
          )}

          {/* Troops section */}
          <div className="flex flex-col gap-0.5 w-full mt-1 border-t border-gold/20 pt-1">
            <div className={`${smallTextClass} text-gold/80 uppercase font-semibold`}>Army Composition</div>
            <TroopChip troops={army.troops} iconSize={compact ? "md" : "lg"} />
          </div>
        </div>
      </div>
    );
  },
);

ArmyEntityDetail.displayName = "ArmyEntityDetail";
