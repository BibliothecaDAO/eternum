import { InventoryResources } from "@/ui/components/resources/inventory-resources";
import { ArmyWarning } from "@/ui/components/worldmap/armies/army-warning";
import { ArmyCapacity } from "@/ui/elements/army-capacity";
import { StaminaResource } from "@/ui/elements/stamina-resource";
import { getBlockTimestamp } from "@/utils/timestamp";
import { getGuildFromPlayerAddress, StaminaManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@bibliothecadao/torii-client";
import { ClientComponents, ContractAddress, GuildInfo, ID, TroopTier, TroopType } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { memo, useEffect, useState } from "react";
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
      network: { toriiClient },
      account,
      setup: { components },
    } = useDojo();

    const [explorer, setExplorer] = useState<ComponentValue<ClientComponents["ExplorerTroops"]["schema"]> | undefined>(
      undefined,
    );

    const [explorerResources, setExplorerResources] = useState<
      ComponentValue<ClientComponents["Resource"]["schema"]> | undefined
    >(undefined);
    const [structureResources, setStructureResources] = useState<
      ComponentValue<ClientComponents["Resource"]["schema"]> | undefined
    >(undefined);
    const [structure, setStructure] = useState<ComponentValue<ClientComponents["Structure"]["schema"]> | undefined>(
      undefined,
    );
    const userAddress = ContractAddress(account.account.address);
    const [playerGuild, setPlayerGuild] = useState<GuildInfo | undefined>(undefined);
    const [stamina, setStamina] = useState<{ amount: bigint; updated_tick: bigint } | undefined>(undefined);
    const [maxStamina, setMaxStamina] = useState<number | undefined>(undefined);

    useEffect(() => {
      const fetch = async () => {
        const { explorer, resources: explorerResources } = await getExplorerFromToriiClient(toriiClient, armyEntityId);
        if (!explorer) {
          return {
            explorer: undefined,
            explorerResources: undefined,
            structure: undefined,
            structureResources: undefined,
          };
        }
        const { structure, resources: structureResources } = await getStructureFromToriiClient(
          toriiClient,
          explorer.owner,
        );

        const { currentArmiesTick } = getBlockTimestamp();
        const stamina = StaminaManager.getStamina(explorer.troops, currentArmiesTick);
        const maxStamina = StaminaManager.getMaxStamina(
          explorer.troops.category as TroopType,
          explorer.troops.tier as TroopTier,
        );

        const guild = structure ? getGuildFromPlayerAddress(ContractAddress(structure.owner), components) : undefined;
        setStamina(stamina);
        setMaxStamina(maxStamina);
        setPlayerGuild(guild);
        setExplorer(explorer);
        setExplorerResources(explorerResources);
        setStructure(structure);
        setStructureResources(structureResources);
      };
      fetch();
    }, [armyEntityId]);

    const isMine = structure?.owner === userAddress;

    // Precompute common class strings
    const headerTextClass = compact ? "text-base" : "text-lg";
    const smallTextClass = compact ? "text-xxs" : "text-xs";

    if (!explorer) return null;

    return (
      <div className={`flex flex-col ${compact ? "gap-1" : "gap-2"} ${className}`}>
        {/* Header with owner and guild info */}
        <div className={`flex items-center justify-between border-b border-gold/30 ${compact ? "pb-1" : "pb-2"} gap-2`}>
          <div className="flex flex-col">
            <h4 className={`${headerTextClass} font-bold`}>{explorer.explorer_id}</h4>
            {playerGuild && (
              <div className="text-xs text-gold/80">
                {"< "}
                {playerGuild.name}
                {" >"}
              </div>
            )}
          </div>
          <div className={`px-2 py-1 rounded text-xs font-bold ${isMine ? "bg-green/20" : "bg-red/20"}`}>
            {isMine ? "Ally" : "Enemy"}
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col w-full gap-2">
            {/* Army name - made more prominent */}
            {explorer && (
              <div className="flex flex-col gap-0.5">
                <div className="bg-gold/10 rounded-sm px-2 py-0.5 border-l-4 border-gold">
                  <h6 className={`${compact ? "text-base" : "text-lg"} font-bold truncate`}>{explorer.explorer_id}</h6>
                </div>
                <div
                  className={`${compact ? "text-xs" : "text-sm"} font-semibold text-gold/90 uppercase tracking-wide`}
                >
                  Army
                </div>
              </div>
            )}

            {/* Army warnings */}
            {structureResources && explorerResources && (
              <ArmyWarning
                army={explorer}
                explorerResources={explorerResources}
                structureResources={structureResources}
              />
            )}

            {/* Stamina and capacity - more prominent */}
            <div className="flex flex-col gap-1 mt-1 bg-gray-800/40 rounded p-2 border border-gold/20">
              <div className="flex items-center justify-between gap-2">
                <div className={`${smallTextClass} font-bold text-gold/90 uppercase`}>STAMINA</div>
                {stamina && maxStamina && (
                  <StaminaResource
                    entityId={armyEntityId}
                    stamina={stamina}
                    maxStamina={maxStamina}
                    className="flex-1"
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className={`${smallTextClass} font-bold text-gold/90 uppercase`}>CAPACITY</div>
                <ArmyCapacity resource={explorerResources} />
              </div>
            </div>
          </div>

          {/* Resources section */}
          {explorerResources && (
            <div className="flex flex-col gap-0.5 w-full mt-1 border-t border-gold/20 pt-1">
              <div className={`${smallTextClass} text-gold/80 uppercase font-semibold`}>Resources</div>
              <InventoryResources
                resources={explorerResources}
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
            <TroopChip troops={explorer.troops} iconSize={compact ? "md" : "lg"} />
          </div>
        </div>
      </div>
    );
  },
);

ArmyEntityDetail.displayName = "ArmyEntityDetail";
