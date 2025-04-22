import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position as PositionInterface } from "@/types/position";
import { BaseThreeTooltip, Position } from "@/ui/elements/base-three-tooltip";
import { getEntityIdFromKeys, isTileOccupierStructure } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
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

  const isStructure = useMemo(() => {
    return isTileOccupierStructure(tile?.occupier_type || 0);
  }, [tile]);

  if (!tile?.occupier_id) {
    return null;
  }

  return (
    <BaseThreeTooltip position={Position.CLEAN} className={`pointer-events-none w-min p-2 panel-wood`}>
      {isStructure ? (
        <StructureEntityDetail
          structureEntityId={tile.occupier_id}
          compact={true}
          showButtons={false}
          maxInventory={3}
        />
      ) : (
        <ArmyEntityDetail armyEntityId={tile.occupier_id} compact={true} />
      )}
    </BaseThreeTooltip>
  );
});

EntityInfoLabel.displayName = "EntityInfoLabel";
