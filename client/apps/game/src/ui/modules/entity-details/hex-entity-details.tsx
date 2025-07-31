import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position as PositionInterface } from "@/types/position";
import { ArmyEntityDetail, BiomeInfoPanel, QuestEntityDetail, StructureEntityDetail } from "@/ui/features/world";
import { Biome, getEntityIdFromKeys, isTileOccupierQuest, isTileOccupierStructure } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { FELT_CENTER } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";

export const HexEntityDetails = () => {
  const dojo = useDojo();
  const selectedHex = useUIStore((state) => state.selectedHex);

  // Get tile data based on selected hex
  const tile = useMemo(() => {
    if (!selectedHex) return null;
    const selectedHexContract = new PositionInterface({
      x: selectedHex.col,
      y: selectedHex.row,
    }).getContract();
    return getComponentValue(
      dojo.setup.components.Tile,
      getEntityIdFromKeys([BigInt(selectedHexContract.x), BigInt(selectedHexContract.y)]),
    );
  }, [selectedHex?.col, selectedHex?.row]);

  const biome = useMemo(() => {
    return Biome.getBiome(selectedHex?.col || 0, selectedHex?.row || 0);
  }, [selectedHex]);

  const hasOccupier = useMemo(() => {
    if (!tile) return false;
    return tile.occupier_id !== 0;
  }, [tile]);

  const isStructure = useMemo(() => {
    return isTileOccupierStructure(tile?.occupier_type || 0);
  }, [tile]);

  if (!selectedHex) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-gray-400">
          <p className="text-lg font-medium mb-2">No hex selected</p>
          <p className="text-sm">Click on a hex to see details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-auto p-2">
      {/* Header with hex coordinates */}
      {selectedHex && (
        <div className="mb-2 text-sm font-medium text-center flex-shrink-0">
          <span className="px-2 py-1 bg-gray-800 rounded-md">
            Hex coords: ({selectedHex.col - FELT_CENTER}, {selectedHex.row - FELT_CENTER})
          </span>
        </div>
      )}

      {/* Biome panel - takes remaining space when no occupier */}
      <div className={hasOccupier ? "flex-shrink-0 mb-4" : "flex-1 min-h-0"}>
        <div className={hasOccupier ? "" : "h-full"}>
          <BiomeInfoPanel biome={biome} />
        </div>
      </div>

      {/* Occupier details - only shown when there's an occupier */}
      {hasOccupier && tile && (
        <div className="flex-shrink-0">
          {isStructure ? (
            <StructureEntityDetail
              structureEntityId={tile.occupier_id}
              compact={false}
              maxInventory={Infinity}
              showButtons={true}
            />
          ) : isTileOccupierQuest(tile.occupier_type) ? (
            <QuestEntityDetail questEntityId={tile.occupier_id} compact={false} className="max-w-md mx-auto" />
          ) : (
            <ArmyEntityDetail armyEntityId={tile.occupier_id} compact={false} showButtons={true} />
          )}
        </div>
      )}
    </div>
  );
};
