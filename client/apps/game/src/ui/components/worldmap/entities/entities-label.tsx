import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position as PositionInterface } from "@/types/position";
import { BaseThreeTooltip, Position } from "@/ui/elements/base-three-tooltip";
import { getArmy, getEntityIdFromKeys, getStructure, isTileOccupierStructure } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ClientComponents, ContractAddress, TileOccupier } from "@bibliothecadao/types";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { memo, useMemo } from "react";
import { ArmyEntityDetail } from "./army-entity-detail";
import { StructureEntityDetail } from "./structure-entity-detail";

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

  if (isTileOccupierStructure(tile.occupier_type)) {
    return (
      <BaseThreeTooltip position={Position.CLEAN} className={`pointer-events-none w-min p-2 panel-wood`}>
        <StructureEntityDetail
          structureEntityId={tile.occupier_id}
          compact={true}
          showButtons={false}
          maxInventory={3}
        />
      </BaseThreeTooltip>
    );
  } else if (tile.occupier_type === TileOccupier.Explorer) {
    return (
      <BaseThreeTooltip position={Position.CLEAN} className={`pointer-events-none w-min p-2 panel-wood `}>
        <ArmyEntityDetail armyEntityId={tile.occupier_id} compact={true} />
      </BaseThreeTooltip>
    );
  }

  return null;
});

EntityInfoLabel.displayName = "EntityInfoLabel";
