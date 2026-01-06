import { useUIStore } from "@/hooks/store/use-ui-store";
import { BaseThreeTooltip, Position } from "@/ui/design-system/molecules/base-three-tooltip";
import {
  DEFAULT_COORD_ALT,
  getTileAt,
  isTileOccupierChest,
  isTileOccupierQuest,
  isTileOccupierStructure,
  Position as PositionInterface
} from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import type { Tile } from "@bibliothecadao/types";
import { memo, useEffect, useMemo, useState } from "react";
import { ArmyEntityDetail } from "./army-entity-detail";
import { QuestEntityDetail } from "./quest-entity-detail";
import { RelicCrateEntityDetail } from "./relic-crate-entity-detail";
import { StructureEntityDetail } from "./structure-entity-detail";

export const EntitiesLabel = memo(() => {
  const dojo = useDojo();
  const { isMapView } = useQuery();
  const hoveredHex = useUIStore((state) => state.hoveredHex);
  const [tile, setTile] = useState<Tile | undefined>();

  useEffect(() => {
    if (hoveredHex && isMapView) {
      const hoveredHexContract = new PositionInterface({
        x: hoveredHex.col || 0,
        y: hoveredHex.row || 0,
      }).getContract();

      const tileValue = getTileAt(dojo.setup.components, DEFAULT_COORD_ALT, hoveredHexContract.x, hoveredHexContract.y);

      setTile(tileValue);
    } else {
      setTile(undefined);
    }
  }, [hoveredHex?.col, hoveredHex?.row, isMapView]);

  const isStructure = useMemo(() => {
    return isTileOccupierStructure(tile?.occupier_type || 0);
  }, [tile]);

  const isQuest = useMemo(() => {
    return isTileOccupierQuest(tile?.occupier_type || 0);
  }, [tile]);

  const isChest = useMemo(() => {
    return isTileOccupierChest(tile?.occupier_type || 0);
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
      ) : isQuest ? (
        <QuestEntityDetail questEntityId={tile.occupier_id} compact={true} />
      ) : isChest ? (
        <RelicCrateEntityDetail crateEntityId={tile.occupier_id} compact={true} />
      ) : (
        <ArmyEntityDetail armyEntityId={tile.occupier_id} compact={true} />
      )}
    </BaseThreeTooltip>
  );
});

EntitiesLabel.displayName = "EntitiesLabel";
