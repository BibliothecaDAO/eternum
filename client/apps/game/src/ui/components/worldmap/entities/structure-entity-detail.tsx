import {
  getAddressName,
  getGuardsByStructure,
  getGuildFromPlayerAddress,
  getHyperstructureProgress,
  getRealmNameById,
  getStructureTypeName,
  unpackValue,
} from "@bibliothecadao/eternum";

import { useChatStore } from "@/ui/modules/ws-chat/useChatStore";
import { displayAddress } from "@/ui/utils/utils";
import { useDojo } from "@bibliothecadao/react";
import { getStructureFromToriiClient } from "@bibliothecadao/torii-client";
import { ClientComponents, ContractAddress, GuildInfo, ID, MERCENARIES, StructureType } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";
import { MessageCircle } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { CompactDefenseDisplay } from "../../military/compact-defense-display";
import { DefenseTroop } from "../../military/structure-defence";
import { InventoryResources } from "../../resources/inventory-resources";
import { RealmResourcesIO } from "../../resources/realm-resources-io";
import { ImmunityTimer } from "../structures/immunity-timer";

export interface StructureEntityDetailProps {
  structureEntityId: ID;
  className?: string;
  compact?: boolean;
  maxInventory?: number;
  showButtons?: boolean;
}

export const StructureEntityDetail = memo(
  ({
    structureEntityId,
    className,
    compact = false,
    maxInventory = Infinity,
    showButtons = false,
  }: StructureEntityDetailProps) => {
    const {
      network: { toriiClient },
      account,
      setup: { components },
    } = useDojo();

    const userAddress = ContractAddress(account.account.address);
    const [structure, setStructure] = useState<ComponentValue<ClientComponents["Structure"]["schema"]> | null>(null);
    const [resources, setResources] = useState<ComponentValue<ClientComponents["Resource"]["schema"]> | null>(null);
    const [playerGuild, setPlayerGuild] = useState<GuildInfo | undefined>(undefined);
    const [isAlly, setIsAlly] = useState<boolean>(false);
    const [guards, setGuards] = useState<DefenseTroop[]>([]);
    const [addressName, setAddressName] = useState<string | undefined>(undefined);

    useEffect(() => {
      const fetchStructure = async () => {
        const { structure, resources } = await getStructureFromToriiClient(toriiClient, structureEntityId);
        if (!structure || !resources) return;
        const guild = getGuildFromPlayerAddress(ContractAddress(structure.owner), components);
        const guards = structure ? getGuardsByStructure(structure).filter((guard) => guard.troops.count > 0n) : [];
        const userGuild = getGuildFromPlayerAddress(userAddress, components);
        const isAlly = guild && userGuild && guild.entityId === userGuild.entityId;
        setIsAlly(isAlly || false);
        // explorer troops that are roaming the world are always daydreams agents if they are not owned by a player
        setAddressName(structure?.owner ? getAddressName(structure?.owner, components) : MERCENARIES);
        setStructure(structure);
        setResources(resources);
        setPlayerGuild(guild);
        setGuards(guards);
      };
      fetchStructure();
    }, [structureEntityId, userAddress]);

    const isRealmOrVillage =
      structure?.base.category === StructureType.Realm || structure?.base.category === StructureType.Village;
    const isHyperstructure = structure?.base.category === StructureType.Hyperstructure;
    const structureTypeName = structure ? getStructureTypeName(structure?.category) : undefined;

    const progress = useMemo(() => {
      return isHyperstructure ? getHyperstructureProgress(structure?.entity_id, components) : undefined;
    }, [isHyperstructure, structure?.entity_id, components]);

    // Precompute common class strings for consistency with ArmyEntityDetail
    const smallTextClass = compact ? "text-xxs" : "text-xs";

    const isMine = useMemo(() => {
      return structure?.owner === userAddress;
    }, [structure?.owner, userAddress]);

    const { openChat, selectDirectMessageRecipient, getUserIdByUsername } = useChatStore((state) => state.actions);

    const handleChatClick = () => {
      if (isMine) {
        openChat();
      } else {
        const userId = getUserIdByUsername(addressName || "");

        if (userId) {
          selectDirectMessageRecipient(userId);
        }
      }
    };

    const structureName = useMemo(() => {
      if (structure?.base.category === StructureType.Realm) {
        const realmName = getRealmNameById(structure?.metadata.realm_id);
        return realmName;
      }
      return structure?.entity_id;
    }, [structure]);

    const resourcesProduced = useMemo(() => {
      return unpackValue(structure?.resources_packed || 0n);
    }, [structure]);

    if (!structure) return null;

    return (
      <div className={`flex flex-col ${compact ? "gap-1" : "gap-2"} ${className}`}>
        {/* Header with owner and guild info */}
        <div className="flex items-center justify-between border-b border-gold/30 pb-2 gap-2">
          <div className="flex flex-col">
            <h4 className={`${compact ? "text-base" : "text-2xl"}`}>
              {addressName || displayAddress("0x0" + structure?.owner.toString(16) || "0x0")}
            </h4>
            {playerGuild && (
              <div className="text-xs text-gold/80">
                {"< "}
                {playerGuild.name}
                {" >"}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div
              className={`px-2 py-1 rounded text-xs h6 ${isAlly ? "bg-green/30 border-green/50 border" : "bg-red/30 border-red/50 border"}`}
            >
              {isAlly ? "Ally" : "Enemy"}
            </div>
            <button onClick={handleChatClick}>
              <MessageCircle />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col w-full gap-2">
            {/* Structure name and type */}
            <div className="flex flex-col gap-0.5">
              <div className="bg-gold/10 rounded-sm px-2 py-0.5 border-l-4 border-gold">
                <h6 className={`${compact ? "text-base" : "text-lg"} font-bold truncate`}>{structureName}</h6>
              </div>
              <div className={`${compact ? "text-xs" : "text-sm"} font-semibold text-gold/90 uppercase tracking-wide`}>
                {structureTypeName}
              </div>
            </div>

            {/* Progress bar for hyperstructures */}
            {isHyperstructure && (
              <div className="flex flex-col gap-1 mt-1 bg-gray-800/40 rounded p-2 border border-gold/20">
                <div className="flex justify-between items-center">
                  <div className={`${smallTextClass} font-bold text-gold/90 uppercase`}>Construction Progress</div>
                  <div className="text-xs font-semibold bg-gold/20 px-2 py-0.5 rounded-full">
                    {progress?.percentage ?? 0}%
                  </div>
                </div>
                <div className="w-full bg-gray-700/70 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-gold/80 to-gold h-full rounded-full transition-all duration-500 shadow-glow-sm"
                    style={{ width: `${progress?.percentage ?? 0}%` }}
                  />
                </div>
                {progress?.percentage !== 100 && (
                  <div className="text-xxs text-gold/60 italic text-center mt-0.5">
                    {progress?.percentage === 0 ? "Construction not started" : "Construction in progress"}
                  </div>
                )}
              </div>
            )}

            {/* Realm resources input/output display */}
            {isRealmOrVillage && (
              <div className="mt-1 bg-gray-800/40 rounded p-2 border border-gold/20">
                <div className={`${smallTextClass} font-bold text-gold/90 uppercase mb-1`}>Resource Production</div>
                <RealmResourcesIO resourcesProduced={resourcesProduced} compact={true} size="xs" />
              </div>
            )}

            {/* Guards/Defense section */}
            {guards.length > 0 && (
              <div className="flex flex-col gap-0.5 w-full mt-1 border-t border-gold/20 pt-1">
                <div className={`${smallTextClass} text-gold/80 uppercase font-semibold`}>Defense</div>
                <CompactDefenseDisplay
                  troops={guards.map((army) => ({
                    slot: army.slot,
                    troops: army.troops,
                  }))}
                />
              </div>
            )}
          </div>

          {/* Resources section */}
          <div className="flex flex-col gap-0.5 w-full mt-1 border-t border-gold/20 pt-1">
            <div className={`${smallTextClass} text-gold/80 uppercase font-semibold`}>Resources</div>
            {resources && (
              <InventoryResources
                max={maxInventory}
                resources={resources}
                className="flex flex-wrap gap-1 w-full no-scrollbar"
                resourcesIconSize={compact ? "xs" : "sm"}
                textSize={compact ? "xxs" : "xs"}
              />
            )}
          </div>

          {/* Action buttons */}
          {showButtons && <div className="flex justify-end gap-1 mt-0.5">{showButtons}</div>}
        </div>

        {/* Immunity timer */}
        <div className="mt-1 border-t border-gold/20 pt-1">
          <ImmunityTimer structure={structure} />
        </div>
      </div>
    );
  },
);

StructureEntityDetail.displayName = "StructureEntityDetail";
