import { useUIStore } from "@/hooks/store/use-ui-store";
import { FELT_CENTER } from "@/ui/config";
import { BiomeInfoPanel } from "@/ui/features/world";
import { ArmyEntityDetail } from "@/ui/features/world/components/entities/army-entity-detail";
import { QuestEntityDetail } from "@/ui/features/world/components/entities/quest-entity-detail";
import { RelicCrateEntityDetail } from "@/ui/features/world/components/entities/relic-crate-entity-detail";
import { StructureEntityDetail } from "@/ui/features/world/components/entities/structure-entity-detail";
import {
  Biome,
  getEntityIdFromKeys,
  isTileOccupierChest,
  isTileOccupierQuest,
  isTileOccupierStructure,
  Position as PositionInterface,
  getTileAt,
  DEFAULT_COORD_ALT,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
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
    return getTileAt(dojo.setup.components, DEFAULT_COORD_ALT, selectedHexContract.x, selectedHexContract.y);
  }, [selectedHex?.col, selectedHex?.row]);

  const biome = useMemo(() => {
    return Biome.getBiome(selectedHex?.col || 0, selectedHex?.row || 0);
  }, [selectedHex]);

  const hasOccupier = useMemo(() => {
    if (!tile) return false;
    return tile.occupier_id !== 0;
  }, [tile]);

  const isExplored = useMemo(() => {
    if (!tile) return false;
    return tile.biome !== 0;
  }, [tile]);

  const isStructure = useMemo(() => {
    return isTileOccupierStructure(tile?.occupier_type || 0);
  }, [tile]);

  const isChest = useMemo(() => {
    return isTileOccupierChest(tile?.occupier_type || 0);
  }, [tile]);

  const isQuest = useMemo(() => {
    return isTileOccupierQuest(tile?.occupier_type || 0);
  }, [tile]);

  const tileTypeLabel = useMemo(() => {
    if (!tile) return "Hex Tile";
    if (!hasOccupier) return "Biome Tile";
    if (isStructure) return "Structure Tile";
    if (isChest) return "Relic Tile";
    if (isQuest) return "Quest Tile";
    return "Army Tile";
  }, [tile, hasOccupier, isStructure, isChest, isQuest]);

  if (!selectedHex) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center ">
          <p className="text-lg font-medium mb-2">No hex selected</p>
          <p className="text-sm">Click on a hex to see details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-2">
      {/* Header with hex coordinates */}
      {selectedHex && (
        <div className="mb-2 flex-shrink-0 text-center text-sm font-medium">
          <span className="rounded-md bg-slate-800/80 px-2 py-1 ring-1 ring-slate-600/40">
            {tileTypeLabel} · ({selectedHex.col - FELT_CENTER()}, {selectedHex.row - FELT_CENTER()})
          </span>
        </div>
      )}

      {/* Show unexplored message if hex is not explored */}
      {!isExplored ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center ">
            <div className="mb-3">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full  flex items-center justify-center">
                <span className="text-2xl">🗺️</span>
              </div>
            </div>
            <p className="text-lg font-medium mb-2 ">Unexplored Territory</p>
            <p className="text-sm ">This hex has not been explored yet.</p>
            <p className="text-xs  mt-2">Send an explorer to discover what lies here.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Biome panel - takes remaining space when no occupier */}
          <div className={hasOccupier ? "flex-shrink-0 mb-4" : "flex-1 min-h-0"}>
            <div className={hasOccupier ? "" : "h-full"}>
              <BiomeInfoPanel biome={biome} collapsed={hasOccupier} />
            </div>
          </div>

          {/* Occupier details - only shown when there's an occupier */}
          {hasOccupier && tile && (
            <div className="flex-shrink-0">
              {isStructure ? (
                <div className="flex flex-col gap-3">
                  <StructureEntityDetail
                    structureEntityId={tile.occupier_id}
                    compact={false}
                    maxInventory={Infinity}
                    showButtons={true}
                  />
                </div>
              ) : isChest ? (
                <RelicCrateEntityDetail crateEntityId={tile.occupier_id} compact={false} layoutVariant="default" />
              ) : isQuest ? (
                <QuestEntityDetail questEntityId={tile.occupier_id} compact={false} className="max-w-md mx-auto" />
              ) : (
                <ArmyEntityDetail armyEntityId={tile.occupier_id} compact={false} showButtons={true} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
