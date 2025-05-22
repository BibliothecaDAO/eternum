import { ArmyCapacity } from "@/ui/elements/army-capacity";
import { StaminaResource } from "@/ui/elements/stamina-resource";
import { useChatStore } from "@/ui/modules/ws-chat/useChatStore";
import { getCharacterName } from "@/utils/agent";
import { getBlockTimestamp } from "@/utils/timestamp";
import { getAddressName, getGuildFromPlayerAddress, StaminaManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@bibliothecadao/torii-client";
import { ContractAddress, ID, TroopTier, TroopType } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { Loader, MessageCircle, Trash2 } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { toast } from "sonner";
import { TroopChip } from "../../military/troop-chip";
import { InventoryResources } from "../../resources/inventory-resources";
import { ArmyWarning } from "../armies/army-warning";

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
      account: { account },
      setup: {
        components,
        systemCalls: { explorer_delete },
      },
    } = useDojo();

    const userAddress = ContractAddress(account.address);
    const [isLoadingDelete, setIsLoadingDelete] = useState(false);

    const {
      data: explorerData,
      isLoading: isLoadingExplorer,
      // error: explorerError, // Available if error handling is needed
    } = useQuery({
      queryKey: ["explorer", String(armyEntityId)],
      queryFn: async () => {
        if (!toriiClient || !armyEntityId) return undefined;
        return getExplorerFromToriiClient(toriiClient, armyEntityId);
      },
      staleTime: 30000, // 30 seconds
    });

    const explorer = explorerData?.explorer;
    const explorerResources = explorerData?.resources;

    const {
      data: structureData,
      isLoading: isLoadingStructure,
      // error: structureError, // Available if error handling is needed
    } = useQuery({
      queryKey: ["structure", explorer?.owner ? String(explorer.owner) : undefined],
      queryFn: async () => {
        if (!toriiClient || !explorer?.owner) return undefined;
        return getStructureFromToriiClient(toriiClient, explorer.owner);
      },
      enabled: !!explorer?.owner,
      staleTime: 30000, // 30 seconds
    });

    const structure = structureData?.structure;
    const structureResources = structureData?.resources;

    const derivedData = useMemo(() => {
      if (!explorer) return undefined;

      const { currentArmiesTick } = getBlockTimestamp();
      const stamina = StaminaManager.getStamina(explorer.troops, currentArmiesTick);
      const maxStamina = StaminaManager.getMaxStamina(
        explorer.troops.category as TroopType,
        explorer.troops.tier as TroopTier,
      );

      const guild = structure ? getGuildFromPlayerAddress(ContractAddress(structure.owner), components) : undefined;
      const userGuild = getGuildFromPlayerAddress(userAddress, components);
      const isMine = structure?.owner === userAddress;
      const isAlly = isMine || (guild && userGuild && guild.entityId === userGuild.entityId) || false;

      const addressName = structure?.owner
        ? getAddressName(structure?.owner, components)
        : getCharacterName(explorer.troops.tier as TroopTier, explorer.troops.category as TroopType, armyEntityId);

      return {
        stamina,
        maxStamina,
        playerGuild: guild,
        isAlly,
        addressName,
        isMine,
      };
    }, [explorer, structure, components, userAddress, armyEntityId]);

    const handleDeleteExplorer = async () => {
      setIsLoadingDelete(true);
      try {
        await explorer_delete({
          signer: account,
          explorer_id: armyEntityId,
        });
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoadingDelete(false);
      }
    };

    const { openChat, selectDirectMessageRecipient, getUserIdByUsername } = useChatStore((state) => state.actions);

    const handleChatClick = () => {
      if (derivedData?.isMine) {
        openChat();
      } else if (derivedData?.addressName) {
        const userId = getUserIdByUsername(derivedData.addressName);
        if (userId) {
          selectDirectMessageRecipient(userId);
          openChat();
        } else {
          // Show toast notification when user is not found
          toast.error(`${derivedData.addressName} is not available for direct messaging`, {
            description: "They probably offline right now, please try again later.",
            duration: 5000,
          });
          // Open global chat as fallback
          openChat();
        }
      }
    };

    const headerTextClass = compact ? "text-base" : "text-lg";
    const smallTextClass = compact ? "text-xxs" : "text-xs";

    if (isLoadingExplorer || (explorer?.owner && isLoadingStructure)) {
      return (
        <div className="flex items-center justify-center h-full mt-2 ">
          <Loader className="animate-spin" />
        </div>
      );
    }

    if (!explorer || !derivedData) return null;

    return (
      <div className={`flex flex-col ${compact ? "gap-1" : "gap-2"} ${className}`}>
        {/* Header with owner and guild info */}
        <div className={`flex items-center justify-between border-b border-gold/30 ${compact ? "pb-1" : "pb-2"} gap-2`}>
          <div className="flex flex-col">
            <h4 className={`${headerTextClass} font-bold`}>
              {derivedData.addressName} <span className="text-xs text-gold/80">({armyEntityId})</span>
            </h4>
            {derivedData.playerGuild && (
              <div className="text-xs text-gold/80">
                {"< "}
                {derivedData.playerGuild.name}
                {" >"}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-2 py-1 rounded text-xs font-bold ${derivedData.isAlly ? "bg-green/20" : "bg-red/20"}`}>
              {derivedData.isAlly ? "Ally" : "Enemy"}
            </div>
            {derivedData.addressName !== undefined && (
              <button onClick={handleChatClick} className="p-1 rounded hover:bg-gold/10 transition" title="Chat">
                <MessageCircle />
              </button>
            )}
            {derivedData.isMine && (
              <button
                onClick={handleDeleteExplorer}
                className={`p-1 rounded bg-red-600/80 hover:bg-red-700 transition text-white flex items-center ${
                  isLoadingDelete ? "opacity-60 cursor-not-allowed" : ""
                }`}
                title="Delete Army"
                disabled={isLoadingDelete}
              >
                {isLoadingDelete ? (
                  <span className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                ) : (
                  <Trash2 size={25} />
                )}
                {isLoadingDelete && <span className="ml-1 text-xs">Deleting...</span>}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col w-full gap-2">
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
                {derivedData.stamina && derivedData.maxStamina && (
                  <StaminaResource
                    entityId={armyEntityId}
                    stamina={derivedData.stamina}
                    maxStamina={derivedData.maxStamina}
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
