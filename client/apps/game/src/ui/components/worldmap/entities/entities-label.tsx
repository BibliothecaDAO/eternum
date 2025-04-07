import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position as PositionInterface } from "@/types/position";
import { ArmyWarning } from "@/ui/components/worldmap/armies/army-warning";
import { StructureListItem } from "@/ui/components/worldmap/structures/structure-list-item";
import { ArmyCapacity } from "@/ui/elements/army-capacity";
import { BaseThreeTooltip, Position } from "@/ui/elements/base-three-tooltip";
import { Headline } from "@/ui/elements/headline";
import { StaminaResource } from "@/ui/elements/stamina-resource";
import {
  ArmyInfo,
  ClientComponents,
  ContractAddress,
  getArmy,
  getEntityIdFromKeys,
  getGuildFromPlayerAddress,
  getRealmNameById,
  getStructure,
  isTileOccupierStructure,
  Structure,
  TileOccupier,
} from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { memo, useMemo } from "react";
import { TroopChip } from "../../military/troop-chip";
import { ImmunityTimer } from "../structures/immunity-timer";

export const EntityInfoLabel = memo(() => {
  const dojo = useDojo();
  const { isMapView } = useQuery();
  const hoveredHex = useUIStore((state) => state.hoveredHex);

  const tile = useMemo(() => {
    if (!hoveredHex || !isMapView) return null;
    const hoveredHexContract = new PositionInterface({
      x: hoveredHex.col || 0,
      y: hoveredHex.row || 0,
    }).getContract();

    return getComponentValue(
      dojo.setup.components.Tile,
      getEntityIdFromKeys([BigInt(hoveredHexContract.x), BigInt(hoveredHexContract.y)]),
    );
  }, [hoveredHex?.col, hoveredHex?.row]);

  if (!tile?.occupier_id) {
    return null;
  }

  return <EntityInfoContent tile={tile} />;
});

const EntityInfoContent = memo(({ tile }: { tile: ComponentValue<ClientComponents["Tile"]["schema"]> }) => {
  const dojo = useDojo();
  const userAddress = ContractAddress(dojo.account.account.address);

  // Get entity info only if we have a valid tile with an occupier
  const entityInfo = useMemo(() => {
    const occupierId = tile.occupier_id || 0;

    // Structure types
    const isStructure = [
      TileOccupier.RealmRegular,
      TileOccupier.RealmWonder,
      TileOccupier.Hyperstructure,
      TileOccupier.FragmentMine,
      TileOccupier.Village,
      TileOccupier.Bank,
    ].includes(tile.occupier_type);

    if (isStructure) {
      return getStructure(occupierId, userAddress, dojo.setup.components);
    }

    if (tile.occupier_type === TileOccupier.Explorer) {
      return getArmy(occupierId, userAddress, dojo.setup.components);
    }

    return null;
  }, [tile]);

  // Early return if no entity info
  if (!entityInfo) return null;

  const playerGuild = getGuildFromPlayerAddress(ContractAddress(entityInfo.owner || 0n), dojo.setup.components);

  if (isTileOccupierStructure(tile.occupier_type)) {
    const structure = entityInfo as Structure;
    return (
      <BaseThreeTooltip position={Position.CLEAN} className={`pointer-events-none w-min`}>
        <div className="flex flex-col gap-1">
          <Headline className="text-center text-lg">
            <div>{structure.ownerName}</div>
            {playerGuild && (
              <div>
                {"< "}
                {playerGuild.name}
                {" >"}
              </div>
            )}
          </Headline>
          <StructureListItem structure={structure} maxInventory={3} />
          <ImmunityTimer structure={structure} />
        </div>
      </BaseThreeTooltip>
    );
  } else if (tile.occupier_type === TileOccupier.Explorer) {
    const army = entityInfo as ArmyInfo;
    const realmId = army.structure?.metadata.realm_id || 0;
    const originRealmName = getRealmNameById(realmId);

    console.log(playerGuild);

    return (
      <BaseThreeTooltip
        position={Position.CLEAN}
        className={`pointer-events-none w-min p-2 panel-wood ${army.isMine ? "bg-ally" : ""}`}
      >
        <div className="flex flex-col gap-2">
          {/* Header with owner and warnings */}
          <div className="flex items-center justify-between border-b border-gold/30 pb-2 gap-2">
            <div className="flex flex-col">
              <h4 className="text-lg font-bold">{army.ownerName || army.name}</h4>
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
          {originRealmName && (
            <div className="bg-gold/10 rounded-sm px-3 border-l-4 border-gold">
              <h6 className="text-base font-bold">{originRealmName}</h6>
            </div>
          )}

          {/* Army warnings */}
          <ArmyWarning army={army} />

          {/* Army information section */}
          <div className="flex justify-between items-start">
            {/* Army name and status */}
            <div className="flex flex-col">
              <div className="text-xs text-gold/80">{army.name}</div>
              {army.isHome && <div className="text-xs text-green mt-1">At Base</div>}
            </div>

            {/* Resources and capacity */}
            <div className="flex flex-col items-end">
              {army.isMercenary && <div className="text-xs text-orange mt-1">Mercenary</div>}
            </div>
          </div>

          {/* Stamina and capacity - more prominent */}
          <div className="flex flex-col gap-2 bg-gray-900/40 rounded p-2 border border-gold/20">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-gold/90">STAMINA</div>
              <StaminaResource entityId={army.entityId} />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-gold/90">CAPACITY</div>
              <ArmyCapacity army={army} />
            </div>
          </div>

          {/* Troops section */}
          <div className="mt-1 border-t border-gold/30 pt-2">
            <div className="text-xs uppercase font-bold text-gold/80 mb-1">Army Composition</div>
            <TroopChip troops={army.troops} iconSize="lg" />
          </div>
        </div>
      </BaseThreeTooltip>
    );
  }

  return null;
});

EntityInfoLabel.displayName = "EntityInfoLabel";
